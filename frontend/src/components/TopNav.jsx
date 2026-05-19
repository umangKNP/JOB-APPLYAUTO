import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Layers, FileText, KanbanSquare, Settings, LogOut, LayoutDashboard, UserCircle } from "lucide-react";

const tabs = [
  { to: "/dashboard", label: "Jobs", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/discover", label: "Discover", icon: Layers, testid: "nav-discover" },
  { to: "/resumes", label: "Resumes", icon: FileText, testid: "nav-resumes" },
  { to: "/profile", label: "Profile", icon: UserCircle, testid: "nav-profile" },
  { to: "/tracker", label: "Tracker", icon: KanbanSquare, testid: "nav-tracker" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function TopNav() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  return (
    <header className="border-b-[1.5px] border-[#1E1E1E] bg-[#FDFBF7] sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 py-3 gap-6">
        <Link to="/dashboard" className="flex items-center gap-2 font-display font-black text-2xl tracking-tighter" data-testid="logo-home">
          <span className="inline-block w-7 h-7 bg-[#F2542D] border-[1.5px] border-[#1E1E1E]" />
          ApplyMate<span className="text-[#F2542D]">.AU</span>
        </Link>
        <nav className="flex items-center gap-1">
          {tabs.map(t => {
            const active = loc.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link key={t.to} to={t.to} data-testid={t.testid}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-[1.5px] ${active ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "border-transparent hover:border-[#1E1E1E]"}`}>
                <Icon size={16} /> {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {user?.picture && <img src={user.picture} alt={user.name} className="w-8 h-8 border-[1.5px] border-[#1E1E1E]" />}
          <div className="hidden sm:block text-sm">
            <div className="font-semibold leading-tight" data-testid="user-name">{user?.name}</div>
            <div className="text-[#525252] text-xs leading-tight">{user?.email}</div>
          </div>
          <button onClick={logout} className="nb-btn-outline flex items-center gap-1 text-sm" data-testid="btn-logout">
            <LogOut size={14}/> Logout
          </button>
        </div>
      </div>
    </header>
  );
}
