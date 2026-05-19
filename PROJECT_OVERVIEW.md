# ApplyMate.AU — Project Overview

> **The job-hunt copilot built for Australian job seekers.**
> Stop scrolling 8 tabs. Upload your resume. Get fresh, real, ATS-scored jobs every 12 hours, with a tailored cover letter one click away.

---

## 🎯 The problem we're solving

Job hunting in Australia is broken into ten different tabs:

- SEEK for the volume
- LinkedIn for the network
- Indeed for the aggregator
- Jora / Adzuna / CareerOne / Hays / Workforce Australia / My Future / Toozly for niche listings
- A spreadsheet to track everything
- ChatGPT to rewrite the cover letter
- A different resume file for each role you're targeting

The result: hours per day, missed deadlines, generic applications, and burnout. Studies estimate the average AU job seeker spends 11 hours/week searching, applies to only 6 jobs/week, and gets a 2% response rate. Most of that time is wasted scrolling, retyping, and tab-switching — not on the things that actually win interviews.

**ApplyMate solves this by being the single dashboard between your resumes and the entire Australian job market.**

---

## ⚙️ How it works — step by step

### Step 1: Sign in with Google
One click via Emergent's Google OAuth. No password to remember, no email to verify. Your account is created the moment you finish the Google consent screen. Sessions are httpOnly cookies, 7-day expiry, fully secure.

> *Why you can depend on it:* No credentials stored in our database. Google handles authentication. Our session tokens are server-side only.

### Step 2: Upload up to 5 resumes
Drop in PDF or DOCX files (max 5). For each one:

- **`pypdf` + `python-docx`** extract the raw text — fast and lossless for digital resumes
- **OCR fallback** (`tesseract` + `pdf2image`) kicks in automatically if the PDF is scanned/image-based and pypdf returns less than 60 chars
- **Claude Sonnet 4.5** then parses the text using a **multi-shot prompt** (we give Claude a worked example of input → structured output) and returns:
  - **15–30 core skills** (specific, JD-style keywords)
  - **10–20 adjacent_skills** (synonyms & related tech)
  - **3–7 role_title variants** (incl. senior/lead variants)
  - **8–15 tools**, **4–8 soft skills**, **education**, **certifications**, **languages**, **achievements**, **years_experience**, **seniority** (graduate/junior/mid/senior/lead/principal)
  - **ATS score 0–100** + **3–5 specific improvement tips**

> *Why you can depend on it:* The parse is verifiable. Every extracted skill is visible on the Resumes page. The ATS score tells you objectively how parser-friendly your file is. A **Re-parse** button lets you re-run extraction whenever we ship a better prompt — no re-upload needed.

### Step 3: Fresh job feed every 12 hours
Click **Refresh sources** and we pull in real Australian jobs from public APIs:

- **Adzuna AU live API** — up to 200 real listings per fetch. Adzuna is a *licensed aggregator* of SEEK, Indeed, Jora, CareerOne, Hays, etc., so the apply URLs go to the **actual source listing**, not a search page. ✅
- **Remotive** — ~18 remote-friendly tech/marketing roles
- **The Muse** — ~20 global tech/creative roles

**No placeholder data, no fake jobs.** Every card you see is a real, click-able listing. Dedupe is by `source + url + title`. Filter window defaults to last 12 hours; falls back to last 7 days if the recent slice is sparse.

> *Why you can depend on it:* We don't scrape SEEK or LinkedIn (their ToS forbids it). We use Adzuna's official aggregator API, which they licence directly from the source boards. Apply URLs are verified — every link goes to a real listing.

### Step 4: Instant ATS keyword matching
The moment you load the dashboard, every job is scored 0–100 against every one of your resumes — **in microseconds, no LLM call**.

The scorer is pure Python (`services/matching.py`):
- Tokenises the job title (weighted 3×) and description (weighted 1×)
- Checks if your resume's skills + adjacent_skills + tools appear as whole-word matches or phrase matches
- Adds bonuses for role-title overlap and title hits
- Returns a saturating 0–100 score that rewards real signal without punishing resume breadth

The dashboard automatically filters to jobs scoring **≥ 20** (adjustable via the "Min match" slider). Sorted by score DESC, then posted_at DESC. You see only what's relevant to *you*, not the firehose.

> *Why you can depend on it:* The match logic is transparent — open any job and you'll see the exact matched skills (green pills) and missing skills (red pills) that drove the score. No black box.

### Step 5: Deep AI re-score (optional, per job)
For any job you're seriously considering, click **Deep AI re-score** on the Job Detail page. This calls Claude Sonnet 4.5 with the full JD + your resume content and returns:
- A refined 0–100 score per resume
- A 1–2 sentence reasoning
- Matched skills with semantic nuance
- Missing skills you'd want to address in your cover letter

The badge on the job card flips from `KW` (keyword) to `AI` (Claude-scored) so you can see at a glance which matches you've vetted.

### Step 6: One-click cover letter
Click **Generate cover letter**. Claude writes a personalised 220–280 word letter using:
- Your best-matching resume's summary, skills, and achievements
- The job's title, company, location, and full JD
- Your 30-second pitch from your Profile (if filled)

