import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import { ArrowRight, Sparkles, Target, Briefcase, FileSearch, Zap } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-12 font-display text-2xl">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  const startAuth = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex flex-col" data-testid="landing-page">
      <header className="border-b-[1.5px] border-[#1E1E1E]">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-display font-black text-2xl tracking-tighter">
            <span className="inline-block w-7 h-7 bg-[#F2542D] border-[1.5px] border-[#1E1E1E]" />
            ApplyMate<span className="text-[#F2542D]">.AU</span>
          </div>
          <button onClick={startAuth} className="nb-btn text-sm" data-testid="btn-signin-top">
            Sign in with Google
          </button>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-[1400px] mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-7">
            <div className="label-overline">Job-hunt copilot · Built for Australia</div>
            <h1 className="font-display font-black text-5xl lg:text-7xl tracking-tighter leading-[0.95]">
              Stop scrolling.<br/>
              Start <span className="bg-[#F2542D] text-white px-3">applying.</span>
            </h1>
            <p className="text-lg text-[#525252] max-w-xl leading-relaxed">
              ApplyMate pulls fresh jobs from SEEK, LinkedIn, Indeed, Jora, Workforce Australia,
              The Muse, Remotive and more — every 12 hours. Upload up to 5 resumes, and our AI
              scores every job against each one, picks the right resume, and drafts a tailored
              cover letter in seconds.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={startAuth} className="nb-btn inline-flex items-center gap-2 text-base" data-testid="btn-signin-hero">
                Sign in with Google <ArrowRight size={18}/>
              </button>
              <a href="#how" className="nb-btn-outline inline-flex items-center gap-2 text-base">
                How it works
              </a>
            </div>
            <div className="flex gap-6 pt-3 text-sm text-[#525252]">
              <div><span className="font-display font-black text-2xl text-[#0A0A0A]">10+</span><br/>job boards</div>
              <div><span className="font-display font-black text-2xl text-[#0A0A0A]">5</span><br/>resumes</div>
              <div><span className="font-display font-black text-2xl text-[#0A0A0A]">12h</span><br/>refresh cycle</div>
            </div>
          </div>

          <div className="relative">
            <div className="nb-card nb-shadow p-6 space-y-4 bg-white">
              <div className="flex items-center justify-between">
                <span className="label-overline bg-pastel-blue px-2 py-1 border-[1.5px] border-[#1E1E1E]">SEEK</span>
                <div className="border-[1.5px] border-[#1E1E1E] match-high font-display font-black px-3 py-2 text-2xl leading-none">94<span className="text-xs font-mono font-normal opacity-70">/100</span></div>
              </div>
              <div>
                <h3 className="font-display font-bold text-2xl tracking-tight">Graduate Software Engineer</h3>
                <div className="text-sm text-[#525252] mt-1">Atlassian · Sydney, NSW · Posted 2h ago</div>
              </div>
              <div className="text-xs label-overline">Best Resume</div>
              <div className="font-semibold">resume_swe_grad.pdf</div>
              <div className="flex gap-2 pt-2">
                <button className="nb-btn-outline text-xs">Cover letter</button>
                <button className="nb-btn text-xs">Apply</button>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 nb-card nb-shadow p-4 bg-pastel-purple w-56 hidden md:block">
              <div className="label-overline">Daily Stats</div>
              <div className="font-display font-black text-3xl mt-1">42</div>
              <div className="text-xs text-[#525252]">new jobs matched</div>
            </div>
          </div>
        </section>

        <section id="how" className="border-t-[1.5px] border-[#1E1E1E] bg-sand">
          <div className="max-w-[1400px] mx-auto px-6 py-16">
            <h2 className="font-display font-bold text-3xl lg:text-4xl tracking-tight mb-10">How ApplyMate works</h2>
            <div className="grid md:grid-cols-4 gap-5">
              {[
                { icon: FileSearch, title: "Upload 5 resumes", body: "Tag each with the role it targets — Data, Marketing, Engineering, etc." },
                { icon: Sparkles, title: "AI parses + indexes", body: "Claude Sonnet 4.5 extracts your skills and builds a profile per resume." },
                { icon: Target, title: "12-hour fresh feed", body: "We pull jobs from SEEK, LinkedIn, Indeed, Jora, Workforce AU, The Muse + more." },
                { icon: Zap, title: "Match → Apply", body: "Each job gets a 0–100 score per resume. 1-click cover letter, then Apply." },
              ].map((s, i) => {
                const Ic = s.icon;
                return (
                  <div key={i} className="nb-card p-5 bg-white">
                    <div className="w-10 h-10 border-[1.5px] border-[#1E1E1E] bg-[#F2542D] text-white flex items-center justify-center mb-3">
                      <Ic size={20}/>
                    </div>
                    <div className="font-display font-bold text-lg tracking-tight">{s.title}</div>
                    <div className="text-sm text-[#525252] mt-1">{s.body}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="nb-card nb-shadow p-8 lg:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-[#0A0A0A] text-white border-[#0A0A0A]">
            <div>
              <div className="label-overline text-white/60">Ready in 60 seconds</div>
              <h3 className="font-display font-black text-3xl lg:text-4xl tracking-tighter mt-2">Sign in. Upload. Start applying.</h3>
            </div>
            <button onClick={startAuth} className="border-[1.5px] border-white bg-[#F2542D] px-6 py-3 font-bold text-base hover:bg-[#FF6F44] transition" data-testid="btn-signin-cta">
              Continue with Google →
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t-[1.5px] border-[#1E1E1E] py-6 text-center text-xs text-[#525252]">
        ApplyMate.AU · Built for Australian job seekers · Auto-refreshes every 12 hours
      </footer>
    </div>
  );
}
