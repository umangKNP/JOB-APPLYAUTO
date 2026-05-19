"""Claude Sonnet 4.5 wrappers for resume parsing, match scoring, cover letter."""
import os, json, uuid, re, logging
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

KEY = os.environ.get("EMERGENT_LLM_KEY", "")
MODEL = ("anthropic", "claude-sonnet-4-5-20250929")


def _new_chat(system: str) -> LlmChat:
    return LlmChat(
        api_key=KEY,
        session_id=f"sess_{uuid.uuid4().hex[:10]}",
        system_message=system,
    ).with_model(*MODEL)


def _extract_json(text: str) -> dict:
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


async def parse_resume_ai(text: str) -> dict:
    chat = _new_chat(
        "You are an expert resume parser. Extract structured data. "
        "Return STRICT JSON with keys: skills (array of 10-20 short skill strings), "
        "summary (one paragraph career summary, max 60 words)."
    )
    msg = UserMessage(text=f"Resume text:\n\n{text[:8000]}\n\nReturn JSON only.")
    try:
        resp = await chat.send_message(msg)
        data = _extract_json(resp)
        return {
            "skills": [str(s) for s in data.get("skills", [])][:20],
            "summary": data.get("summary", "")[:500],
        }
    except Exception as e:
        logger.error("parse_resume_ai failed: %s", e, exc_info=True)
        return {"skills": [], "summary": "Resume uploaded successfully."}


async def score_match(title: str, jd: str, resume_text: str, resume_skills: list) -> dict:
    chat = _new_chat(
        "You are a senior technical recruiter. Score how well a resume matches a job description. "
        "Return STRICT JSON: { score (int 0-100), reasoning (1-2 sentences), "
        "matched_skills (array, 3-8 items), missing_skills (array, 0-6 items) }."
    )
    prompt = (
        f"JOB TITLE: {title}\n\nJOB DESCRIPTION:\n{jd[:4000]}\n\n"
        f"CANDIDATE SKILLS: {', '.join(resume_skills[:25])}\n\n"
        f"CANDIDATE RESUME (excerpt):\n{resume_text[:4000]}\n\n"
        "Return JSON only."
    )
    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        d = _extract_json(resp)
        return {
            "score": int(d.get("score", 0)),
            "reasoning": str(d.get("reasoning", ""))[:400],
            "matched_skills": [str(s) for s in d.get("matched_skills", [])][:10],
            "missing_skills": [str(s) for s in d.get("missing_skills", [])][:10],
        }
    except Exception as e:
        logger.error("score_match failed: %s", e, exc_info=True)
        return {"score": 50, "reasoning": "AI scoring temporarily unavailable.", "matched_skills": [], "missing_skills": []}


async def generate_cover_letter(name: str, job: dict, resume: dict) -> str:
    chat = _new_chat(
        "You are an expert career coach writing concise, personalised, professional cover letters "
        "for Australian job applications. Tone: confident but warm. Length: 220-280 words. "
        "Structure: 3 short paragraphs. No clichés like 'I am writing to express'. "
        "Reference specific JD requirements and candidate experience."
    )
    prompt = (
        f"Candidate name: {name}\n"
        f"Candidate summary: {resume.get('summary','')}\n"
        f"Candidate top skills: {', '.join(resume.get('skills', [])[:12])}\n\n"
        f"Job title: {job.get('title')}\n"
        f"Company: {job.get('company')}\n"
        f"Location: {job.get('location')}\n"
        f"Job description:\n{(job.get('description') or '')[:3500]}\n\n"
        "Write the cover letter now. Return plain text only, no preamble."
    )
    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        return str(resp).strip()
    except Exception as e:
        logger.error("generate_cover_letter failed: %s", e, exc_info=True)
        return "Unable to generate cover letter right now. Please try again in a moment."
