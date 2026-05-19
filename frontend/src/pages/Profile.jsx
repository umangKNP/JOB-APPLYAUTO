import { useEffect, useState } from "react";
import { http } from "../lib/api";
import TopNav from "../components/TopNav";
import { toast } from "sonner";
import { User, Phone, Linkedin, Github, Globe, Briefcase, DollarSign, Clock, MapPin } from "lucide-react";

const VISA_OPTIONS = ["Australian Citizen", "Permanent Resident", "Working Visa (482)", "Working Holiday", "Student Visa", "Other / Not specified"];

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    http.get("/profile").then(r => setProfile(r.data));
  }, []);

  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await http.put("/profile", profile);
      toast.success("Profile saved · ready for 1-click apply");
    } catch { toast.error("Failed"); }
    setSaving(false);
  };

  if (!profile) return <div className="min-h-screen"><TopNav/><div className="p-10">Loading…</div></div>;

  // completeness
  const fields = ["phone", "linkedin", "location_city", "visa_status", "expected_salary", "notice_period", "short_pitch"];
  const filled = fields.filter(f => profile[f] && profile[f].toString().trim().length > 0).length;
  const pct = Math.round((filled / fields.length) * 100);

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[860px] mx-auto px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="label-overline">Powers 1-click apply</div>
            <h1 className="font-display font-black text-3xl lg:text-4xl tracking-tighter">Application Profile</h1>
            <p className="text-sm text-[#525252] mt-1 max-w-xl">Fill in once. ApplyMate auto-fills these answers on every application — visa, salary, notice period, links.</p>
          </div>
          <div className="nb-card p-3 min-w-[200px]" data-testid="profile-completeness">
            <div className="label-overline">Profile completeness</div>
            <div className="flex items-center gap-3 mt-1">
              <div className="font-display font-black text-3xl tracking-tighter">{pct}%</div>
              <div className="flex-1 h-3 border-[1.5px] border-[#1E1E1E] bg-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[#F2542D]" style={{width:`${pct}%`, transition:'width 0.4s'}}/>
              </div>
            </div>
          </div>
        </div>

        <div className="nb-card p-6 space-y-6">
          <Section title="Contact & Links" icon={<User size={16}/>}>
            <Field icon={<Phone size={14}/>} label="Phone" value={profile.phone} onChange={v=>set("phone", v)} placeholder="+61 4xx xxx xxx" testid="input-phone"/>
            <Field icon={<Linkedin size={14}/>} label="LinkedIn URL" value={profile.linkedin} onChange={v=>set("linkedin", v)} placeholder="https://linkedin.com/in/you" testid="input-linkedin"/>
            <Field icon={<Github size={14}/>} label="GitHub URL" value={profile.github} onChange={v=>set("github", v)} placeholder="https://github.com/you" testid="input-github"/>
            <Field icon={<Globe size={14}/>} label="Portfolio / website" value={profile.portfolio} onChange={v=>set("portfolio", v)} placeholder="https://yourdomain.com" testid="input-portfolio"/>
          </Section>

          <Section title="Work Eligibility & Logistics" icon={<Briefcase size={16}/>}>
            <Field icon={<MapPin size={14}/>} label="Current city" value={profile.location_city} onChange={v=>set("location_city", v)} placeholder="Sydney" testid="input-city"/>
            <div>
              <div className="label-overline mb-1 flex items-center gap-1.5"><Briefcase size={14}/> Visa status</div>
              <select value={profile.visa_status} onChange={e=>set("visa_status", e.target.value)} className="nb-input" data-testid="input-visa">
                <option value="">Select…</option>
                {VISA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <Field icon={<DollarSign size={14}/>} label="Expected salary (AUD)" value={profile.expected_salary} onChange={v=>set("expected_salary", v)} placeholder="e.g. $110k - $130k" testid="input-salary"/>
            <Field icon={<Clock size={14}/>} label="Notice period" value={profile.notice_period} onChange={v=>set("notice_period", v)} placeholder="e.g. 4 weeks · Immediate" testid="input-notice"/>
            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="checkbox" checked={!!profile.open_to_remote} onChange={e=>set("open_to_remote", e.target.checked)} data-testid="toggle-remote"/>
                Open to remote
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="checkbox" checked={!!profile.open_to_relocate} onChange={e=>set("open_to_relocate", e.target.checked)} data-testid="toggle-relocate"/>
                Open to relocate
              </label>
            </div>
          </Section>

          <Section title="30-second pitch" icon={<User size={16}/>}>
            <textarea
              className="nb-input min-h-[120px]"
              placeholder="Two or three sentences a recruiter could paste verbatim. Drives the auto-cover-letter."
              value={profile.short_pitch}
              onChange={e=>set("short_pitch", e.target.value)}
              data-testid="input-pitch"
            />
          </Section>

          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="nb-btn" data-testid="btn-save-profile">
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div>
      <div className="label-overline flex items-center gap-1.5 mb-3">{icon} {title}</div>
      <div className="grid md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ icon, label, value, onChange, placeholder, testid }) {
  return (
    <div>
      <div className="label-overline mb-1 flex items-center gap-1.5">{icon} {label}</div>
      <input className="nb-input" value={value || ""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} data-testid={testid}/>
    </div>
  );
}
