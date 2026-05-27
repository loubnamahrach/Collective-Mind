#  Collective Mind
### *Système d'Intelligence Émergente Multi-Agent basé sur LangGraph*

Un système multi-agent où 7 agents autonomes avec des personnalités distinctes débattent collectivement pour résoudre des problèmes complexes, recherchent des informations via RAG, et construisent un consensus validé par un humain.

---

##  Lancement rapide

### 1. Cloner et configurer
```bash
git clone https://github.com/loubnamahrach/Collective-Mind/
cd Collective-Mind
```

### 2. Backend
```bash
cd backend

# Installer les dépendances
pip install -r requirements.txt

# Configurer la clé API
cp .env.example .env
# Édite .env et ajoute ta clé Anthropic :
# ANTHROPIC_API_KEY=sk-ant-...

# Lancer le serveur
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend (dans un autre terminal)
```bash
cd frontend
npm install
npm start
# Ouvre http://localhost:3000
```

---

##  Architecture

```
collective-mind/
├── backend/
│   ├── main.py                    # FastAPI app + SSE streaming
│   ├── requirements.txt
│   ├── .env.example
│   ├── agents/
│   │   ├── agent_definitions.py   # 7 agents avec personnalités
│   │   └── debate_engine.py       # Orchestration LangGraph
│   └── rag/
│       └── retriever.py           # Module RAG (FAISS/ChromaDB-ready)
└── frontend/
    ├── package.json
    └── src/
        ├── App.js                 # Interface React complète
        └── App.css                # UI futuriste dark
```

---

##  Les 7 Agents

| Agent | Rôle | Personnalité |
|-------|------|-------------|
| 🔷 Agent Logique | Analyste Rationnel | Froid, précis, méthodique |
| ✨ Agent Créatif | Penseur Innovant | Visionnaire, disruptif, optimiste |
| ⚖️ Agent Éthique | Gardien Moral | Empathique, défenseur des droits |
| 🔍 Agent Critique | Avocat du Diable | Sceptique, cherche les failles |
| 🧩 Agent Mémoire | Archiviste Collectif | Synthétique, gardien de cohérence |
| 🔬 Agent Scientifique | Expert RAG | Empirique, data-driven |
| 🌐 Agent Médiateur | Architecte du Consensus | Diplomatique, constructeur de consensus |

---

## 🔄 Workflow

```
Question utilisateur
        ↓
   RAG Retrieval (enrichissement documentaire)
        ↓
   Round 1 : Chaque agent donne sa position initiale
        ↓
   Round 2 : Les agents réagissent aux autres, alliances/conflits émergent
        ↓
   Agent Médiateur : Génère le consensus
        ↓
   Validation humaine (approuver / rejeter)
```

---

##  API Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/agents` | Liste tous les agents |
| `POST` | `/debate/stream` | Lance un débat (Server-Sent Events) |
| `POST` | `/debate/validate` | Valide/rejette le consensus |
| `GET` | `/debate/{id}` | État d'un débat |
| `GET` | `/health` | Santé de l'API |

### Exemple cURL
```bash
curl -X POST http://localhost:8000/debate/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "Faut-il remplacer certains emplois par l IA ?", "max_rounds": 2, "use_rag": true}'
```

---

##  Fonctionnalités

- **Débat multi-rounds** : Les agents évoluent entre rounds 1 et 2
- **Détection d'alliances** : Logique + Scientifique, Éthique + Médiateur...
- **Détection de conflits** : Critique vs Créatif, Logique vs Éthique...
- **Streaming temps réel** : Server-Sent Events (SSE) pour affichage live
- **RAG intégré** : Enrichissement avec données contextuelles
- **Human-in-the-loop** : Validation finale par l'humain
- **Réseau d'agents animé** : Visualisation Canvas D3-like des interactions
- **Journal système** : Traçabilité complète du débat

---

##  Stack Technique

| Couche | Technologies |
|--------|-------------|
| LLM | Claude claude-sonnet-4-20250514 (Anthropic) |
| Orchestration | LangGraph + LangChain |
| Backend | FastAPI + Uvicorn |
| Streaming | Server-Sent Events (SSE) |
| RAG | Base de connaissances in-memory (FAISS-ready) |
| Frontend | React 18 |
| Visualisation | Canvas API (réseau d'agents) |
| Fonts | Space Mono + Syne (Google Fonts) |

---

##  Personnalisation

### Ajouter un agent
Dans `backend/agents/agent_definitions.py`, ajoute une entrée dans le dict `AGENTS` :
```python
"mon_agent": AgentDefinition(
    id="mon_agent",
    name="Agent XXX",
    role="Mon Rôle",
    emoji="🎯",
    color="#FF6B6B",
    personality="...",
    system_prompt="...",
    strengths=["..."],
    weaknesses=["..."],
    opinion_style="..."
)
```

### Ajouter des sources RAG
Dans `backend/rag/retriever.py`, enrichis le `KNOWLEDGE_BASE` :
```python
KNOWLEDGE_BASE["mon_sujet"] = """
Tes données factuelles ici...
"""
```
Pour la production, remplace par ChromaDB + HuggingFace Embeddings.

---

##  Évaluation des Prompts

Le projet permet de comparer différentes formulations de questions :

- **Prompt A** : `"Donne ton avis sur l'IA."`
- **Prompt B** : `"Analyse l'impact de l'IA générative selon des critères économiques, sociaux et éthiques."`

Mesure : cohérence du consensus, richesse des alliances/conflits, score final.

---

##  Présentation Académique

Ce projet démontre :
1. **Multi-Agent Systems** : 7 agents spécialisés avec mémoire et personnalité
2. **Emergent AI** : Le consensus émerge des interactions, pas d'une règle fixe
3. **LangGraph Orchestration** : Architecture hybride collaborative/hiérarchique/circulaire
4. **Human-AI Collaboration** : Validation humaine intégrée dans la boucle
5. **RAG Integration** : Enrichissement documentaire dynamique
6. **Real-time Streaming** : Architecture event-driven avec SSE

---

*Collective Mind — Intelligence Émergente Multi-Agent*
