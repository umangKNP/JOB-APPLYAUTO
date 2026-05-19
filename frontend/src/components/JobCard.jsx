import { Link } from "react-router-dom";
import MatchBadge from "./MatchBadge";
import { MapPin, Building2, Clock, ExternalLink } from "lucide-react";

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const sourceColor = (s) => {
  const map = {
    "SEEK": "bg-pastel-blue",
    "LinkedIn": "bg-pastel-purple",
    "Indeed": "match-medium",
    "Jora": "match-high",
    "Remotive": "bg-[#FFE5D9]",
    "The Muse": "bg-[#E0F0E0]",
    "Workforce Australia": "match-medium",
    "Adzuna AU": "bg-pastel-blue",
    "Hays": "bg-pastel-purple",
    "CareerOne": "match-low",
    "My Future": "match-high",
    "Toozly": "bg-[#FFE5D9]",
  };
  return map[s] || "bg-sand";
};

export default function JobCard({ job }) {
  const best = job.best_match;
  const app = job.application;
  return (
    <div className="nb-card hoverable p-5 flex flex-col gap-3 fade-up" data-testid={`job-card-${job.job_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`label-overline ${sourceColor(job.source)} px-2 py-1 border-[1.5px] border-[#1E1E1E] inline-block`}>{job.source}</span>
          {job.is_graduate && <span className="ml-2 label-overline match-high px-2 py-1 border-[1.5px] border-[#1E1E1E] inline-block">Graduate</span>}
        </div>
        <MatchBadge score={best?.score} size="sm" />
      </div>
      <Link to={`/jobs/${job.job_id}`} state={{ job }} className="block group" data-testid={`job-title-${job.job_id}`}>
        <h3 className="font-display font-bold text-xl leading-tight tracking-tight group-hover:underline">{job.title}</h3>
      </Link>
      <div className="text-sm text-[#525252] space-y-1">
        <div className="flex items-center gap-1.5"><Building2 size={14}/> {job.company || "—"}</div>
        <div className="flex items-center gap-1.5"><MapPin size={14}/> {job.location}</div>
        <div className="flex items-center gap-1.5"><Clock size={14}/> {timeAgo(job.posted_at)}</div>
        {job.salary && <div className="font-mono text-xs">{job.salary}</div>}
      </div>
      {best && (
        <div className="text-xs border-t-[1.5px] border-dashed border-[#E5E5E5] pt-2">
          <span className="label-overline">Best Resume</span>
          <div className="font-semibold text-[#0A0A0A] mt-0.5">{best.resume_name}</div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-1">
        <Link to={`/jobs/${job.job_id}`} state={{ job }} className="nb-btn-outline text-xs" data-testid={`btn-view-${job.job_id}`}>
          View & Tailor
        </Link>
        <a href={job.url} target="_blank" rel="noopener noreferrer"
           className="nb-btn text-xs inline-flex items-center gap-1" data-testid={`btn-apply-${job.job_id}`}>
          Apply <ExternalLink size={12}/>
        </a>
      </div>
      {app && (
        <div className="text-xs mt-1 px-2 py-1 border-[1.5px] border-[#1E1E1E] bg-[#F6F4ED] inline-block self-start font-mono uppercase tracking-wider" data-testid={`app-status-${job.job_id}`}>
          {app.status}
        </div>
      )}
    </div>
  );
}
