# ApplyMate.AU

> **Job-hunt copilot for Australian job seekers.** Aggregates fresh listings from 10+ AU job boards every 12 hours, scores every job against your resumes with instant ATS-style keyword matching, drafts tailored cover letters with Claude Sonnet 4.5, and tracks your pipeline kanban-style — all in one neo-brutalist dashboard.

![Tech stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20MongoDB%20%2B%20React%2019-0A0A0A?style=flat-square)
![AI](https://img.shields.io/badge/AI-Claude%20Sonnet%204.5-F2542D?style=flat-square)
![Auth](https://img.shields.io/badge/auth-Emergent%20Google%20OAuth-D6E4F0?style=flat-square)

---

## ✨ Features

### Core matching engine
- **5 resumes per user** — upload PDF/DOCX, Claude extracts `skills`, `adjacent_skills` (synonyms), `role_titles`, `years_experience`, `summary`
- **Instant ATS keyword scoring** — pure-Python matcher, scores 100+ jobs in microseconds (no LLM cost per job)
- **Auto-filtered feed** — only jobs whose best-resume score ≥ `min_score` are shown, sorted DESC
- **Optional Deep AI re-score** — per-job button calls Claude for narrative reasoning + matched/missing skills

### Job sources (last 12h window)
| Source | Type | Coverage |
|---|---|---|
| **Adzuna AU** | Live API | ✅ ~200 real AU listings per fetch — Adzuna aggregates from SEEK, Indeed, Jora, CareerOne and others, so apply URLs go to the genuine source listing |
| **Remotive** | Live API | ✅ ~18 remote-friendly tech/marketing roles |
| **The Muse** | Live API | ✅ ~20 global tech/creative roles |

> **No placeholder data.** Every job in the feed is a real, click-able listing. The earlier curated seed (with non-specific apply URLs) has been removed.

### Sprout-inspired UX
- **Discover** — Tinder-style swipe deck (← skip, → save, ↑ quick-apply). Keyboard, mouse, touch all supported.
- **Application Profile** — one-time form (phone, LinkedIn, GitHub, visa, salary, notice period). Powers 1-click apply.
- **Daily streak + goal** — flame counter, ring progress, applications-per-day target
- **Pipeline funnel** + **14-day velocity chart** on the Tracker page (recharts)

### Application workflow
- **AI cover letter generator** — Claude drafts a personalised 220-280 word letter per job
- **Kanban tracker** — Saved → Applied → Interview → Offer → Rejected, drag/drop
- **Quick-apply** — clicking "Apply" auto-creates an Applied entry in your tracker
- **Daily email digest** — Resend integration sends top 5 matches to your inbox on demand

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React 19 + Tailwind + Shadcn             │
│  Landing · Dashboard · Discover · Resumes · Profile         │
│  Job Detail · Tracker · Settings · AuthCallback             │
└────────────────────────────┬────────────────────────────────┘
                             │ (cookie-based session)
┌────────────────────────────▼────────────────────────────────┐
│                  FastAPI (/api prefix)                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   Auth   │  │ Resumes  │  │   Jobs   │  │ Tracker  │    │
│  │ (Google) │  │  + LLM   │  │ + Match  │  │ + Stats  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  services/                                                   │
│    ├── llm.py            Claude Sonnet 4.5 (parse, score,   │
│    │                     cover letter) via emergentintegr.  │
│    ├── matching.py       Pure-Python keyword scorer (instant)│
│    ├── jobs.py           Adzuna AU + Remotive + Muse + seed │
│    ├── resume_parser.py  pypdf + python-docx text extract   │
│    └── email.py          Resend digest                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                  ┌──────────▼──────────┐
                  │      MongoDB        │
                  │  users · sessions   │
                  │  resumes · jobs     │
                  │  matches · apps     │
                  │  preferences · profiles │
                  └─────────────────────┘
```

---

## 🚀 Quick start

### Prerequisites
- Python 3.11+, Node 18+, MongoDB, yarn
- Emergent platform credentials (or self-hosted equivalents) for:
  - Emergent Universal LLM key (Claude Sonnet 4.5)
  - Emergent Google OAuth
- Optional: Adzuna AU API key, Resend API key

### Environment variables

**`backend/.env`**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=https://your-frontend.com,http://localhost:3000
EMERGENT_LLM_KEY=sk-emergent-xxx
ADZUNA_APP_ID=xxxxxxxx              # https://developer.adzuna.com (free)
ADZUNA_APP_KEY=xxxxxxxxxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxx          # https://resend.com/api-keys (free)
SENDER_EMAIL=onboarding@resend.dev
```

**`frontend/.env`**
```
REACT_APP_BACKEND_URL=https://your-backend.com
WDS_SOCKET_PORT=443
```

### Deploy to `umangcodes.me`
- GitHub Pages deploys the React app from `.github/workflows/deploy-pages.yml`
- Set the repository variable `REACT_APP_BACKEND_URL` to the production backend origin before running the workflow
- The frontend publishes with a `CNAME` of `umangcodes.me`
- The workflow copies `index.html` to `404.html` so deep links like `/dashboard` keep working on GitHub Pages
- In the repository Pages settings, use **GitHub Actions** as the source if it is not already enabled

### Run locally
```bash
# Backend (port 8001)
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Frontend (port 3000)
cd frontend
yarn install
yarn start
```

On Emergent platform: services are supervised automatically. Use `sudo supervisorctl restart backend|frontend` only after editing `.env` or installing dependencies.

---

## 📂 Project structure

```
/app
├── backend/
│   ├── server.py              # FastAPI routes
│   ├── services/
│   │   ├── llm.py             # Claude wrappers
│   │   ├── matching.py        # Keyword scorer
│   │   ├── jobs.py            # Source aggregators
│   │   ├── resume_parser.py   # PDF/DOCX extract
│   │   └── email.py           # Resend digest
│   ├── tests/
│   │   └── test_applymate_au.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.js             # Router
│   │   ├── lib/
│   │   │   ├── api.js         # axios w/ withCredentials
│   │   │   └── auth.jsx       # AuthContext
│   │   ├── components/
│   │   │   ├── TopNav.jsx
│   │   │   ├── JobCard.jsx
│   │   │   └── MatchBadge.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Discover.jsx   # Swipe deck
│   │   │   ├── Resumes.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── JobDetail.jsx
│   │   │   ├── Tracker.jsx    # Kanban + charts
│   │   │   ├── Settings.jsx
│   │   │   └── AuthCallback.jsx
│   │   ├── index.css          # Cabinet Grotesk + IBM Plex Sans + neo-brutalist
│   │   └── App.css
│   ├── package.json
│   └── .env
├── memory/
│   ├── PRD.md                 # Product requirements log
│   └── test_credentials.md    # Mongo session-injection how-to
├── design_guidelines.json     # Design agent output
├── auth_testing.md            # Emergent OAuth playbook
└── README.md                  # ← you are here
```

---

## 🛣 API reference (all `/api` prefix)

### Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/google` | Exchange Emergent `session_id` → httpOnly cookie session |
| GET | `/auth/me` | Current user (or 401) |
| POST | `/auth/logout` | Destroy server-side session + clear cookie |

### Resumes
| Method | Path | Purpose |
|---|---|---|
| POST | `/resumes` | Upload PDF/DOCX (`multipart`: `file`, `name`, `tag`). Max 5 per user. |
| GET | `/resumes` | List user's resumes (no file blob) |
| DELETE | `/resumes/{id}` | Delete |

### Jobs & matching
| Method | Path | Purpose |
|---|---|---|
| POST | `/jobs/fetch` | Pull latest from all sources, dedupe, save |
| GET | `/jobs` | List with filters: `source`, `location`, `graduate_only`, `min_score` (default 20), `limit`. Returns instant keyword scores + per-resume breakdown. |
| POST | `/jobs/{id}/match` | **Deep AI re-score** with Claude — flips `best_match.source` from `keyword` → `ai` |
| POST | `/jobs/{id}/cover-letter` | Claude-generated cover letter for best-matching resume |

### Tracker & profile
| Method | Path | Purpose |
|---|---|---|
| POST | `/applications` | Upsert by `(user_id, job_id)` |
| GET | `/applications` | List with embedded job data |
| PATCH | `/applications/{id}` | Update (status / notes) |
| GET · PUT | `/preferences` | target roles · locations · salary_min · remote_ok · graduate_only · daily_goal |
| GET · PUT | `/profile` | phone · linkedin · github · portfolio · visa · salary · notice · pitch |
| GET | `/activity` | 28-day series + streak + today + daily_goal + total |
| GET | `/stats` | total jobs · resumes · avg match · applications · by_status |

### Email
| Method | Path | Purpose |
|---|---|---|
| POST | `/digest/send` | Email top 5 AI-scored matches via Resend |

---

## 🧪 Testing

```bash
# Backend regression (35+ tests)
cd /app
python -m pytest backend/tests/test_applymate_au.py -v

# Lint
ruff check backend/
yarn --cwd frontend lint
```

**Auth test injection** (Mongo direct):
```js
mongosh --eval "
use('test_database');
var uid='test-' + Date.now();
var token='test_session_' + Date.now();
db.users.insertOne({user_id:uid, email:'t@x.com', name:'Tester', picture:'', created_at:new Date().toISOString()});
db.user_sessions.insertOne({user_id:uid, session_token:token, expires_at:new Date(Date.now()+7*24*3600*1000).toISOString()});
db.preferences.insertOne({user_id:uid, target_roles:[], locations:['Australia'], salary_min:0, remote_ok:true, graduate_only:false, daily_goal:5});
print('TOKEN=' + token);
"
```
Then either set cookie `session_token=<token>` or send header `Authorization: Bearer <token>`.

---

## ⚖️ Honest limits

**Auto-apply on SEEK / LinkedIn / Indeed / Hays is not legally possible** — those sites explicitly forbid automation in their ToS and block scraping. ApplyMate's "apply" button takes you straight to the source with the right resume in your clipboard / pre-selected and **auto-marks** the application as `Applied` in the tracker. Truly automated form submission requires a Playwright browser extension (Workday/Greenhouse) which is in the P0 backlog.

**Resend test mode** — by default, the digest only delivers to your verified Resend account email. Verify a domain at https://resend.com/domains to email any address.

---

## 🗺 Roadmap

### P0 (next up)
- [ ] Playwright assisted-apply for Workday / Greenhouse when match ≥ 90%
- [ ] Resume gap analyzer ("which 3 skills get you to 90%?")
- [ ] Weekly auto-digest scheduler (Mondays 7am Sydney time)

### P1
- [ ] LinkedIn Easy Apply via official Partner API
- [ ] Salary insights (Glassdoor / Levels.fyi)
- [ ] Recruiter outreach templates
- [ ] Interview prep generator (questions tailored to each JD)

### P2
- [ ] Mobile native app (iOS/Android)
- [ ] Multi-language support
- [ ] Browser extension — 1-click resume attach on any career site

---

## 🛠 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI + Motor (async Mongo) | Type-safe async, great for I/O-bound LLM calls |
| Frontend | React 19 + Tailwind + Shadcn | Modern, accessible, fast iteration |
| Charts | Recharts | Composable, declarative, matches the design system |
| Icons | Lucide React | Crisp, tree-shakeable |
| Fonts | Cabinet Grotesk + IBM Plex Sans + JetBrains Mono | Distinctive, not the AI-slop default |
| LLM | Claude Sonnet 4.5 via `emergentintegrations` | Best resume/JD reasoning |
| Auth | Emergent Google OAuth (httpOnly cookie) | Zero-config Google sign-in |
| Email | Resend | Best DX for transactional email |
| Jobs API | Adzuna AU + Remotive + The Muse | Real, free, AU-relevant |

---

## 🤝 Contributing

This is a personal job-hunt tool but PRs and ideas are welcome. Open an issue first to chat through changes.

## 📄 License

MIT
