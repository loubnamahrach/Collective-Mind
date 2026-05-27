"""
Collective Mind - FastAPI Backend
REST + SSE endpoints with file upload support.
"""

import asyncio
import base64
import json
import os
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.debate_engine import engine, get_all_agents
from agents.agent_definitions import AGENTS
from rag.retriever import enrich_with_rag
from rag.file_processor import extract_text_from_file, summarize_for_agents


# ── App ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🧠 Collective Mind API starting...")
    yield

app = FastAPI(title="Collective Mind API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory document store: session_id -> {filename, text}
document_store: dict = {}


# ── Models ────────────────────────────────────────────────────

class DebateRequest(BaseModel):
    question: str
    max_rounds: int = 2
    use_rag: bool = True
    document_id: Optional[str] = None   # reference to uploaded doc


class HumanValidation(BaseModel):
    debate_id: str
    decision: str
    comment: Optional[str] = None
    modified_consensus: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"name": "Collective Mind", "version": "1.0.0", "status": "operational", "agents": len(AGENTS)}


@app.get("/agents")
async def get_agents():
    return {"agents": [
        {"id": a.id, "name": a.name, "role": a.role, "emoji": a.emoji,
         "color": a.color, "personality": a.personality,
         "strengths": a.strengths, "weaknesses": a.weaknesses}
        for a in get_all_agents()
    ]}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a reference document (PDF, TXT, DOCX, CSV, MD).
    Returns a document_id to use when starting a debate.
    """
    MAX_SIZE = 10 * 1024 * 1024  # 10 MB
    content = await file.read()

    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop grand (max 10MB)")

    filename = file.filename or "document"
    ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
    allowed = {'txt', 'pdf', 'docx', 'doc', 'csv', 'md', 'markdown', 'json'}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Format non supporté: .{ext}. Formats acceptés: {', '.join(allowed)}")

    # Extract text
    text = extract_text_from_file(filename, content)

    if not text.strip():
        raise HTTPException(status_code=422, detail="Impossible d'extraire du texte de ce fichier")

    # Store with simple ID
    import uuid
    doc_id = str(uuid.uuid4())
    document_store[doc_id] = {
        "filename": filename,
        "text": text,
        "size": len(content),
        "char_count": len(text),
        "ext": ext
    }

    return {
        "document_id": doc_id,
        "filename": filename,
        "char_count": len(text),
        "preview": text[:300].replace('\n', ' ') + ("..." if len(text) > 300 else ""),
        "message": "Document prêt pour le débat"
    }


@app.delete("/upload/{document_id}")
async def delete_document(document_id: str):
    if document_id in document_store:
        del document_store[document_id]
        return {"deleted": True}
    raise HTTPException(status_code=404, detail="Document introuvable")


@app.post("/debate/stream")
async def stream_debate(request: DebateRequest):
    """Start a debate and stream SSE events."""

    async def event_generator():
        try:
            rag_context = None

            # 1. Inject uploaded document if provided
            if request.document_id and request.document_id in document_store:
                doc = document_store[request.document_id]
                doc_context = summarize_for_agents(doc["filename"], doc["text"])
                yield f"data: {json.dumps({'type': 'document_loaded', 'filename': doc['filename'], 'char_count': doc['char_count']})}\n\n"
                rag_context = doc_context

            # 2. Optionally enrich with RAG knowledge base
            if request.use_rag:
                try:
                    kb_context = await enrich_with_rag(request.question)
                    if rag_context:
                        rag_context = rag_context + "\n\n---\n\n📚 DONNÉES CONTEXTUELLES:\n" + kb_context
                    else:
                        rag_context = kb_context
                    yield f"data: {json.dumps({'type': 'rag_ready', 'context_preview': kb_context[:120] + '...'})}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'rag_error', 'message': str(e)[:80]})}\n\n"

            # 3. Stream debate
            async for event in engine.run_debate_stream(
                question=request.question,
                max_rounds=request.max_rounds,
                rag_context=rag_context
            ):
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.05)

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}
    )


@app.post("/debate/validate")
async def validate_debate(validation: HumanValidation):
    debate = engine.get_debate(validation.debate_id)
    if not debate:
        raise HTTPException(status_code=404, detail="Débat introuvable")
    return {
        "debate_id": validation.debate_id,
        "decision": validation.decision,
        "final_consensus": validation.modified_consensus or debate.get("consensus", ""),
        "comment": validation.comment,
        "status": "validated" if validation.decision == "approve" else "rejected"
    }


@app.get("/debate/{debate_id}")
async def get_debate_state(debate_id: str):
    debate = engine.get_debate(debate_id)
    if not debate:
        raise HTTPException(status_code=404, detail="Débat introuvable")
    return {
        "debate_id": debate_id, "question": debate["question"],
        "round": debate["round"], "status": debate["status"],
        "consensus_score": debate["consensus_score"],
        "consensus": debate.get("consensus"),
        "alliances": debate.get("alliances", []),
        "conflicts": debate.get("conflicts", []),
        "votes": debate.get("votes", {})
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "active_debates": len(engine.active_debates), "documents": len(document_store)}
