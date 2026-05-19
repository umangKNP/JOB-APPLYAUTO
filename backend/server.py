"""ApplyMate AU - Job aggregator + AI matching backend"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=True)

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Request, Response, Cookie, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os, uuid, logging, base64, asyncio
import httpx

from services.resume_parser import extract_text
from services.llm import parse_resume_ai, score_match, generate_cover_letter
from services.jobs import fetch_all_jobs
from services.email import send_digest_email
from services.matching import best_match, keyword_score

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="ApplyMate AU")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# -------------------- Models --------------------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class Resume(BaseModel):
    resume_id: str
    user_id: str
    name: str
    tag: str
    filename: str
    content_text: str
    skills: List[str] = []
    adjacent_skills: List[str] = []
    role_titles: List[str] = []
    years_experience: int = 0
    summary: str = ""
    created_at: datetime

class Job(BaseModel):
    job_id: str
    source: str
    title: str
    company: str
    location: str
    salary: Optional[str] = None
    description: str
    url: str
    posted_at: datetime
    fetched_at: datetime
    job_type: Optional[str] = None
    is_graduate: bool = False

class JobMatchData(BaseModel):
    resume_id: str
    resume_name: str
    score: int
    reasoning: str
    matched_skills: List[str]
    missing_skills: List[str]

class Application(BaseModel):
    app_id: str
    user_id: str
    job_id: str
    resume_id: Optional[str] = None
    status: str  # saved, applied, interview, offer, rejected
    notes: str = ""
    cover_letter: str = ""
    created_at: datetime
    updated_at: datetime

class Preferences(BaseModel):
    user_id: str
    target_roles: List[str] = []
    locations: List[str] = ["Australia"]
    salary_min: int = 0
    remote_ok: bool = True
    graduate_only: bool = False


# -------------------- Auth helpers --------------------
async def get_current_user(request: Request) -> User:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid session")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")
    udoc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not udoc:
        raise HTTPException(401, "User not found")
    return User(**udoc)


# -------------------- Auth Routes --------------------
@api.post("/auth/google")
async def google_auth(request: Request, response: Response):
    body = await request.json()
    sid = body.get("session_id")
    if not sid:
        raise HTTPException(400, "session_id required")
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": sid}
        )
    if r.status_code != 200:
        raise HTTPException(401, "Auth failed")
    data = r.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        uid = existing["user_id"]
        await db.users.update_one({"user_id": uid}, {"$set": {"name": data["name"], "picture": data.get("picture")}})
    else:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": uid, "email": email, "name": data["name"],
            "picture": data.get("picture"), "created_at": datetime.now(timezone.utc).isoformat()
        })
        # default prefs
        await db.preferences.insert_one({
            "user_id": uid, "target_roles": [], "locations": ["Australia"],
            "salary_min": 0, "remote_ok": True, "graduate_only": False
        })
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": uid, "session_token": data["session_token"],
        "expires_at": expires.isoformat()
    })
    response.set_cookie(
        "session_token", data["session_token"],
        max_age=7*24*3600, httponly=True, secure=True, samesite="none", path="/"
    )
    udoc = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if isinstance(udoc.get("created_at"), str):
        udoc["created_at"] = datetime.fromisoformat(udoc["created_at"])
    return User(**udoc)


@api.get("/auth/me", response_model=User)
async def me(user: User = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# -------------------- Resume Routes --------------------
@api.post("/resumes")
async def upload_resume(
    file: UploadFile = File(...),
    name: str = Form(...),
    tag: str = Form(...),
    user: User = Depends(get_current_user),
):
    count = await db.resumes.count_documents({"user_id": user.user_id})
    if count >= 5:
        raise HTTPException(400, "Max 5 resumes allowed. Please delete one first.")
    content = await file.read()
    text = extract_text(file.filename, content)
    if not text or len(text) < 30:
        raise HTTPException(400, "Could not extract text from file. Use PDF or DOCX.")
    parsed = await parse_resume_ai(text)
    rid = f"res_{uuid.uuid4().hex[:10]}"
    doc = {
        "resume_id": rid, "user_id": user.user_id, "name": name, "tag": tag,
        "filename": file.filename, "content_text": text[:50000],
        "file_b64": base64.b64encode(content).decode(),
        "skills": parsed.get("skills", []),
        "adjacent_skills": parsed.get("adjacent_skills", []),
        "role_titles": parsed.get("role_titles", []),
        "years_experience": parsed.get("years_experience", 0),
        "summary": parsed.get("summary", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.resumes.insert_one(doc)
    doc.pop("file_b64", None)
    doc.pop("_id", None)
    doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return Resume(**doc)


@api.get("/resumes", response_model=List[Resume])
async def list_resumes(user: User = Depends(get_current_user)):
    rows = await db.resumes.find({"user_id": user.user_id}, {"_id": 0, "file_b64": 0}).sort("created_at", -1).to_list(20)
    for r in rows:
        if isinstance(r.get("created_at"), str):
            r["created_at"] = datetime.fromisoformat(r["created_at"])
    return [Resume(**r) for r in rows]


@api.delete("/resumes/{resume_id}")
async def delete_resume(resume_id: str, user: User = Depends(get_current_user)):
    r = await db.resumes.delete_one({"resume_id": resume_id, "user_id": user.user_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# -------------------- Job Routes --------------------
@api.post("/jobs/fetch")
async def trigger_fetch(user: User = Depends(get_current_user)):
    """Fetch jobs from public sources, save to DB."""
    jobs = await fetch_all_jobs()
    by_source: dict = {}
    for j in jobs:
        by_source[j["source"]] = by_source.get(j["source"], 0) + 1
    saved = 0
    for j in jobs:
        existing = await db.jobs.find_one({"source": j["source"], "url": j["url"], "title": j["title"]}, {"_id": 0})
        if existing:
            continue
        j["job_id"] = f"job_{uuid.uuid4().hex[:10]}"
        j["fetched_at"] = datetime.now(timezone.utc).isoformat()
        if isinstance(j.get("posted_at"), datetime):
            j["posted_at"] = j["posted_at"].isoformat()
        await db.jobs.insert_one(j)
        saved += 1
    return {"fetched": len(jobs), "saved": saved, "by_source": by_source}


@api.get("/jobs")
async def list_jobs(
    source: Optional[str] = None,
    location: Optional[str] = None,
    graduate_only: bool = False,
    min_score: int = 20,
    limit: int = 200,
    user: User = Depends(get_current_user),
):
    q: dict = {}
    if source and source != "all":
        q["source"] = source
    if location:
        q["location"] = {"$regex": location, "$options": "i"}
    if graduate_only:
        q["is_graduate"] = True
    # fetch a wide pool to score (don't limit by date here — let scoring decide relevance)
    pool_limit = max(limit * 5, 300)
    rows = await db.jobs.find(q, {"_id": 0}).sort("posted_at", -1).limit(pool_limit).to_list(pool_limit)
    # user resumes (no file_b64) for matching
    resumes = await db.resumes.find({"user_id": user.user_id}, {"_id": 0, "file_b64": 0}).to_list(10)
    has_resumes = len(resumes) > 0

    # AI-cached deep scores
    job_ids = [r["job_id"] for r in rows]
    ai_matches = await db.matches.find({"user_id": user.user_id, "job_id": {"$in": job_ids}}, {"_id": 0}).to_list(2000)
    ai_by_job: dict = {}
    for m in ai_matches:
        ai_by_job.setdefault(m["job_id"], []).append(m)
    apps = await db.applications.find({"user_id": user.user_id, "job_id": {"$in": job_ids}}, {"_id": 0}).to_list(1000)
    apps_by_job = {a["job_id"]: a for a in apps}

    out: list = []
    for r in rows:
        # instant keyword score against best resume
        ks_best = best_match(r, resumes) if has_resumes else None
        # also list per-resume keyword scores for the detail page
        per_resume = []
        if has_resumes:
            for res in resumes:
                ks = keyword_score(r, res)
                per_resume.append({
                    "resume_id": res["resume_id"],
                    "resume_name": res["name"],
                    **ks,
                })
        ai_list = ai_by_job.get(r["job_id"], [])
        # use AI score if available, else keyword
        if ai_list:
            ai_best = max(ai_list, key=lambda x: x["score"])
            display_best = {"resume_id": ai_best["resume_id"], "resume_name": ai_best["resume_name"],
                            "score": ai_best["score"], "source": "ai",
                            "matched_skills": ai_best.get("matched_skills", []),
                            "missing_skills": ai_best.get("missing_skills", [])}
        elif ks_best:
            display_best = {**ks_best, "source": "keyword"}
        else:
            display_best = None
        score_for_filter = display_best["score"] if display_best else 0
        if has_resumes and score_for_filter < min_score:
            continue
        r["matches"] = per_resume
        r["ai_matches"] = ai_list
        r["best_match"] = display_best
        r["application"] = apps_by_job.get(r["job_id"])
        out.append(r)
    # sort by score DESC, then posted_at DESC
    out.sort(key=lambda j: ((j.get("best_match") or {}).get("score", 0), j.get("posted_at", "")), reverse=True)
    return out[:limit]


@api.post("/jobs/{job_id}/match")
async def match_job(job_id: str, user: User = Depends(get_current_user)):
    job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    resumes = await db.resumes.find({"user_id": user.user_id}, {"_id": 0, "file_b64": 0}).to_list(10)
    if not resumes:
        raise HTTPException(400, "Upload a resume first")
    # parallel scoring
    results = await asyncio.gather(*[
        score_match(job["title"], job["description"], r["content_text"], r["skills"])
        for r in resumes
    ])
    out = []
    for r, res in zip(resumes, results):
        m = {
            "match_id": f"m_{uuid.uuid4().hex[:8]}",
            "user_id": user.user_id, "job_id": job_id, "resume_id": r["resume_id"],
            "resume_name": r["name"],
            "score": res["score"],
            "reasoning": res["reasoning"],
            "matched_skills": res["matched_skills"],
            "missing_skills": res["missing_skills"],
        }
        await db.matches.update_one(
            {"user_id": user.user_id, "job_id": job_id, "resume_id": r["resume_id"]},
            {"$set": m}, upsert=True
        )
        out.append(m)
    return out


@api.post("/jobs/{job_id}/cover-letter")
async def cover_letter(job_id: str, user: User = Depends(get_current_user)):
    job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    matches = await db.matches.find({"user_id": user.user_id, "job_id": job_id}, {"_id": 0}).to_list(10)
    if not matches:
        # auto match
        await match_job(job_id, user)
        matches = await db.matches.find({"user_id": user.user_id, "job_id": job_id}, {"_id": 0}).to_list(10)
    best = max(matches, key=lambda x: x["score"])
    resume = await db.resumes.find_one({"resume_id": best["resume_id"]}, {"_id": 0, "file_b64": 0})
    cl = await generate_cover_letter(user.name, job, resume)
    return {"resume_id": best["resume_id"], "resume_name": resume["name"], "score": best["score"], "cover_letter": cl}


# -------------------- Application Routes --------------------
@api.post("/applications")
async def create_application(payload: dict, user: User = Depends(get_current_user)):
    aid = f"app_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    set_fields = {
        "user_id": user.user_id,
        "job_id": payload["job_id"],
        "resume_id": payload.get("resume_id"),
        "status": payload.get("status", "saved"),
        "notes": payload.get("notes", ""),
        "cover_letter": payload.get("cover_letter", ""),
        "updated_at": now,
    }
    await db.applications.update_one(
        {"user_id": user.user_id, "job_id": payload["job_id"]},
        {"$set": set_fields,
         "$setOnInsert": {"created_at": now, "app_id": aid}},
        upsert=True,
    )
    saved = await db.applications.find_one({"user_id": user.user_id, "job_id": payload["job_id"]}, {"_id": 0})
    return saved


@api.get("/applications")
async def list_applications(user: User = Depends(get_current_user)):
    apps = await db.applications.find({"user_id": user.user_id}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    # attach job data
    job_ids = [a["job_id"] for a in apps]
    jobs = await db.jobs.find({"job_id": {"$in": job_ids}}, {"_id": 0}).to_list(1000)
    by_id = {j["job_id"]: j for j in jobs}
    for a in apps:
        a["job"] = by_id.get(a["job_id"])
    return apps


@api.patch("/applications/{app_id}")
async def update_application(app_id: str, payload: dict, user: User = Depends(get_current_user)):
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = await db.applications.update_one(
        {"app_id": app_id, "user_id": user.user_id},
        {"$set": payload}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.applications.find_one({"app_id": app_id}, {"_id": 0})


# -------------------- Preferences --------------------
@api.get("/preferences")
async def get_prefs(user: User = Depends(get_current_user)):
    p = await db.preferences.find_one({"user_id": user.user_id}, {"_id": 0})
    if not p:
        p = {"user_id": user.user_id, "target_roles": [], "locations": ["Australia"],
             "salary_min": 0, "remote_ok": True, "graduate_only": False}
        await db.preferences.insert_one(p)
        p = await db.preferences.find_one({"user_id": user.user_id}, {"_id": 0})
    return p


@api.put("/preferences")
async def update_prefs(payload: dict, user: User = Depends(get_current_user)):
    payload.pop("user_id", None)
    await db.preferences.update_one({"user_id": user.user_id}, {"$set": payload}, upsert=True)
    return await db.preferences.find_one({"user_id": user.user_id}, {"_id": 0})


# -------------------- Stats --------------------
@api.get("/stats")
async def stats(user: User = Depends(get_current_user)):
    apps = await db.applications.find({"user_id": user.user_id}, {"_id": 0}).to_list(1000)
    matches = await db.matches.find({"user_id": user.user_id}, {"_id": 0}).to_list(2000)
    resumes_count = await db.resumes.count_documents({"user_id": user.user_id})
    by_status: dict = {}
    for a in apps:
        by_status[a["status"]] = by_status.get(a["status"], 0) + 1
    avg = round(sum(m["score"] for m in matches) / len(matches)) if matches else 0
    total_jobs = await db.jobs.count_documents({})
    return {
        "total_jobs": total_jobs,
        "resumes": resumes_count,
        "avg_match": avg,
        "applications": len(apps),
        "by_status": by_status,
    }


# -------------------- Email digest --------------------
@api.post("/digest/send")
async def send_digest_now(user: User = Depends(get_current_user)):
    """Send the user a Resend email of their top 5 highest-scoring jobs right now."""
    matches = await db.matches.find({"user_id": user.user_id}, {"_id": 0}).sort("score", -1).to_list(50)
    if not matches:
        raise HTTPException(400, "No AI matches yet. Open a few jobs and run 'AI Score' first, or use 'AI Match all' on the dashboard.")
    seen_jobs = set()
    top: list = []
    for m in matches:
        if m["job_id"] in seen_jobs:
            continue
        seen_jobs.add(m["job_id"])
        job = await db.jobs.find_one({"job_id": m["job_id"]}, {"_id": 0})
        if not job:
            continue
        top.append({"job": job, "match": m})
        if len(top) >= 5:
            break
    if not top:
        raise HTTPException(400, "Could not assemble digest jobs")
    result = await send_digest_email(user.email, user.name, top)
    return result


@api.get("/")
async def root():
    return {"app": "ApplyMate AU", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
