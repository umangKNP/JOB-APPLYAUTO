export default function MatchBadge({ score, size = "lg" }) {
  if (score == null) return (
    <div data-testid="match-na" className="border-[1.5px] border-[#1E1E1E] bg-[#F6F4ED] px-3 py-2 font-mono text-xs">
      NOT SCORED
    </div>
  );
  const cls = score >= 80 ? "match-high" : score >= 55 ? "match-medium" : "match-low";
  const dims = size === "lg" ? "px-4 py-3 text-3xl" : "px-3 py-2 text-xl";
  return (
    <div data-testid={`match-score-${score}`} className={`border-[1.5px] border-[#1E1E1E] font-display font-black ${cls} ${dims} inline-flex items-baseline gap-1 leading-none`}>
      {score}<span className="text-xs font-mono font-normal opacity-70">/100</span>
    </div>
  );
}
