import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "sonner";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Discover from "./pages/Discover";
import Resumes from "./pages/Resumes";
import Profile from "./pages/Profile";
import JobDetail from "./pages/JobDetail";
import Tracker from "./pages/Tracker";
import Settings from "./pages/Settings";
import AuthCallback from "./pages/AuthCallback";
import "./App.css";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-12 font-display text-2xl">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
      <Route path="/resumes" element={<ProtectedRoute><Resumes /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
      <Route path="/tracker" element={<ProtectedRoute><Tracker /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
