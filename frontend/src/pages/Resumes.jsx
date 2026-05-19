import { useEffect, useState, useRef } from "react";
import { http } from "../lib/api";
import TopNav from "../components/TopNav";
import { toast } from "sonner";
import { Upload, Trash2, FileText } from "lucide-react";

export default function Resumes() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
      toast.success("Resume parsed by AI ✨");
      setName(""); if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); }
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
          <div className="label-overline">{resumes.length} of 5 used</div>
          <h1 className="font-display font-black text-3xl lg:text-4xl tracking-tighter">Your Resumes</h1>
          <p className="text-[#525252] mt-2 max-w-2xl">Upload up to 5 different resumes (PDF or DOCX). Tag each one with a target role — ApplyMate picks the best one for every job automatically.</p>
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {resumes.map(r => (
              <div key={r.resume_id} className="nb-card p-5 fade-up" data-testid={`resume-${r.resume_id}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="label-overline bg-pastel-purple px-2 py-1 border-[1.5px] border-[#1E1E1E] inline-block">{r.tag}</div>
                    <h3 className="font-display font-bold text-xl tracking-tight mt-2 truncate">{r.name}</h3>
                    <div className="text-xs text-[#525252] mt-0.5 truncate">{r.filename}</div>
                  </div>
                  <button onClick={()=>del(r.resume_id)} className="nb-btn-outline p-2" data-testid={`btn-delete-${r.resume_id}`}>
                    <Trash2 size={14}/>
                  </button>
                </div>
                <p className="text-sm mt-3 leading-relaxed">{r.summary || "—"}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {(r.skills || []).slice(0, 10).map(s => (
                    <span key={s} className="text-xs border-[1.5px] border-[#1E1E1E] px-2 py-0.5 bg-[#F6F4ED] font-mono">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
