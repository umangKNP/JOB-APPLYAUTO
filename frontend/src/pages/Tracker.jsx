import { useEffect, useState } from "react";
import { http } from "../lib/api";
import TopNav from "../components/TopNav";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

const COLS = [
  { id: "saved", label: "Saved", bg: "bg-pastel-blue" },
  { id: "applied", label: "Applied", bg: "bg-pastel-purple" },
  { id: "interview", label: "Interview", bg: "match-medium" },
  { id: "offer", label: "Offer", bg: "match-high" },
  { id: "rejected", label: "Rejected", bg: "match-low" },
];

export default function Tracker() {
  const [apps, setApps] = useState([]);

  const load = async () => {
    const r = await http.get("/applications");
    setApps(r.data);
  };
  useEffect(() => { load(); }, []);

  const move = async (appItem, status) => {
    await http.patch(`/applications/${appItem.app_id}`, { status });
    toast.success(`Moved to ${status}`);
    await load();
  };

  const onDrop = (e, status) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const a = apps.find(x => x.app_id === id);
    if (a && a.status !== status) move(a, status);
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[1500px] mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="label-overline">Application pipeline · {apps.length} total</div>
          <h1 className="font-display font-black text-3xl lg:text-4xl tracking-tighter">Tracker</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLS.map(c => {
            const items = apps.filter(a => a.status === c.id);
            return (
              <div key={c.id} className="nb-card p-3 min-h-[400px]"
                onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e, c.id)}
                data-testid={`col-${c.id}`}>
                <div className={`label-overline ${c.bg} px-2 py-1.5 border-[1.5px] border-[#1E1E1E] inline-block`}>
                  {c.label} · {items.length}
                </div>
                <div className="mt-3 space-y-3">
                  {items.map(a => (
                    <div key={a.app_id} draggable
                      onDragStart={e=>e.dataTransfer.setData("text/plain", a.app_id)}
                      className="border-[1.5px] border-[#1E1E1E] p-3 bg-white cursor-grab active:cursor-grabbing hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0_#1E1E1E] transition"
                      data-testid={`app-card-${a.app_id}`}>
                      <div className="text-xs text-[#525252] font-mono">{a.job?.source}</div>
                      <div className="font-display font-bold text-base tracking-tight leading-tight">{a.job?.title}</div>
                      <div className="text-xs text-[#525252] mt-1">{a.job?.company} · {a.job?.location}</div>
                      {a.job?.url && (
                        <a href={a.job.url} target="_blank" rel="noopener noreferrer" className="text-xs inline-flex items-center gap-1 mt-2 hover:underline">
                          Open <ExternalLink size={10}/>
                        </a>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {COLS.filter(x=>x.id!==a.status).map(x=>(
                          <button key={x.id} onClick={()=>move(a, x.id)}
                            className="text-[10px] border-[1.5px] border-[#1E1E1E] px-1.5 py-0.5 font-mono uppercase hover:bg-[#F6F4ED]"
                            data-testid={`move-${a.app_id}-${x.id}`}>
                            → {x.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
