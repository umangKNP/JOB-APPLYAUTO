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


_PARSE_EXAMPLE = """EXAMPLE INPUT
----
Jane Smith · Sydney, NSW · jane@email.com
Senior Software Engineer

EXPERIENCE
Senior Software Engineer @ Canva (2022-2026)
- Led migration of design tools microservice from Rails to Go, cut p95 latency by 40%
- Mentored 4 junior engineers; ran weekly Go/AWS workshops
- Stack: Go, gRPC, AWS (ECS, RDS Aurora, DynamoDB, S3), Terraform, Datadog

Software Engineer @ Atlassian (2019-2022)
- Built Jira Automation features used by 50k+ teams; React + TypeScript + Java/Spring
- Migrated 200+ unit tests from Mocha to Jest

EDUCATION
BSc Computer Science · UNSW · 2019

CERTIFICATIONS
AWS Solutions Architect Associate · CKAD · Hashicorp Terraform Associate

LANGUAGES
English (native), Mandarin (fluent)

EXAMPLE OUTPUT (JSON only)
{
  "skills": ["Go", "Python", "AWS", "Terraform", "React", "TypeScript", "gRPC", "Microservices", "Datadog", "Java", "Spring", "PostgreSQL", "DynamoDB", "Jest", "CI/CD"],
  "adjacent_skills": ["Kubernetes", "Docker", "Ruby on Rails", "Node.js", "GraphQL", "Redis", "Prometheus", "GitHub Actions", "EKS", "Lambda", "CloudFormation", "Helm"],
  "role_titles": ["Senior Software Engineer", "Backend Engineer", "Staff Software Engineer", "Tech Lead"],
  "tools": ["AWS ECS", "RDS Aurora", "DynamoDB", "S3", "Terraform", "Datadog", "Jira", "GitHub"],
  "soft_skills": ["Mentoring", "Technical leadership", "Workshop facilitation"],
  "education": ["BSc Computer Science, UNSW, 2019"],
  "certifications": ["AWS Solutions Architect Associate", "CKAD", "Hashicorp Terraform Associate"],
  "languages": ["English (native)", "Mandarin (fluent)"],
  "achievements": ["Cut p95 latency by 40% via microservice migration", "Mentored 4 junior engineers", "Built Jira Automation used by 50k+ teams"],
  "years_experience": 7,
  "seniority": "senior",
  "summary": "Senior full-stack engineer with 7 years' experience scaling Australian SaaS platforms. Specialises in Go, AWS infrastructure, and team mentorship — most recent impact was a 40% latency cut at Canva.",
  "ats_score": 88,
  "ats_tips": ["Add a 'Skills' section header (currently inferred from bullets)", "Consider listing measurable impact for the Atlassian role too", "Add LinkedIn URL to header for recruiter reach"]
}
----"""


async def parse_resume_ai(text: str) -> dict:
    chat = _new_chat(
        "You are a world-class ATS resume parser and Australian recruiting expert. "
        "Extract structured, comprehensive keyword data for job matching. Be exhaustive but precise. "
        "Return STRICT JSON only — no preamble, no markdown fences."
    )
    user_prompt = (
        f"{_PARSE_EXAMPLE}\n\n"
        "Now parse the following resume the same way. Return JSON with these keys: "
        "skills (15-30 specific technical/tool/domain keywords exactly as they'd appear in a JD), "
        "adjacent_skills (10-20 closely-related keywords, synonyms, and adjacent tech the candidate could plausibly do — "
        "e.g. if 'React' → add 'Next.js', 'TypeScript'; if 'AWS' → add 'GCP', 'Azure', 'CloudFormation'; "
        "if 'Marketing' → add 'Hubspot', 'Campaign management', 'SEO'), "
        "role_titles (3-7 job titles this resume targets, including more senior variants), "
        "tools (8-15 specific products/platforms), "
        "soft_skills (4-8 e.g. 'Stakeholder management', 'Mentoring'), "
        "education (array of strings), certifications (array), languages (array), "
        "achievements (4-8 measurable impact bullets in 1 sentence each), "
        "years_experience (integer), seniority ('graduate'|'junior'|'mid'|'senior'|'lead'|'principal'), "
        "summary (one paragraph, <=70 words), "
        "ats_score (0-100, how ATS-friendly the resume is — clear sections, parseable text, quantified impact, no graphics-only content), "
        "ats_tips (3-5 specific improvements to boost the score).\n\n"
        f"RESUME TEXT:\n```\n{text[:14000]}\n```\n\nReturn JSON only."
    )
    try:
        resp = await chat.send_message(UserMessage(text=user_prompt))
        data = _extract_json(resp)
        return {
            "skills": [str(s) for s in data.get("skills", [])][:30],
            "adjacent_skills": [str(s) for s in data.get("adjacent_skills", [])][:20],
            "role_titles": [str(s) for s in data.get("role_titles", [])][:7],
            "tools": [str(s) for s in data.get("tools", [])][:15],
            "soft_skills": [str(s) for s in data.get("soft_skills", [])][:8],
            "education": [str(s) for s in data.get("education", [])][:6],
            "certifications": [str(s) for s in data.get("certifications", [])][:10],
            "languages": [str(s) for s in data.get("languages", [])][:6],
            "achievements": [str(s) for s in data.get("achievements", [])][:8],
            "years_experience": int(data.get("years_experience") or 0),
            "seniority": str(data.get("seniority") or "").lower(),
            "summary": str(data.get("summary", ""))[:500],
            "ats_score": max(0, min(100, int(data.get("ats_score") or 0))),
            "ats_tips": [str(s) for s in data.get("ats_tips", [])][:6],
        }
    except Exception as e:
        logger.error("parse_resume_ai failed: %s", e, exc_info=True)
        return {
            "skills": [], "adjacent_skills": [], "role_titles": [], "tools": [],
            "soft_skills": [], "education": [], "certifications": [], "languages": [],
            "achievements": [], "years_experience": 0, "seniority": "",
            "summary": "Resume uploaded successfully.",
            "ats_score": 0, "ats_tips": [],
        }


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
