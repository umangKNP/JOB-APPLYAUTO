"""Fetch jobs from public Australian + free sources.
Sources:
- Adzuna AU (live API) — requires ADZUNA_APP_ID + ADZUNA_APP_KEY
- Remotive (public API)
- The Muse (public API)
- Workforce Australia / Jora / SEEK / LinkedIn - referenced via crafted search URLs
"""
import os
import asyncio
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import List
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

ADZUNA_APP_ID = os.environ.get("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.environ.get("ADZUNA_APP_KEY", "")


def _now():
    return datetime.now(timezone.utc)


def _strip_html(s: str) -> str:
    if not s:
        return ""
    return BeautifulSoup(s, "html.parser").get_text(" ", strip=True)


def _ensure_aware(dt):
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def _adzuna_au() -> List[dict]:
    """Adzuna AU — last 1 day, multiple pages for variety."""
    if not (ADZUNA_APP_ID and ADZUNA_APP_KEY):
        return []
    out: List[dict] = []
    async with httpx.AsyncClient(timeout=20) as hc:
        for page in (1, 2, 3, 4):
            try:
                url = (
                    f"https://api.adzuna.com/v1/api/jobs/au/search/{page}"
                    f"?app_id={ADZUNA_APP_ID}&app_key={ADZUNA_APP_KEY}"
                    f"&results_per_page=50&max_days_old=1&sort_by=date"
                )
                r = await hc.get(url)
                if r.status_code != 200:
                    logger.warning("Adzuna page %s status %s", page, r.status_code)
                    break
                data = r.json().get("results", [])
            except Exception as e:
                logger.error("Adzuna fetch failed: %s", e)
                break
            for j in data:
                try:
                    posted = _ensure_aware(datetime.fromisoformat(j["created"].replace("Z", "+00:00")))
                except Exception:
                    posted = _now()
                sal_min = j.get("salary_min")
                sal_max = j.get("salary_max")
                salary = None
                if sal_min and sal_max:
                    salary = f"${int(sal_min):,} – ${int(sal_max):,} AUD"
                elif sal_min:
                    salary = f"From ${int(sal_min):,} AUD"
                title = (j.get("title") or "").strip()
                out.append({
                    "source": "Adzuna AU",
                    "title": title,
                    "company": (j.get("company") or {}).get("display_name", ""),
                    "location": (j.get("location") or {}).get("display_name", "Australia"),
                    "salary": salary,
                    "description": _strip_html(j.get("description", ""))[:6000],
                    "url": j.get("redirect_url", ""),
                    "posted_at": posted,
                    "job_type": (j.get("contract_time") or "full-time"),
                    "is_graduate": any(k in title.lower() for k in ("graduate", "intern", "junior", "entry")),
                })
    return out


async def _remotive() -> List[dict]:
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.get("https://remotive.com/api/remote-jobs?limit=40")
        data = r.json().get("jobs", [])
    except Exception:
        return []
    out = []
    for j in data:
        try:
            posted = _ensure_aware(datetime.fromisoformat(j["publication_date"].replace("Z", "+00:00")))
        except Exception:
            posted = _now()
        title = (j.get("title") or "").lower()
        out.append({
            "source": "Remotive",
            "title": j.get("title", ""),
            "company": j.get("company_name", ""),
            "location": j.get("candidate_required_location", "Remote"),
            "salary": j.get("salary") or None,
            "description": _strip_html(j.get("description", ""))[:6000],
            "url": j.get("url", ""),
            "posted_at": posted,
            "job_type": j.get("job_type", "remote"),
            "is_graduate": "graduate" in title or "junior" in title or "intern" in title,
        })
    return out


async def _themuse() -> List[dict]:
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.get("https://www.themuse.com/api/public/jobs?page=0&descending=true")
        data = r.json().get("results", [])
    except Exception:
        return []
    out = []
    for j in data:
        try:
            posted = _ensure_aware(datetime.fromisoformat(j["publication_date"].replace("Z", "+00:00")))
        except Exception:
            posted = _now()
        locs = j.get("locations") or []
        loc = ", ".join(l.get("name", "") for l in locs[:2]) or "Flexible"
        company = (j.get("company") or {}).get("name", "")
        title = (j.get("name") or "").lower()
        out.append({
            "source": "The Muse",
            "title": j.get("name", ""),
            "company": company,
            "location": loc,
            "salary": None,
            "description": _strip_html(j.get("contents", ""))[:6000],
            "url": (j.get("refs") or {}).get("landing_page", ""),
            "posted_at": posted,
            "job_type": (j.get("type") or "").lower(),
            "is_graduate": "graduate" in title or "intern" in title or "junior" in title,
        })
    return out


def _seed_au_jobs() -> List[dict]:
    """Disabled: previously returned placeholder roles with non-specific URLs.
    Removed because the apply links pointed to source search pages rather than
    actual job postings — misleading for users.

    All jobs in the feed now come from real, click-able APIs:
    - Adzuna AU (live, with real redirect URLs to SEEK/Indeed/Jora/etc.)
    - Remotive (live remote roles)
    - The Muse (live tech/creative roles)
    """
    return []


async def fetch_all_jobs() -> List[dict]:
    adz, rem, mus = await asyncio.gather(_adzuna_au(), _remotive(), _themuse())
    cutoff_12 = _now() - timedelta(hours=12)
    cutoff_7d = _now() - timedelta(days=7)
    combined = adz + rem + mus
    recent = [j for j in combined if j["posted_at"] >= cutoff_12]
    if len(recent) < 20:
        recent = [j for j in combined if j["posted_at"] >= cutoff_7d]
    recent.sort(key=lambda x: x["posted_at"], reverse=True)
    return recent[:200]
