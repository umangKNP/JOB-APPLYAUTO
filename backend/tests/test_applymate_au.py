"""Backend regression tests for ApplyMate AU."""
import os, time, uuid, pytest, requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

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


# ---- Delete resume ----
def test_delete_resume():
    r = requests.delete(f"{API}/resumes/{RESUME_ID}", headers=H())
    assert r.status_code == 200
