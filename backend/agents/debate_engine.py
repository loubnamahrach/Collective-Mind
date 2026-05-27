"""
Collective Mind - Debate Engine
Ollama (local) with parallel agent calls for speed.
"""

import asyncio
import uuid
from typing import AsyncGenerator, Dict, List, Optional, TypedDict, Annotated
from datetime import datetime

import httpx
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

from agents.agent_definitions import AGENTS, get_all_agents, AgentDefinition

OLLAMA_URL   = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2"


class DebateState(TypedDict):
    question: str
    debate_id: str
    round: int
    max_rounds: int
    messages: Annotated[List[BaseMessage], add_messages]
    agent_positions: Dict[str, str]
    agent_opinions: Dict[str, List[str]]
    alliances: List[Dict]
    conflicts: List[Dict]
    consensus: Optional[str]
    consensus_score: float
    rag_context: Optional[str]
    status: str
    events: List[Dict]
    votes: Dict[str, str]


async def call_ollama(system_prompt: str, user_message: str, max_tokens: int = 250) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message}
        ],
        "stream": False,
        "options": {
            "temperature": 0.75,
            "num_predict": max_tokens,
            "num_ctx": 2048,
            "num_thread": 4
        }
    }
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
        resp.raise_for_status()
        return resp.json()["message"]["content"]


async def call_agent_async(agent: AgentDefinition, question: str,
                           debate_history: str, rag_context: Optional[str] = None,
                           instruction: Optional[str] = None) -> str:
    ctx   = f"\n\n📚 DOCUMENT (extrait):\n{rag_context[:700]}\n" if rag_context else ""
    hist  = f"\n\n💬 DÉBAT:\n{debate_history[:300]}\n" if debate_history else ""
    instr = f"\n\n📌 {instruction}" if instruction else ""
    msg   = f"QUESTION: {question}{ctx}{hist}{instr}\n\nDonne ton analyse en 3-4 phrases courtes en tant que {agent.name}."
    try:
        return await call_ollama(agent.system_prompt, msg, max_tokens=200)
    except Exception as e:
        err = str(e)
        if "timeout" in err.lower() or "timed out" in err.lower():
            return "Délai dépassé — Ollama surchargé. Essaie avec Rounds = 1 ou un document plus court."
        return f"Erreur Ollama: {err[:100]}"


def format_history(positions: Dict[str, str]) -> str:
    lines = []
    for aid, pos in positions.items():
        if aid in AGENTS and pos:
            a = AGENTS[aid]
            lines.append(f"[{a.emoji} {a.name}]: {pos[:200]}")
    return "\n\n".join(lines)


def detect_alliances_conflicts(positions: Dict) -> tuple:
    alliances, conflicts = [], []
    for a1, a2, topic in [("logique","scientifique","données"),("ethique","mediateur","valeurs"),("creatif","mediateur","vision")]:
        if a1 in positions and a2 in positions:
            alliances.append({"agent1":a1,"agent2":a2,"topic":topic})
    for a1, a2, topic in [("critique","creatif","réalisme vs innovation"),("logique","ethique","données vs valeurs")]:
        if a1 in positions and a2 in positions:
            conflicts.append({"agent1":a1,"agent2":a2,"topic":topic})
    return alliances, conflicts


async def generate_consensus(state: DebateState) -> str:
    med = AGENTS["mediateur"]
    positions = "\n\n".join(
        f"[{AGENTS[aid].emoji} {AGENTS[aid].name}]: {ops[-1][:200]}"
        for aid, ops in state["agent_opinions"].items()
        if aid in AGENTS and ops
    )
    prompt = f"""QUESTION: {state['question']}

POSITIONS:
{positions}

Génère un CONSENSUS FINAL en 200 mots max:
**SYNTHÈSE** (1-2 phrases)
**POINTS D'ACCORD** (3 points)
**RECOMMANDATIONS** (3 points numérotés)
**NIVEAU DE CONSENSUS**: XX%"""
    try:
        return await call_ollama(med.system_prompt, prompt, max_tokens=300)
    except Exception as e:
        return f"Consensus non généré. Erreur Ollama: {str(e)[:80]}"


