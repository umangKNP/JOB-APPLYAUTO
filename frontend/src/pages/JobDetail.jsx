import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { http } from "../lib/api";
import TopNav from "../components/TopNav";
import MatchBadge from "../components/MatchBadge";
import { toast } from "sonner";
import { ExternalLink, Sparkles, ArrowLeft, BookmarkPlus, Copy, CheckCircle2, AlertTriangle } from "lucide-react";

const STATUSES = ["saved", "applied", "interview", "offer", "rejected"];

export default function JobDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const [job, setJob] = useState(state?.job || null);
  const [matches, setMatches] = useState(state?.job?.matches || []);
  const [coverLetter, setCoverLetter] = useState("");
  const [bestRid, setBestRid] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [loadingCL, setLoadingCL] = useState(false);
  const [app, setApp] = useState(state?.job?.application || null);
  const [resumeCount, setResumeCount] = useState(null);

  useEffect(() => {
    http.get("/resumes").then(r => setResumeCount(r.data.length)).catch(() => setResumeCount(0));
    // hydrate if not navigated with state
    if (!job) {
      http.get("/jobs").then(r => {
        const found = r.data.find(j => j.job_id === id);
        if (found) {
          setJob(found);
          setMatches(found.matches || []);
          setApp(found.application || null);
        }
      });
    }
  }, [id, job]);

  const runMatch = async () => {
    setLoadingMatch(true);
    try {
      const r = await http.post(`/jobs/${id}/match`);
      setMatches(r.data);
      toast.success("Scored against all resumes");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Need a resume first");
    } finally { setLoadingMatch(false); }
  };

  const genCL = async () => {
    setLoadingCL(true);
    try {
      const r = await http.post(`/jobs/${id}/cover-letter`);
      setCoverLetter(r.data.cover_letter);
      setBestRid(r.data.resume_id);
      toast.success(`Cover letter drafted for ${r.data.resume_name}`);
    } catch (e) {
      toast.error("Failed — upload a resume first");
    } finally { setLoadingCL(false); }
  };

  const saveStatus = async (status) => {
    try {
      const r = await http.post("/applications", {
        job_id: id, status, resume_id: bestRid, cover_letter: coverLetter,
      });
      setApp(r.data);
      toast.success(`Marked as ${status}`);
    } catch { toast.error("Failed"); }
  };

  if (!job) return (
    <div className="min-h-screen"><TopNav /><div className="p-10">Loading…</div></div>
  );

  const best = matches.length ? matches.reduce((a, b) => a.score > b.score ? a : b) : null;
  const sorted = [...matches].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[1100px] mx-auto px-6 py-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm mb-4 hover:underline" data-testid="link-back">
          <ArrowLeft size={14}/> Back to jobs
        </Link>

        <div className="nb-card nb-shadow p-6 lg:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="label-overline bg-pastel-blue px-2 py-1 border-[1.5px] border-[#1E1E1E] inline-block">{job.source}</div>
              {job.is_graduate && <span className="ml-2 label-overline match-high px-2 py-1 border-[1.5px] border-[#1E1E1E] inline-block">Graduate</span>}
              <h1 className="font-display font-black text-3xl lg:text-4xl tracking-tighter mt-3" data-testid="job-detail-title">{job.title}</h1>
              <div className="text-[#525252] mt-2">
                <span className="font-semibold text-[#0A0A0A]">{job.company}</span> · {job.location}
                {job.salary && <> · <span className="font-mono text-sm">{job.salary}</span></>}
              </div>
            </div>
            <MatchBadge score={best?.score} size="lg" />
          </div>

          {resumeCount === 0 && (
            <div className="mt-5 border-[1.5px] border-[#1E1E1E] bg-[#FFEACC] p-3 flex items-start gap-2 text-sm" data-testid="no-resume-banner">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0"/>
              <div>
                <strong>No resume uploaded yet.</strong> AI scoring and cover letter generation need at least one resume.{" "}
                <Link to="/resumes" className="underline font-semibold">Upload one now →</Link>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-6">
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="nb-btn inline-flex items-center gap-2" data-testid="btn-apply-now">
              Apply on {job.source} <ExternalLink size={14}/>
            </a>
            <button onClick={runMatch} disabled={loadingMatch || resumeCount === 0} className="nb-btn-outline inline-flex items-center gap-2" data-testid="btn-rescore">
              <Sparkles size={14}/> {loadingMatch ? "Scoring…" : (matches.length ? "Re-score" : "AI Score vs resumes")}
            </button>
            <button onClick={genCL} disabled={loadingCL || resumeCount === 0} className="nb-btn-outline inline-flex items-center gap-2" data-testid="btn-cover-letter">
              {loadingCL ? "Drafting…" : "Generate cover letter"}
            </button>
            <button onClick={() => saveStatus("saved")} className="nb-btn-outline inline-flex items-center gap-2" data-testid="btn-save">
              <BookmarkPlus size={14}/> Save
            </button>
          </div>

          {app && (
            <div className="mt-4 flex items-center gap-2 flex-wrap text-sm">
              <span className="label-overline">Tracker status</span>
              {STATUSES.map(s => (
                <button key={s} onClick={()=>saveStatus(s)}
                  className={`border-[1.5px] border-[#1E1E1E] px-3 py-1 text-xs font-mono uppercase ${app.status===s ? 'bg-[#0A0A0A] text-white' : 'bg-white hover:bg-[#F6F4ED]'}`}
                  data-testid={`status-${s}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {sorted.length > 0 && (
          <div className="nb-card p-6 mb-6">
            <h2 className="font-display font-bold text-xl tracking-tight mb-4">Resume scoreboard</h2>
            <div className="space-y-3">
              {sorted.map(m => (
                <div key={m.resume_id} className="border-[1.5px] border-[#1E1E1E] p-3 flex items-start gap-4" data-testid={`match-row-${m.resume_id}`}>
                  <MatchBadge score={m.score} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{m.resume_name}</div>
                    <div className="text-sm text-[#525252] mt-1">{m.reasoning}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {m.matched_skills.map(s => <span key={s} className="text-xs match-high px-2 py-0.5 border-[1.5px] border-[#1E1E1E] font-mono">+ {s}</span>)}
                      {m.missing_skills.map(s => <span key={s} className="text-xs match-low px-2 py-0.5 border-[1.5px] border-[#1E1E1E] font-mono">− {s}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {coverLetter && (
          <div className="nb-card p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-xl tracking-tight">AI Cover Letter</h2>
              <button onClick={()=>{navigator.clipboard.writeText(coverLetter); toast.success("Copied");}}
                className="nb-btn-outline inline-flex items-center gap-1 text-xs" data-testid="btn-copy-cl">
                <Copy size={12}/> Copy
              </button>
            </div>
            <textarea value={coverLetter} onChange={e=>setCoverLetter(e.target.value)}
              className="nb-input font-mono text-sm leading-relaxed min-h-[320px] whitespace-pre-wrap" data-testid="cover-letter-text"/>
            <div className="text-xs text-[#525252] mt-2 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-[#0F5132]"/> Drafted in seconds by Claude Sonnet 4.5 — review before sending.
            </div>
          </div>
        )}

        <div className="nb-card p-6">
          <h2 className="font-display font-bold text-xl tracking-tight mb-3">Job description</h2>
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-[#262626]" data-testid="job-description">
            {job.description}
          </div>
        </div>
      </main>
    </div>
  );
}
