import { useEffect, useState, useRef } from "react";
import { http } from "../lib/api";
import TopNav from "../components/TopNav";
import MatchBadge from "../components/MatchBadge";
import { toast } from "sonner";
import { X, Bookmark, Send, RefreshCw, MapPin, Building2, ExternalLink, Flame, Target } from "lucide-react";

export default function Discover() {
  const [jobs, setJobs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState(null);
  const cardRef = useRef(null);
  const dragStart = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [exiting, setExiting] = useState(null); // 'left' | 'right' | 'up'

  const load = async () => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([
        http.get("/jobs", { params: { min_score: 30, limit: 50 } }),
        http.get("/activity"),
      ]);
      setJobs(r.data);
      setActivity(a.data);
      setIdx(0);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const current = jobs[idx];
  const next1 = jobs[idx + 1];
  const next2 = jobs[idx + 2];

  const advance = (dir) => {
    setExiting(dir);
    setTimeout(() => {
      setIdx(i => i + 1);
      setDragX(0); setDragY(0); setExiting(null);
    }, 220);
  };

  const skip = async () => {
    if (!current) return;
    advance("left");
  };

  const save = async () => {
    if (!current) return;
    try {
      await http.post("/applications", { job_id: current.job_id, status: "saved", resume_id: current.best_match?.resume_id });
      toast.success("Saved to tracker");
      advance("right");
    } catch { toast.error("Failed to save"); }
  };

  const quickApply = async () => {
    if (!current) return;
    try {
      window.open(current.url, "_blank", "noopener,noreferrer");
      await http.post("/applications", { job_id: current.job_id, status: "applied", resume_id: current.best_match?.resume_id });
      toast.success("Opened apply page · marked as Applied");
      // refresh activity
      http.get("/activity").then(r => setActivity(r.data)).catch(() => {});
      advance("up");
    } catch { toast.error("Failed"); }
  };

  // pointer/touch drag
  const onDown = (e) => {
    const p = e.touches?.[0] || e;
    dragStart.current = { x: p.clientX, y: p.clientY };
  };
  const onMove = (e) => {
    if (!dragStart.current) return;
    const p = e.touches?.[0] || e;
    setDragX(p.clientX - dragStart.current.x);
    setDragY(p.clientY - dragStart.current.y);
  };
  const onUp = () => {
    if (!dragStart.current) return;
    if (dragY < -120) quickApply();
    else if (dragX > 140) save();
    else if (dragX < -140) skip();
    else { setDragX(0); setDragY(0); }
    dragStart.current = null;
  };

  useEffect(() => {
    const h = (e) => {
      if (e.key === "ArrowRight") save();
      else if (e.key === "ArrowLeft") skip();
      else if (e.key === "ArrowUp") quickApply();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  // eslint-disable-next-line
  }, [current]);

  const goal = activity?.daily_goal ?? 5;
  const todayCt = activity?.today ?? 0;
  const goalPct = Math.min(100, (todayCt / Math.max(goal, 1)) * 100);

  const rotate = Math.max(-15, Math.min(15, dragX / 14));
  let exitT = "";
  if (exiting === "left") exitT = "translateX(-160%) rotate(-25deg)";
  if (exiting === "right") exitT = "translateX(160%) rotate(25deg)";
  if (exiting === "up") exitT = "translateY(-120%) scale(1.05)";

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[900px] mx-auto px-6 py-8">
        {/* Daily Goal Strip */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="nb-card p-4 flex items-center gap-3" data-testid="streak-card">
            <div className="w-12 h-12 border-[1.5px] border-[#1E1E1E] bg-[#F2542D] text-white flex items-center justify-center">
              <Flame size={22}/>
            </div>
            <div>
              <div className="label-overline">Streak</div>
              <div className="font-display font-black text-2xl tracking-tighter">{activity?.streak ?? 0} {activity?.streak === 1 ? "day" : "days"}</div>
            </div>
          </div>
          <div className="nb-card p-4 flex items-center gap-3" data-testid="goal-card">
            <div className="w-12 h-12 border-[1.5px] border-[#1E1E1E] bg-pastel-purple flex items-center justify-center">
              <Target size={22}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="label-overline">Today · {todayCt}/{goal}</div>
              <div className="w-full h-3 border-[1.5px] border-[#1E1E1E] mt-1 bg-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[#0A0A0A]" style={{width: `${goalPct}%`, transition: 'width 0.4s ease'}}></div>
              </div>
            </div>
          </div>
          <div className="nb-card p-4 flex items-center gap-3" data-testid="total-card">
            <div className="w-12 h-12 border-[1.5px] border-[#1E1E1E] bg-pastel-blue flex items-center justify-center">
              <Send size={22}/>
            </div>
            <div>
              <div className="label-overline">Total sent</div>
              <div className="font-display font-black text-2xl tracking-tighter">{activity?.total ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="label-overline">Swipe-mode · ATS-matched</div>
            <h1 className="font-display font-black text-3xl lg:text-4xl tracking-tighter">Discover</h1>
            <p className="text-sm text-[#525252] mt-1">← skip · → save · ↑ quick apply &nbsp;·&nbsp; or use the buttons</p>
          </div>
          <button onClick={load} className="nb-btn-outline inline-flex items-center gap-2 text-sm" data-testid="btn-reload-deck">
            <RefreshCw size={14}/> Reload
          </button>
        </div>

        {/* Card Stack */}
        <div className="relative h-[520px] flex items-center justify-center select-none" data-testid="swipe-stack">
          {loading ? (
            <div className="font-display text-2xl">Loading deck…</div>
          ) : !current ? (
            <div className="nb-card p-10 text-center max-w-md mx-auto">
              <div className="font-display font-bold text-2xl mb-2">You're caught up 🎉</div>
              <p className="text-[#525252] mb-4">No more jobs scored 30+ for you right now. Pull fresh listings, or lower your threshold.</p>
              <button onClick={load} className="nb-btn">Reload deck</button>
            </div>
          ) : (
            <>
              {next2 && <StackCard job={next2} depth={2} />}
              {next1 && <StackCard job={next1} depth={1} />}
              <SwipeCard
                ref={cardRef}
                job={current}
                dragX={dragX} dragY={dragY} rotate={rotate}
                exitT={exitT}
                onDown={onDown} onMove={onMove} onUp={onUp}
              />
              {/* swipe hint badges */}
              {dragX > 50 && (
                <div className="absolute top-10 right-10 border-[2px] border-[#0F5132] match-high font-display font-black text-3xl px-4 py-2 rotate-12 pointer-events-none" style={{opacity: Math.min(1, dragX / 140)}}>
                  SAVE
                </div>
              )}
              {dragX < -50 && (
                <div className="absolute top-10 left-10 border-[2px] border-[#842029] match-low font-display font-black text-3xl px-4 py-2 -rotate-12 pointer-events-none" style={{opacity: Math.min(1, -dragX / 140)}}>
                  SKIP
                </div>
              )}
              {dragY < -50 && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 border-[2px] border-[#0A0A0A] bg-[#F2542D] text-white font-display font-black text-3xl px-4 py-2 pointer-events-none" style={{opacity: Math.min(1, -dragY / 120)}}>
                  APPLY
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        {current && (
          <div className="flex items-center justify-center gap-4 mt-6" data-testid="discover-actions">
            <button onClick={skip} className="w-14 h-14 border-[1.5px] border-[#1E1E1E] bg-white hover:bg-match-low transition flex items-center justify-center" data-testid="btn-skip" title="Skip (←)">
              <X size={22}/>
            </button>
            <button onClick={quickApply} className="w-16 h-16 border-[1.5px] border-[#1E1E1E] bg-[#F2542D] text-white hover:bg-[#FF6F44] transition flex items-center justify-center" data-testid="btn-quick-apply" title="Quick Apply (↑)">
              <Send size={26}/>
            </button>
            <button onClick={save} className="w-14 h-14 border-[1.5px] border-[#1E1E1E] bg-white hover:bg-match-high transition flex items-center justify-center" data-testid="btn-discover-save" title="Save (→)">
              <Bookmark size={22}/>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function StackCard({ job, depth }) {
  const scale = 1 - depth * 0.04;
  const translateY = depth * 14;
  return (
    <div
      className="absolute w-full max-w-[460px] nb-card p-6 bg-white"
      style={{
        transform: `translateY(${translateY}px) scale(${scale})`,
        zIndex: -depth,
        opacity: 1 - depth * 0.15,
      }}
    >
      <div className="font-display font-bold text-xl tracking-tight">{job.title}</div>
      <div className="text-sm text-[#525252] mt-1">{job.company} · {job.location}</div>
    </div>
  );
}

const SwipeCard = ({ job, dragX, dragY, rotate, exitT, onDown, onMove, onUp }) => {
  const best = job.best_match;
  return (
    <div
      className="absolute w-full max-w-[460px] nb-card nb-shadow p-6 bg-white cursor-grab active:cursor-grabbing"
      style={{
        transform: exitT || `translate(${dragX}px, ${dragY}px) rotate(${rotate}deg)`,
        transition: exitT ? "transform 0.22s ease" : (dragX || dragY ? "none" : "transform 0.2s ease"),
        touchAction: "none",
      }}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      data-testid="swipe-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="label-overline bg-pastel-blue px-2 py-1 border-[1.5px] border-[#1E1E1E] inline-block">{job.source}</span>
          {job.is_graduate && <span className="ml-2 label-overline match-high px-2 py-1 border-[1.5px] border-[#1E1E1E] inline-block">Graduate</span>}
        </div>
        <MatchBadge score={best?.score} size="lg"/>
      </div>
      <h2 className="font-display font-black text-2xl tracking-tighter mt-4 leading-tight">{job.title}</h2>
      <div className="text-sm text-[#525252] mt-3 space-y-1">
        <div className="flex items-center gap-1.5"><Building2 size={14}/> {job.company || "—"}</div>
        <div className="flex items-center gap-1.5"><MapPin size={14}/> {job.location}</div>
        {job.salary && <div className="font-mono text-xs">{job.salary}</div>}
      </div>
      {best?.resume_name && (
        <div className="text-xs mt-3 pt-3 border-t-[1.5px] border-dashed border-[#E5E5E5]">
          <span className="label-overline">Best resume</span>
          <div className="font-semibold mt-0.5">{best.resume_name}</div>
        </div>
      )}
      {best?.matched_skills?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {best.matched_skills.slice(0, 8).map(s => (
            <span key={s} className="text-xs match-high px-2 py-0.5 border-[1.5px] border-[#1E1E1E] font-mono">+ {s}</span>
          ))}
        </div>
      )}
      <p className="text-sm text-[#262626] mt-4 leading-relaxed line-clamp-5" style={{display:'-webkit-box', WebkitLineClamp:5, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
        {job.description}
      </p>
      <a href={job.url} target="_blank" rel="noopener noreferrer"
         className="inline-flex items-center gap-1 text-xs mt-3 underline" data-testid="link-source">
        Open on {job.source} <ExternalLink size={11}/>
      </a>
    </div>
  );
};
