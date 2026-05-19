import { useEffect, useState } from "react";
import { http } from "../lib/api";
import TopNav from "../components/TopNav";
import JobCard from "../components/JobCard";
import { toast } from "sonner";
import { RefreshCw, Filter, Mail, ScanSearch } from "lucide-react";

const SOURCES = ["all", "Adzuna AU", "SEEK", "LinkedIn", "Indeed", "Jora", "Hays", "CareerOne",
  "Workforce Australia", "My Future", "Toozly", "Remotive", "The Muse"];

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [source, setSource] = useState("all");
  const [graduateOnly, setGraduateOnly] = useState(false);
  const [minScore, setMinScore] = useState(20);
  const [location, setLocation] = useState("");
  const [resumeCount, setResumeCount] = useState(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const params = { source, graduate_only: graduateOnly, min_score: minScore };
      if (location) params.location = location;
      const [r, s] = await Promise.all([
        http.get("/jobs", { params }),
        http.get("/stats"),
      ]);
      setJobs(r.data);
      setStats(s.data);
      setResumeCount(s.data.resumes);
      // auto-trigger fetch if empty
      if (r.data.length === 0 && !graduateOnly && source === "all" && minScore <= 20) {
        await refreshJobs(false);
      }
    } catch (e) {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const refreshJobs = async (notify = true) => {
    setFetching(true);
    try {
      const r = await http.post("/jobs/fetch");
      if (notify) toast.success(`Pulled ${r.data.fetched} jobs · ${r.data.saved} new`);
      await loadJobs();
    } catch (e) {
      if (notify) toast.error("Failed to fetch jobs");
    } finally { setFetching(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadJobs(); }, [source, graduateOnly, minScore]);

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat label="Live jobs" value={stats?.total_jobs ?? "—"} accent="bg-pastel-blue" />
          <Stat label="Resumes" value={`${stats?.resumes ?? 0} / 5`} accent="bg-pastel-purple" />
          <Stat label="Avg match" value={stats ? `${stats.avg_match}` : "—"} accent="match-high" />
          <Stat label="Applications" value={stats?.applications ?? 0} accent="match-medium" />
        </div>

        {resumeCount === 0 && (
          <div className="nb-card p-5 mb-6 bg-[#FFEACC] flex items-start gap-3" data-testid="upload-prompt">
            <ScanSearch size={22} className="mt-0.5"/>
            <div>
              <div className="font-display font-bold text-lg tracking-tight">Upload a resume to unlock matching</div>
              <p className="text-sm text-[#664D03] mt-1">ApplyMate filters thousands of AU jobs down to the ones that match <em>your</em> skills. <a href="/resumes" className="underline font-semibold">Upload your first resume →</a></p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="label-overline">Last 12 hours · matched to your resumes</div>
            <h1 className="font-display font-black text-3xl lg:text-4xl tracking-tighter">Job Feed</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => refreshJobs(true)} disabled={fetching} className="nb-btn-outline inline-flex items-center gap-2 text-sm" data-testid="btn-refresh-jobs">
              <RefreshCw size={14} className={fetching ? "animate-spin" : ""}/> {fetching ? "Fetching" : "Refresh sources"}
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await http.post("/digest/send");
                  if (r.data.status === "sent") toast.success("Digest emailed!");
                  else toast.info(r.data.reason || r.data.status);
                } catch (e) { toast.error(e.response?.data?.detail || "Failed to send digest"); }
              }}
              className="nb-btn inline-flex items-center gap-2 text-sm" data-testid="btn-send-digest">
              <Mail size={14}/> Email me top matches
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="nb-card p-4 mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs label-overline"><Filter size={12}/> Filters</div>
          <select value={source} onChange={e=>setSource(e.target.value)} className="nb-input max-w-[200px] text-sm py-2" data-testid="filter-source">
            {SOURCES.map(s => <option key={s} value={s}>{s === "all" ? "All sources" : s}</option>)}
          </select>
          <input placeholder="Location e.g. Sydney" value={location} onChange={e=>setLocation(e.target.value)}
            onKeyDown={e=>e.key==='Enter' && loadJobs()}
            className="nb-input max-w-[200px] text-sm py-2" data-testid="filter-location"/>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={graduateOnly} onChange={e=>setGraduateOnly(e.target.checked)} data-testid="filter-grad"/>
            Graduate only
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span>Min match:</span>
            <input type="range" min={0} max={100} step={5} value={minScore} onChange={e=>setMinScore(parseInt(e.target.value))} data-testid="filter-minscore"/>
            <span className="font-mono w-8">{minScore}</span>
          </div>
        </div>

        {loading ? (
          <div className="font-display text-2xl">Loading jobs…</div>
        ) : jobs.length === 0 ? (
          <div className="nb-card p-10 text-center">
            <div className="font-display font-bold text-2xl mb-2">
              {resumeCount === 0 ? "Upload a resume to see matched jobs" : "No jobs match your resume above this threshold"}
            </div>
            <p className="text-[#525252] mb-4">
              {resumeCount === 0 ? "Once we have your skills, we'll filter thousands of AU jobs to the ones that fit you." : "Try lowering the Min match slider, or pull fresh listings."}
            </p>
            {resumeCount === 0 ? (
              <a href="/resumes" className="nb-btn inline-block">Upload resume</a>
            ) : (
              <button onClick={() => refreshJobs(true)} className="nb-btn" data-testid="btn-empty-refresh">Pull jobs now</button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {jobs.map(j => <JobCard key={j.job_id} job={j} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={`nb-card p-4 ${accent}`} data-testid={`stat-${label}`}>
      <div className="label-overline">{label}</div>
      <div className="font-display font-black text-4xl tracking-tighter mt-1">{value}</div>
    </div>
  );
}
