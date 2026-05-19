import { useEffect, useState, useRef } from "react";
import { http } from "../lib/api";
import TopNav from "../components/TopNav";
import { toast } from "sonner";
import { Upload, Trash2, FileText, RefreshCw, Award, GraduationCap, Languages, Wrench, Lightbulb, Sparkles } from "lucide-react";

export default function Resumes() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reparsingId, setReparsingId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [name, setName] = useState("");
  const [tag, setTag] = useState("Software Engineer");
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await http.get("/resumes");
      setResumes(r.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const upload = async (e) => {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) { toast.error("Pick a file"); return; }
    if (!name) { toast.error("Give it a name"); return; }
    if (resumes.length >= 5) { toast.error("Max 5 resumes"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("name", name);
    fd.append("tag", tag);
    try {
      await http.post("/resumes", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Resume parsed by Claude — ATS score & insights ready");
      setName(""); if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); }
  };

  const reparse = async (id) => {
    setReparsingId(id);
    try {
      await http.post(`/resumes/${id}/reparse`);
      toast.success("Re-parsed with latest AI prompt");
      await load();
    } catch { toast.error("Failed"); }
    setReparsingId(null);
  };

  const del = async (id) => {
    if (!window.confirm("Delete this resume?")) return;
    try { await http.delete(`/resumes/${id}`); await load(); toast.success("Deleted"); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="label-overline">{resumes.length} of 5 used · powered by Claude Sonnet 4.5 + OCR</div>
          <h1 className="font-display font-black text-3xl lg:text-4xl tracking-tighter">Your Resumes</h1>
          <p className="text-[#525252] mt-2 max-w-2xl">Upload up to 5 different resumes (PDF or DOCX — scanned PDFs handled via OCR). Tag each with a target role; ApplyMate extracts ATS keywords + an ATS-friendliness score and picks the best resume for every job automatically.</p>
        </div>

        <form onSubmit={upload} className="nb-card p-5 mb-8 grid md:grid-cols-4 gap-3 items-end" data-testid="resume-upload-form">
          <div>
            <div className="label-overline mb-1">Display name</div>
            <input className="nb-input" placeholder="e.g. SWE Grad v3" value={name} onChange={e=>setName(e.target.value)} data-testid="input-resume-name"/>
          </div>
          <div>
            <div className="label-overline mb-1">Role tag</div>
            <input className="nb-input" value={tag} onChange={e=>setTag(e.target.value)} data-testid="input-resume-tag"/>
          </div>
          <div>
            <div className="label-overline mb-1">File (PDF / DOCX)</div>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="nb-input text-sm py-2" data-testid="input-resume-file"/>
          </div>
          <button disabled={uploading || resumes.length >= 5} type="submit" className="nb-btn flex items-center gap-2 justify-center" data-testid="btn-upload-resume">
            <Upload size={16}/> {uploading ? "Parsing…" : "Upload + Parse"}
          </button>
        </form>

        {loading ? <div>Loading…</div> : resumes.length === 0 ? (
          <div className="nb-card p-10 text-center">
            <FileText size={32} className="mx-auto mb-2"/>
            <p>No resumes yet. Upload your first one above.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-5">
            {resumes.map(r => {
              const open = expanded[r.resume_id];
              const ats = r.ats_score || 0;
              const atsClass = ats >= 80 ? "match-high" : ats >= 55 ? "match-medium" : "match-low";
              return (
                <div key={r.resume_id} className="nb-card p-5 fade-up" data-testid={`resume-${r.resume_id}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="label-overline bg-pastel-purple px-2 py-1 border-[1.5px] border-[#1E1E1E] inline-block">{r.tag}</div>
                        {r.seniority && <div className="label-overline bg-pastel-blue px-2 py-1 border-[1.5px] border-[#1E1E1E] inline-block">{r.seniority}</div>}
                        {r.years_experience > 0 && <div className="text-xs font-mono">{r.years_experience}y exp</div>}
                      </div>
                      <h3 className="font-display font-bold text-xl tracking-tight mt-2 truncate">{r.name}</h3>
                      <div className="text-xs text-[#525252] mt-0.5 truncate">{r.filename}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className={`${atsClass} border-[1.5px] border-[#1E1E1E] font-display font-black px-2 py-1 text-lg leading-none`} data-testid={`ats-${r.resume_id}`}>
                        ATS {ats}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={()=>reparse(r.resume_id)} disabled={reparsingId===r.resume_id} className="nb-btn-outline p-2" title="Re-parse" data-testid={`btn-reparse-${r.resume_id}`}>
                          <RefreshCw size={14} className={reparsingId===r.resume_id ? "animate-spin" : ""}/>
                        </button>
                        <button onClick={()=>del(r.resume_id)} className="nb-btn-outline p-2" data-testid={`btn-delete-${r.resume_id}`}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm mt-3 leading-relaxed">{r.summary || "—"}</p>

                  {r.role_titles?.length > 0 && (
                    <div className="mt-3 text-xs text-[#525252]">Targets: <strong className="text-[#0A0A0A]">{r.role_titles.join(" · ")}</strong></div>
                  )}

                  <div className="mt-3">
                    <div className="label-overline mb-1">Core skills · {r.skills?.length || 0}</div>
                    <div className="flex flex-wrap gap-1">
                      {(r.skills || []).slice(0, 14).map(s => (
                        <span key={s} className="text-xs border-[1.5px] border-[#1E1E1E] px-2 py-0.5 bg-[#F6F4ED] font-mono">{s}</span>
                      ))}
                    </div>
                  </div>

                  {open && (
                    <>
                      {r.adjacent_skills?.length > 0 && (
                        <ChipBlock icon={<Sparkles size={12}/>} label={`Adjacent / synonyms · ${r.adjacent_skills.length}`} items={r.adjacent_skills} bg="bg-pastel-blue"/>
                      )}
                      {r.tools?.length > 0 && (
                        <ChipBlock icon={<Wrench size={12}/>} label={`Tools · ${r.tools.length}`} items={r.tools} bg="bg-sand"/>
                      )}
                      {r.soft_skills?.length > 0 && (
                        <ChipBlock icon={<Lightbulb size={12}/>} label="Soft skills" items={r.soft_skills} bg="bg-pastel-purple"/>
                      )}
                      {r.certifications?.length > 0 && (
                        <ChipBlock icon={<Award size={12}/>} label="Certifications" items={r.certifications} bg="match-high"/>
                      )}
                      {r.education?.length > 0 && (
                        <ChipBlock icon={<GraduationCap size={12}/>} label="Education" items={r.education} bg="bg-sand"/>
                      )}
                      {r.languages?.length > 0 && (
                        <ChipBlock icon={<Languages size={12}/>} label="Languages" items={r.languages} bg="match-medium"/>
                      )}
                      {r.achievements?.length > 0 && (
                        <div className="mt-3">
                          <div className="label-overline mb-1">Top achievements</div>
                          <ul className="text-sm space-y-1 list-disc pl-5">
                            {r.achievements.map((a, i) => <li key={i}>{a}</li>)}
                          </ul>
                        </div>
                      )}
                      {r.ats_tips?.length > 0 && (
                        <div className="mt-4 border-[1.5px] border-[#1E1E1E] bg-[#FFEACC] p-3">
                          <div className="label-overline mb-1">Boost your ATS score</div>
                          <ul className="text-sm space-y-1 list-disc pl-5">
                            {r.ats_tips.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  <button onClick={()=>setExpanded(e => ({...e, [r.resume_id]: !e[r.resume_id]}))} className="text-xs font-semibold underline mt-3" data-testid={`btn-toggle-${r.resume_id}`}>
                    {open ? "Show less" : "Show all parsed fields"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function ChipBlock({ icon, label, items, bg }) {
  return (
    <div className="mt-3">
      <div className="label-overline mb-1 flex items-center gap-1.5">{icon} {label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((s, i) => (
          <span key={i} className={`text-xs border-[1.5px] border-[#1E1E1E] px-2 py-0.5 ${bg} font-mono`}>{s}</span>
        ))}
      </div>
    </div>
  );
}