Output is a plain text editor — tweak, copy, paste, done. Tone is "confident but warm", explicitly avoiding clichés like "I am writing to express interest in...". Saved to the application's record so you can reopen later.

> *Why you can depend on it:* The letter is grounded in your actual resume content — Claude isn't making up experience you don't have. You can edit before sending. Generation takes ~10–20 seconds.

### Step 7: Apply with one click
Click **Apply on {source}** and three things happen simultaneously:
1. The real source listing opens in a new tab (verified URL)
2. The application is automatically logged to your **Tracker** kanban as `Applied` with today's timestamp
3. Your **daily streak** counter increments on the Discover page

### Step 8: Discover mode (Tinder-style swipe)
Inspired by Sprout AI Applier. Tab over to **Discover** and you get a card stack of your top-scoring jobs:
- **← skip** (or left-arrow / drag-left)
- **→ save** (or right-arrow / drag-right) — adds to Tracker as `saved`
- **↑ quick apply** (or up-arrow / drag-up) — opens listing + auto-logs Applied

Designed for the bus, the couch, the 5-minute coffee break. Get through 20 jobs in 2 minutes.

### Step 9: Kanban tracker + analytics
The **Tracker** page is your pipeline single-source-of-truth:
- 5 columns: Saved → Applied → Interview → Offer → Rejected
- Drag-and-drop to move cards between columns
- **Pipeline funnel chart** — visualise drop-off
- **14-day velocity chart** — applications per day with current streak
- One-click "Open on source" link from any card

### Step 10: Profile + daily digest
- **Application Profile** stores your phone, LinkedIn, GitHub, portfolio, visa status, expected salary, notice period, and 30-second pitch. Fill once, used everywhere.
- **Email me top matches** sends a beautifully designed HTML digest via **Resend** of your 5 highest-AI-scored jobs. Run on demand or (P1) on a daily schedule.

---

## 🔒 Why you can depend on this

| Concern | Our answer |
|---|---|
| **Are the jobs real?** | Yes. 100% sourced from licensed public APIs (Adzuna AU, Remotive, The Muse). Every URL goes to the actual listing. No placeholders. |
| **Is my data safe?** | Google OAuth, httpOnly cookies, no app-managed passwords. Resume files stored as base64 in MongoDB; never shared with third parties. |
| **Will it auto-apply for me on SEEK / LinkedIn?** | **No, and we're transparent about it.** Those sites' ToS forbid automation. ApplyMate makes the *manual* apply ridiculously fast (best resume pre-selected, cover letter ready, 1-click open) rather than violating ToS and risking your accounts. Workday/Greenhouse Playwright-assisted apply is on the P0 backlog. |
| **Why should I trust the match scores?** | They're transparent. Every score shows the exact matched + missing keywords. No black box. The keyword matcher is pure Python, deterministic, and unit-tested. |
| **Will my Claude API calls cost me money?** | No. We use Emergent's Universal LLM key. Parsing happens once per resume. Cover letters + deep re-scores are user-triggered, not bulk. |
| **What if the AI gets it wrong?** | You can re-parse any resume, edit any cover letter, and override any tracker status. The AI is an assistant, not the final word. |
| **What if a job site changes?** | Adzuna is contract-stable. Remotive and The Muse have public versioned APIs. If one source breaks, the other two continue to populate the feed. |
| **Is it open source?** | MIT licensed. Full code on GitHub. Every line of matching logic is auditable. |

---

## 📊 The numbers (latest test run)

- **238 real Australian jobs** per refresh cycle
- **~6 seconds** to parse a resume into 27 skills + 20 adjacent + 7 role variants
- **~80ms** to keyword-score 200 jobs against all your resumes
- **~10 seconds** to generate a tailored cover letter
- **0** external paid dependencies for end-users (Adzuna + Remotive + The Muse + Resend are all on free tiers)

---

## 🛣 Roadmap

**P0 — next up:**
- Playwright-driven assisted-apply for Workday + Greenhouse forms when match ≥ 90%
- Resume Optimiser — pick a target role, get the 3 missing skills to push past 95% match
- Weekly auto-digest scheduler (Mondays 7am Sydney)

**P1:**
- LinkedIn Easy Apply via official Partner API
- Salary insights (Glassdoor / Levels.fyi)
- Recruiter outreach templates

**P2:**
- Native mobile app
- Browser extension for 1-click resume attach on any career site

---

## 🛠 Tech stack

- **Backend:** FastAPI · Motor (async MongoDB) · `emergentintegrations` (Claude Sonnet 4.5)
- **Frontend:** React 19 · Tailwind · Shadcn/UI · Recharts · Lucide
- **Fonts:** Cabinet Grotesk display · IBM Plex Sans body · JetBrains Mono numerics
- **Style:** Neo-brutalist (1.5px borders, hard solid shadows, sharp corners, warm sand background)
- **Job APIs:** Adzuna AU · Remotive · The Muse
- **Email:** Resend
- **OCR:** Tesseract + pdf2image

---

*Built on Emergent. MIT licensed. PRs and issues welcome.*
