"""Extract text from PDF/DOCX/TXT resumes.
Strategy:
1. PDF → pypdf (fast, works for digital PDFs).
2. If extracted text is too short (<60 chars) → fall back to OCR via pdf2image + tesseract.
3. DOCX → python-docx.
4. TXT → utf-8 decode.
"""
import io
import logging
from pypdf import PdfReader
from docx import Document

logger = logging.getLogger(__name__)


def _ocr_pdf(content: bytes) -> str:
    """OCR a PDF (image-based). Returns empty string on failure."""
    try:
        from pdf2image import convert_from_bytes
        import pytesseract
        pages = convert_from_bytes(content, dpi=200, first_page=1, last_page=6)
        out = []
        for img in pages:
            try:
                out.append(pytesseract.image_to_string(img))
            except Exception as e:
                logger.warning("OCR page failed: %s", e)
        return "\n".join(out).strip()
    except Exception as e:
        logger.warning("OCR fallback failed: %s", e)
        return ""


def extract_text(filename: str, content: bytes) -> str:
    name = filename.lower()
    try:
        if name.endswith(".pdf"):
            text = ""
            try:
                reader = PdfReader(io.BytesIO(content))
                text = "\n".join((p.extract_text() or "") for p in reader.pages).strip()
            except Exception as e:
                logger.warning("pypdf failed for %s: %s", filename, e)
            if len(text) < 60:
                logger.info("PDF text was thin (%s chars) — trying OCR for %s", len(text), filename)
                ocr_text = _ocr_pdf(content)
                if len(ocr_text) > len(text):
                    text = ocr_text
            return text
        if name.endswith(".docx"):
            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs).strip()
        if name.endswith(".txt"):
            return content.decode("utf-8", errors="ignore").strip()
    except Exception as e:
        logger.error("extract_text failed for %s: %s", filename, e)
        return ""
    return ""
