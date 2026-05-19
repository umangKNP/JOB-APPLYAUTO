import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../lib/api";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const sid = params.get("session_id");
    if (!sid) { navigate("/", { replace: true }); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await http.post("/auth/google", { session_id: sid });
        if (cancelled) return;
        window.history.replaceState({}, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: r.data } });
      } catch (e) {
        navigate("/", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center font-display text-2xl">
      Signing you in…
    </div>
  );
}
