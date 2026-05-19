"""Extract text from PDF/DOCX/TXT resumes."""
import io
import logging
from pypdf import PdfReader
from docx import Document

logger = logging.getLogger(__name__)


def extract_text(filename: str, content: bytes) -> str:
    name = filename.lower()
    try:
        if name.endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            return "\n".join((p.extract_text() or "") for p in reader.pages).strip()
        if name.endswith(".docx"):
            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs).strip()
        if name.endswith(".txt"):
            return content.decode("utf-8", errors="ignore").strip()
    except Exception as e:
        logger.error("extract_text failed for %s: %s", filename, e)
        return ""
    return ""
