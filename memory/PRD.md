# ApplyMate AU — Product Requirements

## Original problem statement
Build an agent/website that auto-applies to all possible job roles based on 5 different resumes, sourcing jobs posted in the last 12 hours from major Australian boards (SEEK, LinkedIn, CareerOne, Indeed, Jora, Toozly, My Future, Adzuna, Workforce Australia, Hays). User wants a simple visual interface, AI matching of resumes to JDs, ability to auto-apply to Workday/static sites when match ≥ 90%, and Google sign-in.

## Reality-check decisions (user said "assume default and proceed")
- Major job boards (SEEK, LinkedIn, Indeed, Hays) prohibit automation in their ToS and block scraping. Approach chosen: **Hybrid — aggregate from public sources + 1-click redirect to apply with best-matched resume pre-selected**.
- Public job APIs used: Remotive, The Muse, plus a curated Australian roles seed that links back to live SEEK/LinkedIn/Jora/Workforce AU/Adzuna search URLs (one-click out).
- AI: Claude Sonnet 4.5 via emergentintegrations + Emergent Universal LLM key.
- Auth: Emergent Google Sign-In.
- Storage: resume text + base64 in MongoDB.

## Architecture
- **Backend**: FastAPI + MongoDB. Routes prefixed `/api`. Services split: `llm.py` (Claude), `jobs.py` (sources), `resume_parser.py` (pdf/docx).
- **Frontend**: React 19 + Tailwind + shadcn/ui. Neo-brutalist light theme — Cabinet Grotesk display / IBM Plex Sans body / JetBrains Mono numbers. Sharp 1.5px borders, hard solid shadows.
- **Pages**: Landing → Dashboard (feed + stats) → Job Detail (match + cover letter) → Resumes (up to 5) → Tracker (kanban) → Settings (prefs).

## User persona
**Ankur** — Australian (or AU-based) job seeker with 5 versions of resume tailored to different role types (e.g. Data, Marketing, Engineering, Grad, Generalist). Wants an aggregated, intelligent feed instead of opening 8 tabs and re-scrolling daily.

## Core requirements (static)
- Pull jobs from at least 5 AU-relevant sources, last 12h window
- Up to 5 resumes per user, with AI-extracted skills + summary
- Per-job AI match score 0–100 against every resume
- Per-job AI cover letter, tailored to best-matching resume
- Application tracker (kanban): Saved / Applied / Interview / Offer / Rejected
- Filters: source, location, min match score, graduate-only
- Preferences: target roles, locations, salary, remote OK

## Implemented (2026-05-19)
- ✅ Google sign-in (Emergent OAuth, cookie session)
- ✅ Resume upload (PDF/DOCX), AI parsing via Claude Sonnet 4.5
- ✅ Job aggregation: Remotive + The Muse + curated AU seed (10 boards, 15 role templates, last-12h posted timestamps)
- ✅ Per-job AI match scoring with reasoning + matched/missing skills
- ✅ AI cover letter generation
- ✅ Kanban application tracker (drag/drop status moves)
- ✅ Filters (source, location, graduate, min score)
- ✅ Settings/preferences page
- ✅ Stats strip on dashboard
- ✅ Empty-state banner on JobDetail when no resume uploaded
- ✅ Backend tests: 17/17 pytest pass

## Backlog (P0)
- **Real auto-apply for Workday/Greenhouse** when match ≥ 90% (Playwright-based assisted-apply extension)
- **Adzuna AU live API** — register the user's Adzuna app_id/key in settings, pull real listings
- **SEEK / Indeed Partner APIs** — apply for partner access if user has business case
- **Daily email digest of top matches** (needs Resend or SendGrid key)

## Backlog (P1)
- LinkedIn Easy Apply integration via official partner program
- Resume gap analysis vs target roles (uses Claude — pre-screen before applying)
- Salary insights (Glassdoor / Levels.fyi integration)
- Browser extension for 1-click resume attach on any career site

## Backlog (P2)
- Multi-language support
- Mobile app
- Recruiter outreach automation (LinkedIn InMail templates)
- Interview prep generator (questions tailored to JD)

## Known limitations / honesty
- The "Auto-apply to all jobs in 1 click" framing in the original prompt is not legally achievable on SEEK/LinkedIn/Indeed/Hays — those sites block automation. ApplyMate gives you a frictionless **assisted** apply: best resume picked, cover letter ready, click-through to source.
- CORS tightened to explicit origins in `/app/backend/.env`.

## Test credentials
See `/app/memory/test_credentials.md` for Mongo session-injection one-liner.
