"""
Collective Mind - File Processor
Extracts text from uploaded files (PDF, TXT, DOCX, CSV).
"""

import io
import os
from typing import Optional


def extract_text_from_file(filename: str, content: bytes) -> str:
    """Extract plain text from various file formats."""
    ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''

    if ext == 'txt':
        return _extract_txt(content)
    elif ext == 'pdf':
        return _extract_pdf(content)
    elif ext in ('docx', 'doc'):
        return _extract_docx(content)
    elif ext == 'csv':
        return _extract_csv(content)
    elif ext in ('md', 'markdown'):
        return _extract_txt(content)
    elif ext == 'json':
        return _extract_txt(content)
    else:
        # Try UTF-8 as fallback
        try:
            return content.decode('utf-8')
        except Exception:
            return f"[Format non supporté: {ext}]"


def _extract_txt(content: bytes) -> str:
    for enc in ('utf-8', 'latin-1', 'cp1252'):
        try:
            return content.decode(enc)
        except Exception:
            continue
    return content.decode('utf-8', errors='replace')


def _extract_pdf(content: bytes) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(content))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text.strip())
        return '\n\n'.join(pages)
    except ImportError:
        pass

    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text.strip())
        return '\n\n'.join(pages)
    except ImportError:
        pass

    return "[PDF reçu mais aucune librairie PDF installée. Installe: pip install pypdf]"


def _extract_docx(content: bytes) -> str:
    try:
        import docx
        doc = docx.Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return '\n\n'.join(paragraphs)
    except ImportError:
        return "[DOCX reçu mais python-docx non installé. Installe: pip install python-docx]"


def _extract_csv(content: bytes) -> str:
    import csv
    text = _extract_txt(content)
    lines = text.split('\n')[:50]  # limit to 50 rows for context
    return '\n'.join(lines)


def summarize_for_agents(filename: str, text: str, max_chars: int = 6000) -> str:
    """
    Prepare document text as RAG context for agents.
    Truncates intelligently if too long.
    """
    if len(text) <= max_chars:
        return f"📄 DOCUMENT DE RÉFÉRENCE: {filename}\n\n{text}"

    # Keep beginning + end (most important parts of a document)
    half = max_chars // 2
    truncated = text[:half] + f"\n\n[... {len(text) - max_chars} caractères omis ...]\n\n" + text[-half:]
    return f"📄 DOCUMENT DE RÉFÉRENCE: {filename}\n\n{truncated}"
