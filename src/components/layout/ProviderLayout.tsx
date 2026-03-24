import { ReactNode, useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV = [
  { label: "Dashboard",     path: "/dashboard/provider",            icon: "grid" },
  { label: "My containers", path: "/dashboard/provider/containers", icon: "box" },
  { label: "My bookings",   path: "/dashboard/provider/bookings",   icon: "clipboard" },
  { label: "Payments",      path: "/dashboard/provider/payments",   icon: "dollar" },
  { label: "Revenue",       path: "/dashboard/provider/revenue",    icon: "bar" },
  { label: "Analytics",     path: "/dashboard/provider/analytics",  icon: "activity" },
  { label: "Messages",      path: "/dashboard/provider/messages",   icon: "message" },
  { label: "Settings",      path: "/dashboard/provider/settings",   icon: "settings" },
]

// ─── Icon set (matches ProviderDashboard) ─────────────────────────────────────
const NavIcon = ({ type, col = "rgba(255,255,255,0.4)" }: { type: string; col?: string }) => {
  const d: Record<string, string> = {
    grid:      "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    box:       "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
    clipboard: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M8 2h8v4H8z",
    dollar:    "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    bar:       "M18 20V10M12 20V4M6 20v-6",
    activity:  "M22 12h-4l-3 9L9 3l-3 9H2",
    message:   "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    settings:  "M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M19.07 4.93a10 10 0 0 1 0 14.14M5.93 4.93a10 10 0 0 0 0 14.14",
    signout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d[type] ?? ""} />
    </svg>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────
interface ProviderLayoutProps {
  children: ReactNode
  /** Page title shown in the topbar */
  title?: string
}

const ProviderLayout = ({ children, title }: ProviderLayoutProps) => {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAuth()
  const [pendingBookings, setPendingBookings] = useState(0)

  // Fetch pending booking count for badge
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", user.id)
      .eq("status", "pending")
      .then(({ count }) => setPendingBookings(count ?? 0))
  }, [user?.id])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate("/")
  }

  // Active path: exact match for dashboard, prefix match for sub-pages
  const isActive = (path: string) =>
    path === "/dashboard/provider"
      ? location.pathname === path
      : location.pathname.startsWith(path)

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
            <div style={s.logoSub}>Provider</div>
          </div>
        </div>

        {/* Nav section label */}
        <div style={s.navSection}>PROVIDER PANEL</div>

        {/* Nav items */}
        <nav style={s.nav}>
          {NAV.map(item => {
            const active = isActive(item.path)
            return (
              <div
                key={item.path}
                style={{ ...s.navItem, ...(active ? s.navActive : {}) }}
                onClick={() => navigate(item.path)}
              >
                <NavIcon type={item.icon} col={active ? "#a855f7" : "rgba(255,255,255,0.4)"} />
                <span style={{ ...s.navLabel, color: active ? "#a855f7" : "rgba(255,255,255,0.55)" }}>
                  {item.label}
                </span>
                {item.label === "My bookings" && pendingBookings > 0 && (
                  <span style={s.navBadge}>{pendingBookings}</span>
                )}
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div style={s.sidebarFooter}>
          <div style={s.userRow}>
            <div style={s.avatar}>
              {(user?.email ?? "P").substring(0, 2).toUpperCase()}
            </div>
            <div style={s.userInfo}>
              <div style={s.userName}>{user?.email?.split("@")[0] ?? "Provider"}</div>
              <div style={s.userEmail}>
                {(user?.email ?? "").substring(0, 22)}{(user?.email ?? "").length > 22 ? "…" : ""}
              </div>
            </div>
            <button style={s.signOutBtn} onClick={handleSignOut} title="Sign out">
              <NavIcon type="signout" col="rgba(255,255,255,0.3)" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={s.main}>
        {/* Topbar */}
        <div style={s.topbar}>
          <div>
            <div style={s.topTitle}>{title ?? pageTitle(location.pathname)}</div>
            <div style={s.topSub}>
              {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={s.notifBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {pendingBookings > 0 && <div style={s.notifDot} />}
            </div>
            <button style={s.addBtn} onClick={() => navigate("/dashboard/provider/containers")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add container
            </button>
          </div>
        </div>

        {/* Page content */}
        <div style={s.content}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Page title helper ────────────────────────────────────────────────────────
function pageTitle(path: string) {
  if (path.includes("/containers"))  return "My Containers"
  if (path.includes("/bookings"))    return "My Bookings"
  if (path.includes("/payments"))    return "Payments"
  if (path.includes("/revenue"))     return "Revenue"
  if (path.includes("/analytics"))   return "Analytics"
  if (path.includes("/messages"))    return "Messages"
  if (path.includes("/settings"))    return "Settings"
  return "Provider Dashboard"
}

// ─── Styles (identical to ProviderDashboard) ─────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  shell:         { display: "flex", minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "system-ui,sans-serif" },
  sidebar:       { width: 210, minWidth: 210, background: "#0f0f18", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 },
  logoWrap:      { display: "flex", alignItems: "center", gap: 10, padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  logoIcon:      { width: 28, height: 28, background: "rgba(168,85,247,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  logoText:      { fontSize: 13, fontWeight: 700, color: "#a855f7", lineHeight: 1.1 },
  logoSub:       { fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 },
  navSection:    { fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.18)", letterSpacing: ".12em", padding: "14px 16px 6px" },
  nav:           { flex: 1, padding: "4px 8px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" },
  navItem:       { display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, cursor: "pointer", transition: "all 0.12s" },
  navActive:     { background: "rgba(168,85,247,0.12)", borderLeft: "2px solid #a855f7", paddingLeft: 8 },
  navLabel:      { fontSize: 12 },
  navBadge:      { marginLeft: "auto", fontSize: 9, background: "#a855f7", color: "#fff", borderRadius: 9, padding: "1px 5px", fontWeight: 700 },
  sidebarFooter: { padding: "10px 8px", borderTop: "1px solid rgba(255,255,255,0.06)" },
  userRow:       { display: "flex", alignItems: "center", gap: 8, padding: "8px", borderRadius: 8, background: "rgba(255,255,255,0.03)" },
  avatar:        { width: 28, height: 28, borderRadius: "50%", background: "rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#a855f7", flexShrink: 0 },
  userInfo:      { flex: 1, minWidth: 0 },
  userName:      { fontSize: 11, color: "#fff", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userEmail:     { fontSize: 9, color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  signOutBtn:    { background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex", alignItems: "center", flexShrink: 0 },
  main:          { flex: 1, minWidth: 0, overflow: "auto", display: "flex", flexDirection: "column" },
  topbar:        { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0a0a0f", position: "sticky", top: 0, zIndex: 10 },
  topTitle:      { fontSize: 17, fontWeight: 700, color: "#fff" },
  topSub:        { fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 },
  notifBtn:      { position: "relative", width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  notifDot:      { position: "absolute", top: 7, right: 7, width: 7, height: 7, background: "#a855f7", borderRadius: "50%", border: "2px solid #0a0a0f" },
  addBtn:        { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#7c3aed", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  content:       { padding: "20px 22px", flex: 1, overflowY: "auto" },
}

export default ProviderLayout
