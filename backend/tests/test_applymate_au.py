"""Backend regression tests for ApplyMate AU."""
import os, sys, time, uuid, pytest, requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

# Allow `from services.matching import ...` for unit tests
sys.path.insert(0, "/app/backend")

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://jobhunt-agent.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

# Mongo direct injection for test session (per /app/memory/test_credentials.md)
mc = MongoClient("mongodb://localhost:27017")
db = mc["test_database"]

UID = f"test-user-{int(time.time())}"
TOKEN = f"test_session_{int(time.time())}_{uuid.uuid4().hex[:6]}"
EMAIL = f"tester+{int(time.time())}@applymate.au"


@pytest.fixture(scope="session", autouse=True)
def seed_user():
    now_iso = datetime.now(timezone.utc).isoformat()
    db.users.insert_one({"user_id": UID, "email": EMAIL, "name": "Test Tester",
                         "picture": "https://i.pravatar.cc/150", "created_at": now_iso})
    db.user_sessions.insert_one({"user_id": UID, "session_token": TOKEN,
                                 "expires_at": (datetime.now(timezone.utc)+timedelta(days=1)).isoformat()})
    db.preferences.insert_one({"user_id": UID, "target_roles": [], "locations": ["Australia"],
                               "salary_min": 0, "remote_ok": True, "graduate_only": False})
    yield
    db.users.delete_many({"user_id": UID})
    db.user_sessions.delete_many({"session_token": TOKEN})
    db.resumes.delete_many({"user_id": UID})
    db.applications.delete_many({"user_id": UID})
    db.matches.delete_many({"user_id": UID})
    db.preferences.delete_many({"user_id": UID})


H = lambda: {"Authorization": f"Bearer {TOKEN}"}


# ---- Health & Auth ----
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_auth_me_unauth():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401

def test_auth_me_with_token():
    r = requests.get(f"{API}/auth/me", headers=H())
    assert r.status_code == 200, r.text
    assert r.json()["email"] == EMAIL


# ---- Resumes ----
RESUME_ID = None

