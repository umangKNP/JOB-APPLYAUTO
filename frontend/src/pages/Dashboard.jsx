import { useEffect, useState } from "react";
import { http } from "../lib/api";
import TopNav from "../components/TopNav";
import JobCard from "../components/JobCard";
import { toast } from "sonner";
import { RefreshCw, Filter, Sparkles, Mail } from "lucide-react";

const SOURCES = ["all", "SEEK", "LinkedIn", "Indeed", "Jora", "Hays", "CareerOne",
  "Workforce Australia", "Adzuna AU", "My Future", "Toozly", "Remotive", "The Muse"];

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [matching, setMatching] = useState(false);
  const [source, setSource] = useState("all");
  const [graduateOnly, setGraduateOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [location, setLocation] = useState("");

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
      // auto-trigger fetch if empty
      if (r.data.length === 0 && !graduateOnly && source === "all") {
        await refreshJobs();
      }
    } catch (e) {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const refreshJobs = async () => {
    setFetching(true);
    try {
      const r = await http.post("/jobs/fetch");
      toast.success(`Pulled ${r.data.fetched} jobs · ${r.data.saved} new`);
      await loadJobs();
    } catch (e) {
      toast.error("Failed to fetch jobs");
    } finally { setFetching(false); }
  };

  const matchAllVisible = async () => {
    setMatching(true);
    const toScore = jobs.filter(j => !j.best_match).slice(0, 15);
    if (toScore.length === 0) {
      toast.info("All visible jobs already scored");
      setMatching(false);
      return;
    }
    toast.info(`AI scoring ${toScore.length} jobs…`);
    try {
      for (const j of toScore) {
        try { await http.post(`/jobs/${j.job_id}/match`); } catch {}
      }
      toast.success("Done");
      await loadJobs();
    } finally { setMatching(false); }
  };

  useEffect(() => { loadJobs(); /* eslint-disable-next-line */ }, [source, graduateOnly, minScore]);

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

        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="label-overline">Last 12 hours</div>
            <h1 className="font-display font-black text-3xl lg:text-4xl tracking-tighter">Job Feed</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={refreshJobs} disabled={fetching} className="nb-btn-outline inline-flex items-center gap-2 text-sm" data-testid="btn-refresh-jobs">
              <RefreshCw size={14} className={fetching ? "animate-spin" : ""}/> {fetching ? "Fetching" : "Refresh sources"}
            </button>
            <button onClick={matchAllVisible} disabled={matching} className="nb-btn inline-flex items-center gap-2 text-sm" data-testid="btn-match-all">
              <Sparkles size={14}/> {matching ? "Scoring…" : "AI Match all"}
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await http.post("/digest/send");
                  if (r.data.status === "sent") toast.success("Digest emailed!");
                  else toast.info(r.data.reason || r.data.status);
                } catch (e) { toast.error(e.response?.data?.detail || "Failed to send digest"); }
              }}
              className="nb-btn-outline inline-flex items-center gap-2 text-sm" data-testid="btn-send-digest">
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
            <span>Min score:</span>
            <input type="range" min={0} max={100} step={5} value={minScore} onChange={e=>setMinScore(parseInt(e.target.value))} data-testid="filter-minscore"/>
            <span className="font-mono w-8">{minScore}</span>
          </div>
        </div>

        {loading ? (
          <div className="font-display text-2xl">Loading jobs…</div>
        ) : jobs.length === 0 ? (
          <div className="nb-card p-10 text-center">
            <div className="font-display font-bold text-2xl mb-2">No jobs yet</div>
            <p className="text-[#525252] mb-4">Click <strong>Refresh sources</strong> to pull the latest listings.</p>
            <button onClick={refreshJobs} className="nb-btn" data-testid="btn-empty-refresh">Pull jobs now</button>
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
