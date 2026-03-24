import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { NotificationBell } from "@/components/NotificationBell";

interface TraderLayoutProps {
  children: ReactNode;
}

const NAV = [
  { label: "Dashboard",         path: "/dashboard/trader",           icon: "grid" },
  { label: "Search Containers", path: "/dashboard/trader/search",    icon: "search" },
  { label: "My Bookings",       path: "/dashboard/trader/bookings",  icon: "clipboard" },
  { label: "Auctions",          path: "/dashboard/trader/auctions",  icon: "zap" },
  { label: "Documents",         path: "/dashboard/trader/documents", icon: "file" },
  { label: "Payments",          path: "/dashboard/trader/payments",  icon: "dollar" },
  { label: "Invoices",          path: "/dashboard/trader/invoices",  icon: "invoice" },
  { label: "Analytics",         path: "/dashboard/trader/analytics", icon: "bar" },
  { label: "Messages",          path: "/dashboard/trader/messages",  icon: "message" },
  { label: "Settings",          path: "/dashboard/trader/settings",  icon: "settings" },
]

const ICON_PATHS: Record<string, string> = {
  grid:      "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  search:    "M11 11m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0M21 21l-4.35-4.35",
  clipboard: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M8 2h8v4H8z",
  dollar:    "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  invoice:   "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  bar:       "M18 20V10M12 20V4M6 20v-6",
  message:   "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  settings:  "M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M19.07 4.93a10 10 0 0 1 0 14.14M5.93 4.93a10 10 0 0 0 0 14.14",
  signout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  zap:       "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  file:      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  bell:      "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
}

function SvgIcon({ t, col = "rgba(255,255,255,0.4)" }: { t: string; col?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[t]?.split("M").filter(Boolean).map((d, i) => <path key={i} d={"M" + d} />)}
    </svg>
  )
}

const s: Record<string, React.CSSProperties> = {
  shell:        { display: "flex", minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "system-ui,sans-serif" },
  sidebar:      { width: 212, minWidth: 212, background: "#0f0f18", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 },
  logoWrap:     { display: "flex", alignItems: "center", gap: 10, padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  logoIcon:     { width: 28, height: 28, background: "rgba(168,85,247,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  logoText:     { fontSize: 13, fontWeight: 700, color: "#a855f7", lineHeight: 1.1 },
  logoSub:      { fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 },
  navSection:   { fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.18)", letterSpacing: ".12em", padding: "14px 16px 6px" },
  nav:          { flex: 1, padding: "4px 8px", display: "flex", flexDirection: "column", gap: 1 },
  navItem:      { display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, cursor: "pointer", transition: "background 0.15s" },
  navActive:    { background: "rgba(168,85,247,0.12)", borderLeft: "2px solid #a855f7", paddingLeft: 8 },
  navLabel:     { fontSize: 12 },
  navBadge:     { marginLeft: "auto", fontSize: 9, background: "#a855f7", color: "#fff", borderRadius: 9, padding: "1px 5px", fontWeight: 700 },
  footer:       { padding: "10px 8px", borderTop: "1px solid rgba(255,255,255,0.06)" },
  userRow:      { display: "flex", alignItems: "center", gap: 8, padding: "8px", borderRadius: 8, background: "rgba(255,255,255,0.03)" },
  avatar:       { width: 28, height: 28, borderRadius: "50%", background: "rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#a855f7", flexShrink: 0 },
  userInfo:     { flex: 1, minWidth: 0 },
  userName:     { fontSize: 11, color: "#fff", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userEmail:    { fontSize: 9, color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  signOutBtn:   { background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex", alignItems: "center", flexShrink: 0 },
  main:         { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0a0a0f", position: "sticky", top: 0, zIndex: 10 },
  topbarTitle:  { fontSize: 20, fontWeight: 700, color: "#fff" },
  topbarSub:    { fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 },
  searchBtn:    { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  newBookingBtn:{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#7c3aed", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  content:      { flex: 1, padding: "24px", overflowY: "auto" },
}

const TraderLayout = ({ children }: TraderLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email || "");
        setUserId(session.user.id);
        // Fetch pending booking count
        supabase
          .from("bookings")
          .select("id", { count: "exact" })
          .eq("trader_id", session.user.id)
          .eq("status", "pending")
          .then(({ count }) => setPendingCount(count ?? 0));
      }
    });
  }, []);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: "Error signing out", description: error.message, variant: "destructive" });
    } else {
      navigate("/auth");
    }
  };

  // Determine current page title from path
  const currentNav = NAV.find(n => n.path === location.pathname);
  const pageTitle = currentNav?.label ?? "Trader Panel";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <div style={s.shell}>
      {/* ── Sidebar ── */}
      <div style={s.sidebar}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div>
            <div style={s.logoText}>CargoHub</div>
            <div style={s.logoSub}>Trader</div>
          </div>
        </div>

        {/* Nav section label */}
        <div style={s.navSection}>TRADER PANEL</div>

        {/* Nav items */}
        <nav style={s.nav}>
          {NAV.map(item => {
            const active = location.pathname === item.path;
            return (
              <div
                key={item.path}
                style={{ ...s.navItem, ...(active ? s.navActive : {}) }}
                onClick={() => navigate(item.path)}
              >
                <SvgIcon t={item.icon} col={active ? "#a855f7" : "rgba(255,255,255,0.4)"} />
                <span style={{ ...s.navLabel, color: active ? "#a855f7" : "rgba(255,255,255,0.55)" }}>
                  {item.label}
                </span>
                {item.label === "My Bookings" && pendingCount > 0 && (
                  <span style={s.navBadge}>{pendingCount}</span>
                )}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={s.footer}>
          <div style={s.userRow}>
            <div style={s.avatar}>
              {(userEmail || "T").substring(0, 2).toUpperCase()}
            </div>
            <div style={s.userInfo}>
              <div style={s.userName}>{userEmail.split("@")[0] || "Trader"}</div>
              <div style={s.userEmail}>{userEmail.substring(0, 20)}{userEmail.length > 20 ? "…" : ""}</div>
            </div>
            <button style={s.signOutBtn} onClick={handleSignOut} title="Sign out">
              <SvgIcon t="signout" col="rgba(255,255,255,0.3)" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={s.main}>
        {/* Topbar */}
        <div style={s.topbar}>
          <div>
            <div style={s.topbarTitle}>{pageTitle}</div>
            <div style={s.topbarSub}>{today}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {userId && <NotificationBell userId={userId} />}
            <button style={s.searchBtn} onClick={() => navigate("/dashboard/trader/search")}>
              <SvgIcon t="search" col="rgba(255,255,255,0.6)" /> Find Containers
            </button>
            <button style={s.newBookingBtn} onClick={() => navigate("/dashboard/trader/search")}>
              New Booking
            </button>
          </div>
        </div>

        {/* Page content */}
        <div style={s.content}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default TraderLayout;