def test_upload_resume():
    global RESUME_ID
    with open("/tmp/test_resume.docx", "rb") as f:
        r = requests.post(f"{API}/resumes", headers=H(),
                          data={"name": "Test SWE", "tag": "tech"},
                          files={"file": ("resume.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                          timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "resume_id" in j
    assert isinstance(j["skills"], list)
    RESUME_ID = j["resume_id"]

def test_list_resumes():
    r = requests.get(f"{API}/resumes", headers=H())
    assert r.status_code == 200
    assert any(x["resume_id"] == RESUME_ID for x in r.json())

def test_max_5_resumes():
    # Currently have 1. Insert 4 more directly to reach 5, then try upload -> 400
    for i in range(4):
        db.resumes.insert_one({"resume_id": f"res_extra_{i}_{UID}", "user_id": UID,
                               "name": f"r{i}", "tag": "x", "filename": "x.txt",
                               "content_text": "x"*200, "skills": [], "summary": "",
                               "created_at": datetime.now(timezone.utc).isoformat()})
    with open("/tmp/test_resume.docx", "rb") as f:
        r = requests.post(f"{API}/resumes", headers=H(),
                          data={"name": "n", "tag": "t"},
                          files={"file": ("x.docx", f)})
    assert r.status_code == 400
    # cleanup extras
    db.resumes.delete_many({"resume_id": {"$regex": "^res_extra_"}})


# ---- Jobs ----
def test_jobs_fetch():
    r = requests.post(f"{API}/jobs/fetch", headers=H(), timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["fetched"] > 0

def test_jobs_list():
    r = requests.get(f"{API}/jobs", headers=H())
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) > 0
    assert "job_id" in rows[0]

def test_jobs_filter_graduate():
    r = requests.get(f"{API}/jobs?graduate_only=true", headers=H())
    assert r.status_code == 200
    for j in r.json():
        assert j["is_graduate"] is True


# ---- Match + Cover Letter (LLM) ----
JOB_ID = None
def test_match():
    global JOB_ID
    rows = requests.get(f"{API}/jobs", headers=H()).json()
    # pick a tech role for meaningful score
    tech = [r for r in rows if "engineer" in r["title"].lower() or "developer" in r["title"].lower()]
    JOB_ID = (tech[0] if tech else rows[0])["job_id"]
    r = requests.post(f"{API}/jobs/{JOB_ID}/match", headers=H(), timeout=60)
    assert r.status_code == 200, r.text
    m = r.json()
    assert isinstance(m, list) and len(m) >= 1
    assert "score" in m[0] and 0 <= m[0]["score"] <= 100

def test_cover_letter():
    r = requests.post(f"{API}/jobs/{JOB_ID}/cover-letter", headers=H(), timeout=90)
    assert r.status_code == 200, r.text
    assert len(r.json()["cover_letter"]) > 50


# ---- Applications ----
APP_ID = None
def test_create_application():
    global APP_ID
    r = requests.post(f"{API}/applications", headers=H(),
                      json={"job_id": JOB_ID, "status": "saved", "notes": "test"})
    assert r.status_code == 200
    APP_ID = r.json()["app_id"]

def test_list_applications():
    r = requests.get(f"{API}/applications", headers=H())
    assert r.status_code == 200
    assert any(a["app_id"] == APP_ID for a in r.json())
    found = [a for a in r.json() if a["app_id"] == APP_ID][0]
    assert found.get("job") is not None  # embedded job

def test_patch_application():
    r = requests.patch(f"{API}/applications/{APP_ID}", headers=H(),
                       json={"status": "applied"})
    assert r.status_code == 200
    assert r.json()["status"] == "applied"


# ---- Preferences / Stats ----
def test_preferences_get_put():
    r = requests.get(f"{API}/preferences", headers=H())
    assert r.status_code == 200
    r = requests.put(f"{API}/preferences", headers=H(),
                     json={"target_roles": ["Engineer"], "salary_min": 90000})
    assert r.status_code == 200
    assert r.json()["salary_min"] == 90000

def test_stats():
    r = requests.get(f"{API}/stats", headers=H())
    assert r.status_code == 200
    s = r.json()
    for k in ("total_jobs", "resumes", "applications", "by_status"):
        assert k in s


# ---- Iteration 4: Keyword matching engine ----

def test_resume_enriched_fields():
    """Verify resume parsing returns adjacent_skills, role_titles, years_experience, summary."""
    r = requests.get(f"{API}/resumes", headers=H())
    assert r.status_code == 200
    rows = r.json()
    target = next((x for x in rows if x["resume_id"] == RESUME_ID), None)
    assert target is not None, "Uploaded resume not in list"
    # Required new fields exist
    assert "adjacent_skills" in target and isinstance(target["adjacent_skills"], list)
    assert "role_titles" in target and isinstance(target["role_titles"], list)
    assert "years_experience" in target and isinstance(target["years_experience"], int)
    assert "summary" in target and isinstance(target["summary"], str)
    # And ATS-friendly buckets actually got populated (Claude parse should produce >=1)
    assert len(target["skills"]) >= 3, f"skills too small: {target['skills']}"
    assert len(target["adjacent_skills"]) >= 1, f"adjacent_skills empty: {target}"
    assert len(target["role_titles"]) >= 1, f"role_titles empty: {target}"


def test_jobs_min_score_filter_and_sort_and_speed():
    """GET /api/jobs?min_score=20 returns ONLY jobs with score>=20, sorted desc, in <2s."""
    t0 = time.time()
    r = requests.get(f"{API}/jobs?min_score=20", headers=H(), timeout=10)
    elapsed = time.time() - t0
    assert r.status_code == 200, r.text
    rows = r.json()
    # Performance: must be fast (keyword only, no LLM in this path)
    assert elapsed < 5.0, f"GET /api/jobs?min_score=20 too slow: {elapsed:.2f}s"
    # Filter respected
    for j in rows:
        bm = j.get("best_match")
        assert bm is not None, f"best_match missing for {j['job_id']}"
        assert bm["score"] >= 20, f"score {bm['score']} below filter for {j['title']}"
        # source should be keyword (no AI yet for these)
        assert bm["source"] in ("keyword", "ai")
    # Sorted by score DESC
    scores = [j["best_match"]["score"] for j in rows]
    assert scores == sorted(scores, reverse=True), f"not sorted desc: {scores[:10]}"


def test_jobs_min_score_zero_returns_all_with_best_match():
    """min_score=0 returns everything; each job has best_match.source=='keyword' and matches[] populated."""
    r = requests.get(f"{API}/jobs?min_score=0&limit=300", headers=H(), timeout=15)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) > 0
    # All should have best_match attached (user has resume)
    no_bm = [j for j in rows if not j.get("best_match")]
    assert not no_bm, f"{len(no_bm)} jobs missing best_match"
    # per-resume matches list present
    sample = rows[0]
    assert isinstance(sample.get("matches"), list)
    assert len(sample["matches"]) >= 1
    # best_match has keyword-style payload
    bm = sample["best_match"]
    assert "matched_skills" in bm and "missing_skills" in bm
    assert bm["source"] in ("keyword", "ai")


def test_min_score_20_yields_fewer_than_min_score_0():
    """Filtering should actually trim the result set."""
    r0 = requests.get(f"{API}/jobs?min_score=0&limit=300", headers=H()).json()
    r20 = requests.get(f"{API}/jobs?min_score=20&limit=300", headers=H()).json()
    assert len(r20) <= len(r0)


def test_ai_deep_score_then_source_becomes_ai():
    """After POST /jobs/{id}/match, GET /jobs lists that job with best_match.source='ai'."""
    rows = requests.get(f"{API}/jobs?min_score=0&limit=300", headers=H()).json()
    # pick a tech job that has NOT already been AI-scored by an earlier test
    candidates = [r for r in rows
                  if (r.get("best_match") or {}).get("source") == "keyword"
                  and not r.get("ai_matches")]
    assert candidates, "no keyword-only job available to deep-score"
    tech = [r for r in candidates if "engineer" in r["title"].lower() or "developer" in r["title"].lower() or "python" in r["title"].lower()]
    target = (tech[0] if tech else candidates[0])
    jid = target["job_id"]
    assert target["best_match"]["source"] == "keyword"
    rm = requests.post(f"{API}/jobs/{jid}/match", headers=H(), timeout=60)
    assert rm.status_code == 200, rm.text
    # re-fetch and confirm the AI source overrides
    rows2 = requests.get(f"{API}/jobs?min_score=0&limit=300", headers=H()).json()
    after = next((r for r in rows2 if r["job_id"] == jid), None)
    assert after is not None, "AI-scored job missing from /jobs"
    assert after["best_match"]["source"] == "ai", f"source not 'ai' after deep-score: {after['best_match']}"
    assert after.get("ai_matches"), "ai_matches array should be populated"


def test_no_resumes_returns_all_jobs_unfiltered():
    """When user has 0 resumes, has_resumes=False, /jobs should NOT filter by min_score."""
    # Create a separate session/user with no resume
    uid2 = f"test-user2-{int(time.time())}"
    tok2 = f"test_session_norez_{int(time.time())}"
    now = datetime.now(timezone.utc)
    db.users.insert_one({"user_id": uid2, "email": f"norez+{int(time.time())}@applymate.au",
                         "name": "No Rez", "picture": "", "created_at": now.isoformat()})
    db.user_sessions.insert_one({"user_id": uid2, "session_token": tok2,
                                 "expires_at": (now + timedelta(days=1)).isoformat()})
    try:
        h2 = {"Authorization": f"Bearer {tok2}"}
        total = requests.get(f"{API}/jobs?min_score=0&limit=300", headers=h2, timeout=15).json()
        high = requests.get(f"{API}/jobs?min_score=90&limit=300", headers=h2, timeout=15).json()
        # Without resumes, min_score must be ignored — both counts equal
        assert len(total) == len(high), f"min_score should be ignored: {len(total)} vs {len(high)}"
        # best_match should be None for all (no resumes to match against)
        assert all(j.get("best_match") is None for j in total)
    finally:
        db.users.delete_many({"user_id": uid2})
        db.user_sessions.delete_many({"session_token": tok2})


# ---- Pure-Python keyword scorer unit checks ----

def test_keyword_score_matches_skills_and_title_bonus():
    from services.matching import keyword_score, best_match
    job = {"title": "Senior Python Developer", "description": "We need Python, FastAPI, AWS, MongoDB experience.",
           "job_id": "x"}
    resume = {"resume_id": "r1", "name": "r", "skills": ["Python", "FastAPI", "MongoDB"],
              "adjacent_skills": ["AWS"], "role_titles": ["Python Developer"]}
    res = keyword_score(job, resume)
    assert res["score"] >= 60
    assert "python" in [m.lower() for m in res["matched_skills"]]
    # role_titles match should fire title_hits
    assert res["title_hits"], "expected title hits for matching title"


def test_keyword_score_no_match_is_zero():
    from services.matching import keyword_score
    job = {"title": "Pastry Chef", "description": "Sourdough, croissant, opening shift bakery."}
    resume = {"resume_id": "r1", "name": "r", "skills": ["Kubernetes", "Terraform"],
              "adjacent_skills": [], "role_titles": ["SRE"]}
    res = keyword_score(job, resume)
    assert res["score"] == 0
    assert res["matched_skills"] == []


def test_best_match_picks_higher():
    from services.matching import best_match
    job = {"title": "Data Analyst", "description": "SQL, Tableau, stakeholder management."}
    r1 = {"resume_id": "a", "name": "A", "skills": ["SQL", "Tableau"], "adjacent_skills": [], "role_titles": ["Data Analyst"]}
    r2 = {"resume_id": "b", "name": "B", "skills": ["Java"], "adjacent_skills": [], "role_titles": []}
    out = best_match(job, [r1, r2])
    assert out["resume_id"] == "a"


# ---- Delete resume (kept last) ----
def test_delete_resume():
    r = requests.delete(f"{API}/resumes/{RESUME_ID}", headers=H())
    assert r.status_code == 200