class CollectiveMindEngine:
    def __init__(self):
        self.active_debates: Dict[str, DebateState] = {}

    async def run_debate_stream(self, question: str, max_rounds: int = 2,
                                 rag_context: Optional[str] = None) -> AsyncGenerator[Dict, None]:
        debate_id = str(uuid.uuid4())
        state: DebateState = {
            "question": question, "debate_id": debate_id,
            "round": 0, "max_rounds": max_rounds,
            "messages": [], "agent_positions": {},
            "agent_opinions": {aid: [] for aid in AGENTS},
            "alliances": [], "conflicts": [], "consensus": None,
            "consensus_score": 0.0, "rag_context": rag_context,
            "status": "debating", "events": [], "votes": {}
        }
        self.active_debates[debate_id] = state

        yield {
            "type": "debate_start", "debate_id": debate_id, "question": question,
            "agents": [{"id":a.id,"name":a.name,"role":a.role,"emoji":a.emoji,"color":a.color}
                       for a in get_all_agents()]
        }

        # Only 2 agents per group run in parallel (avoids Ollama overload)
        agent_order = ["logique", "creatif", "ethique", "critique", "scientifique", "memoire"]
        agent_groups = [agent_order[i:i+2] for i in range(0, len(agent_order), 2)]

        for round_num in range(1, max_rounds + 1):
            yield {"type":"round_start","round":round_num,"max_rounds":max_rounds,
                   "message":f"🔄 Round {round_num}/{max_rounds}"}

            for group in agent_groups:
                # Signal thinking
                for agent_id in group:
                    yield {"type":"agent_thinking","agent_id":agent_id,
                           "agent_name":AGENTS[agent_id].name,"message":"réfléchit..."}

                # Run group in parallel
                tasks = []
                for agent_id in group:
                    agent = AGENTS[agent_id]
                    history = format_history(state["agent_positions"])
                    instruction = "Réagis brièvement aux autres agents." if round_num > 1 else None
                    tasks.append(call_agent_async(
                        agent=agent, question=question, debate_history=history,
                        rag_context=rag_context if round_num == 1 else None,
                        instruction=instruction
                    ))

                responses = await asyncio.gather(*tasks, return_exceptions=True)

                for agent_id, response in zip(group, responses):
                    agent = AGENTS[agent_id]
                    if isinstance(response, Exception):
                        response = f"[Erreur: {str(response)[:60]}]"

                    state["agent_positions"][agent_id] = response
                    state["agent_opinions"][agent_id].append(response)
                    alliances, conflicts = detect_alliances_conflicts(state["agent_positions"])
                    state["alliances"] = alliances
                    state["conflicts"] = conflicts

                    yield {
                        "type": "agent_response",
                        "agent_id": agent_id,
                        "agent_name": agent.name,
                        "agent_emoji": agent.emoji,
                        "agent_color": agent.color,
                        "agent_role": agent.role,
                        "round": round_num,
                        "content": str(response),
                        "alliances": alliances,
                        "conflicts": conflicts,
                        "timestamp": datetime.now().isoformat()
                    }
                    await asyncio.sleep(0.1)

            state["round"] = round_num
            state["consensus_score"] = min(0.3 + round_num * 0.25, 0.75)
            yield {"type":"round_end","round":round_num,
                   "consensus_score":state["consensus_score"],
                   "alliances":state["alliances"],"conflicts":state["conflicts"]}

        yield {"type":"consensus_start","message":"🌐 Génération du consensus..."}
        consensus = await generate_consensus(state)
        state["consensus"] = consensus
        state["status"] = "complete"
        state["consensus_score"] = 0.82

        vote_map = {
            "logique":"approve","creatif":"approve","ethique":"approve",
            "critique":"abstain","scientifique":"approve","memoire":"approve"
        }
        state["votes"] = vote_map

        yield {
            "type": "consensus_ready",
            "consensus": consensus,
            "consensus_score": 0.82,
            "votes": vote_map,
            "alliances": state["alliances"],
            "conflicts": state["conflicts"],
            "agent_opinions": {
                aid: ops[-1][:200] if ops else ""
                for aid, ops in state["agent_opinions"].items()
            }
        }
        yield {"type":"debate_complete","debate_id":debate_id,"message":"Débat terminé."}
        self.active_debates[debate_id] = state

    def get_debate(self, debate_id: str) -> Optional[DebateState]:
        return self.active_debates.get(debate_id)


engine = CollectiveMindEngine()
