"""Fast ATS-style keyword matching — no LLM calls, instant.

Scoring strategy:
- Tokenise the job (title weighted 3x, description 1x) into lowercase word/phrase tokens.
- For each resume keyword (skills + adjacent), check exact / token / substring presence in the job blob.
- Score = (weighted matched keywords / total keywords) * 100, capped at 100.
- Title-keyword matches add a big bonus.
"""
import re
from typing import Iterable

_word_re = re.compile(r"[a-z0-9\+\#\.]+")


def _tokenise(text: str) -> set:
    if not text:
        return set()
    return set(_word_re.findall(text.lower()))


def _normalise(kw: str) -> str:
    return kw.strip().lower()


def _phrase_present(phrase: str, blob: str) -> bool:
    """Match multi-word phrases with word boundaries; fall back to substring.
    Skip short (<3 char) phrases to avoid false positives like 'C' matching every word."""
    if not phrase or not blob or len(phrase) < 3:
        return False
    pattern = r"\b" + re.escape(phrase) + r"\b"
    return re.search(pattern, blob) is not None


def keyword_score(job: dict, resume: dict) -> dict:
    """Return {score, matched_skills, missing_skills, title_hits}."""
    title = (job.get("title") or "").lower()
    desc = (job.get("description") or "").lower()

    title_tokens = _tokenise(title)
    desc_tokens = _tokenise(desc)

    skills = [_normalise(s) for s in (resume.get("skills") or []) if s]
    adjacent = [_normalise(s) for s in (resume.get("adjacent_skills") or []) if s]
    role_titles = [_normalise(s) for s in (resume.get("role_titles") or []) if s]

    all_kw: list = list(dict.fromkeys(skills + adjacent))  # de-dupe preserve order
    if not all_kw and not role_titles:
        return {"score": 0, "matched_skills": [], "missing_skills": [], "title_hits": []}

    matched: list = []
    missing: list = []
    title_hits: list = []

    # Skill keyword matching
    for kw in all_kw:
        kw_tokens = _tokenise(kw)
        in_title = bool(kw_tokens & title_tokens) or _phrase_present(kw, title)
        in_desc = bool(kw_tokens & desc_tokens) or _phrase_present(kw, desc)
        if in_title or in_desc:
            matched.append(kw)
            if in_title:
                title_hits.append(kw)
        else:
            missing.append(kw)

    # Role-title overlap (heavy weight)
    role_hit = False
    for rt in role_titles:
        if _phrase_present(rt, title) or _phrase_present(rt, desc):
            role_hit = True
            if rt not in title_hits and _phrase_present(rt, title):
                title_hits.append(rt)
            break

    # Scoring: reward actual signal, don't punish breadth of skills
    matched_count = len(matched)
    # Base: 0 matches = 0; 1 match = 18; 3 = 45; 5 = 60; 8+ = 75 (saturating)
    base = min(matched_count * 12 + (matched_count ** 1.3), 75) if matched_count else 0
    title_bonus = min(len(title_hits) * 10, 25)
    role_bonus = 22 if role_hit else 0
    score = min(round(base + title_bonus + role_bonus), 100)

    return {
        "score": score,
        "matched_skills": matched[:12],
        "missing_skills": missing[:8],
        "title_hits": title_hits[:6],
    }


def best_match(job: dict, resumes: list) -> dict | None:
    """Score job against every resume; return the highest with resume metadata."""
    if not resumes:
        return None
    best = None
    for r in resumes:
        ks = keyword_score(job, r)
        if best is None or ks["score"] > best["score"]:
            best = {
                **ks,
                "resume_id": r["resume_id"],
                "resume_name": r["name"],
            }
    return best
