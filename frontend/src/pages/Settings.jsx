import { useEffect, useState } from "react";
import { http } from "../lib/api";
import TopNav from "../components/TopNav";
import { toast } from "sonner";

export default function Settings() {
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    http.get("/preferences").then(r => setPrefs(r.data));
  }, []);

  if (!prefs) return <div className="min-h-screen"><TopNav /><div className="p-10">Loading…</div></div>;

  const save = async () => {
    setSaving(true);
    try {
      await http.put("/preferences", prefs);
      toast.success("Preferences saved");
    } catch { toast.error("Failed"); }
    setSaving(false);
  };

  const setField = (k, v) => setPrefs({ ...prefs, [k]: v });

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[800px] mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="label-overline">Tune your feed</div>
          <h1 className="font-display font-black text-3xl lg:text-4xl tracking-tighter">Settings</h1>
        </div>

        <div className="nb-card p-6 space-y-5">
          <div>
            <div className="label-overline mb-1">Target roles (comma separated)</div>
            <input className="nb-input" value={prefs.target_roles.join(", ")}
              onChange={e=>setField("target_roles", e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}
              placeholder="Data Analyst, Marketing Coordinator, Software Engineer"
              data-testid="input-target-roles"/>
          </div>
          <div>
            <div className="label-overline mb-1">Preferred locations</div>
            <input className="nb-input" value={prefs.locations.join(", ")}
              onChange={e=>setField("locations", e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}
              placeholder="Sydney, Melbourne, Remote"
              data-testid="input-locations"/>
          </div>
          <div>
            <div className="label-overline mb-1">Minimum salary (AUD)</div>
            <input type="number" className="nb-input" value={prefs.salary_min}
              onChange={e=>setField("salary_min", parseInt(e.target.value||0))}
              data-testid="input-salary"/>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={prefs.remote_ok} onChange={e=>setField("remote_ok", e.target.checked)} data-testid="toggle-remote"/>
              <span>Remote OK</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={prefs.graduate_only} onChange={e=>setField("graduate_only", e.target.checked)} data-testid="toggle-grad"/>
              <span>Graduate roles only</span>
            </label>
          </div>
          <button onClick={save} disabled={saving} className="nb-btn" data-testid="btn-save-prefs">
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>

        <div className="nb-card p-6 mt-6 bg-sand">
          <h3 className="font-display font-bold text-lg tracking-tight mb-2">About auto-apply</h3>
          <p className="text-sm text-[#525252] leading-relaxed">
            SEEK, LinkedIn, Indeed and Hays prohibit automated applications. ApplyMate gives you 
            a tailored resume match + cover letter per job, then takes you straight to the source 
            to apply with one click. For Workday/Greenhouse forms we'll add an assisted-apply 
            extension in a future release.
          </p>
        </div>
      </main>
    </div>
  );
}
