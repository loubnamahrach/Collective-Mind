"""
Collective Mind - RAG Module (Ollama version)
"""

import httpx
from typing import Optional

OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2"

KNOWLEDGE_BASE = {
    "chômage": """
    Selon l'OCDE (2023), le taux de chômage moyen dans les pays développés est de 4,9%.
    McKinsey (2023) estime que 30% des tâches actuelles pourraient être automatisées d'ici 2030.
    Le Forum Économique Mondial (2024) prédit que l'IA créera 97M de nouveaux emplois et en supprimera 85M.
    Les travailleurs à faible revenu sont 14x plus exposés à l'automatisation (Brookings, 2023).
    """,
    "intelligence artificielle": """
    L'IA générative a atteint 1,3 trillion USD de valeur de marché en 2024 (Goldman Sachs).
    35% des entreprises utilisent déjà l'IA dans au moins une fonction métier (Stanford HAI, 2024).
    L'IA améliore la productivité de 14-40% selon les secteurs (Nature, 2023).
    """,
    "éthique": """
    Le règlement européen AI Act (2024) classe les systèmes IA par niveau de risque.
    78% des algorithmes de recrutement présentent des biais mesurables (MIT, 2023).
    52% des Américains s'inquiètent de l'impact de l'IA sur l'emploi (Pew Research, 2024).
    """,
    "default": """
    Sources: rapports OCDE, McKinsey Global Institute, Forum Économique Mondial,
    Stanford HAI 2024, Nature Machine Intelligence, MIT Technology Review.
    """
}


def retrieve_context(question: str) -> str:
    question_lower = question.lower()
    chunks = []
    for keyword, content in KNOWLEDGE_BASE.items():
        if keyword == "default":
            continue
        if keyword in question_lower:
            chunks.append(content.strip())
    if not chunks:
        chunks = [KNOWLEDGE_BASE["default"]]
    return "\n\n".join(chunks[:2])


async def enrich_with_rag(question: str) -> str:
    context = retrieve_context(question)
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{
            "role": "user",
            "content": f"""Question débattue: "{question}"

Données documentaires:
{context}

Résume les 3-4 faits les plus pertinents en 150 mots max. Sois factuel."""
        }],
        "stream": False,
        "options": {"num_predict": 200}
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            resp.raise_for_status()
            return resp.json()["message"]["content"]
    except Exception as e:
        return context[:400]
