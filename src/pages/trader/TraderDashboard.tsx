// src/pages/trader/TraderDashboard.tsx
import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import {
  Chart,
  LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Filler, Tooltip,
} from "chart.js"
import { AICargoOptimizerSection } from "@/components/trader/AICargoOptimizerSection"
Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip)


// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking { id:string; status:string; origin:string; destination:string; weight_kg:number; cbm:number; total_price:number; created_at:string }
interface Container { id:string; origin:string; destination:string; departure_date:string; available_cbm:number; max_cbm:number; price_per_cbm:number; container_type:string; refrigerated:boolean; status:string }
interface PortWeather { name:string; role:string; icon:string; temp:number; desc:string; wind:number; humidity?:number }
interface DayForecast { day:string; icon:string; high:number; low:number; wind:number; alert:boolean }
interface RouteWeather { origin:string; destination:string; label:string; ports:PortWeather[]; days:DayForecast[]; alert:string }
interface PriceForecast { min:number; max:number; recommended:number; confidence:string; trend:string; reasoning:string }
interface CargoItem { id:string; name:string; type:string; weightKg:number; cbm:number; fragile:boolean; dangerous:boolean }

// ─── Constants ────────────────────────────────────────────────────────────────
const POPULAR_ROUTES = [
  { label:"Mumbai → Dubai",         origin:"Mumbai",    destination:"Dubai",      originFull:"Mumbai (INNSA)",     destFull:"Dubai (AEDXB)" },
  { label:"Mumbai → Singapore",     origin:"Mumbai",    destination:"Singapore",  originFull:"Mumbai (INNSA)",     destFull:"Singapore (SGSIN)" },
  { label:"Shanghai → Rotterdam",   origin:"Shanghai",  destination:"Rotterdam",  originFull:"Shanghai (CNSHA)",   destFull:"Rotterdam (NLRTM)" },
  { label:"Dubai → Rotterdam",      origin:"Dubai",     destination:"Rotterdam",  originFull:"Dubai (AEDXB)",      destFull:"Rotterdam (NLRTM)" },
  { label:"Chennai → Dubai",        origin:"Chennai",   destination:"Dubai",      originFull:"Chennai (INMAA)",    destFull:"Dubai (AEDXB)" },
  { label:"Singapore → Rotterdam",  origin:"Singapore", destination:"Rotterdam",  originFull:"Singapore (SGSIN)",  destFull:"Rotterdam (NLRTM)" },
]
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV = [
  { label:"Dashboard",         path:"/dashboard/trader",  icon:"grid" },
  { label:"Search containers", path:"/dashboard/trader/search",      icon:"search" },
  { label:"Auctions",          path:"/dashboard/trader/auctions",    icon:"auction" },
  { label:"My bookings",       path:"/dashboard/trader/bookings",    icon:"clipboard" },
  { label:"Documents",         path:"/dashboard/trader/documents",   icon:"doc" },
  { label:"Payments",          path:"/dashboard/trader/payments",    icon:"dollar" },
  { label:"Invoices",          path:"/dashboard/trader/invoices",    icon:"invoice" },
  { label:"Analytics",         path:"/dashboard/trader/analytics",   icon:"bar" },
  { label:"Messages",          path:"/dashboard/trader/messages",    icon:"message" },
  { label:"Settings",          path:"/dashboard/trader/settings",    icon:"settings" },
]

const Icon = ({ t, col="rgba(255,255,255,0.4)" }:{ t:string; col?:string }) => {
  const p:Record<string,string> = {
    grid:     "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    search:   "M11 11m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0M21 21l-4.35-4.35",
    auction:  "M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6",
    clipboard:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M8 2h8v4H8z",
    doc:      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
    dollar:   "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    invoice:  "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    bar:      "M18 20V10M12 20V4M6 20v-6",
    message:  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    settings: "M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M19.07 4.93a10 10 0 0 1 0 14.14M5.93 4.93a10 10 0 0 0 0 14.14",
    signout:  "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    bell:     "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {p[t]?.split("M").filter(Boolean).map((d,i) => <path key={i} d={"M"+d} />)}
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const stStyle = (s:string) => {
  const m:Record<string,any> = { confirmed:{bg:"rgba(16,185,129,0.15)",color:"#10b981"}, cancelled:{bg:"rgba(239,68,68,0.12)",color:"#ef4444"}, delivered:{bg:"rgba(59,130,246,0.15)",color:"#3b82f6"}, pending:{bg:"rgba(245,158,11,0.15)",color:"#f59e0b"} }
  return m[s] ?? { bg:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.4)" }
}
const fmt = (n:number) => n>=1000000?"$"+(n/1000000).toFixed(1)+"M":n>=1000?"$"+(n/1000).toFixed(1)+"K":"$"+n.toLocaleString()
const daysUntil = (d:string) => Math.max(0, Math.ceil((new Date(d).getTime()-Date.now())/86400000))
const shortId = (id:string) => id.length>26 ? id.substring(0,26)+"…" : id
const wIcon = (c:number) => c<=113?"☀️":c<=119?"⛅":c<=143?"🌫":c<=176?"🌦":c<=296?"🌧":"⛈"
const rColor = (r:string) => r==="high"||r==="critical"?"#ef4444":r==="medium"?"#f59e0b":"#10b981"

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TraderDashboard() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const chartRef   = useRef<HTMLCanvasElement>(null)
  const chartInst  = useRef<any>(null)

  // Core data
  const [bookings,    setBookings]    = useState<Booking[]>([])
  const [containers,  setContainers]  = useState<Container[]>([])
  const [loading,     setLoading]     = useState(true)

  // Route selector — drives both weather and price forecast
  const [activeRouteIdx, setActiveRouteIdx] = useState(0)
  const activeRoute = POPULAR_ROUTES[activeRouteIdx]

  // Weather cache per route
  const [weatherCache, setWeatherCache] = useState<Record<number, RouteWeather>>({})
  const [weatherLoading, setWeatherLoading] = useState(false)

  // Price forecast cache per route
  const [forecastCache, setForecastCache]   = useState<Record<number, PriceForecast>>({})
  const [forecastLoading, setForecastLoading] = useState(false)

  // Delay risks (only real bookings)
  const [delays, setDelays] = useState<{route:string;risk:string;probability:number}[]>([])

  // Derived
  const activeB    = bookings.filter(b => b.status==="confirmed").length
  const pendingB   = bookings.filter(b => b.status==="pending").length
  const completedB = bookings.filter(b => b.status==="delivered").length
  const totalSpent = bookings.filter(b => b.status!=="cancelled").reduce((s,b) => s+(b.total_price??0), 0)
  const today = new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [br, cr] = await Promise.all([
        supabase.from("bookings").select("id,status,origin:pickup_address,destination:drop_address,weight_kg:cargo_weight_kg,cbm:booked_volume_m3,total_price:price_usd,created_at").eq("trader_id", user.id).order("created_at",{ascending:false}).limit(10),
        supabase.from("containers").select("id,origin,destination,departure_date,available_cbm:available_volume_m3,max_cbm:total_volume_m3,price_per_cbm:price_per_m3,container_type,refrigerated,status").eq("status","active").gt("available_volume_m3",0).gte("departure_date",new Date().toISOString().split("T")[0]).order("departure_date",{ascending:true}).limit(6),
      ])
      if (br.data) setBookings(br.data as any)
      if (cr.data) setContainers(cr.data as any)

      const confirmed = [...new Set(((br.data as any) ?? [])?.filter((b:any)=>b.status==="confirmed").map((b:any)=>`${b.origin}||${b.destination}`) ?? [])]
      if (confirmed.length > 0) {
        const rs = await Promise.all(confirmed.slice(0,3).map(async (r:any) => {
          const [o,d] = r.split("||")
          try {
            const { data:w } = await supabase.functions.invoke("delay-prediction",{body:{origin:o,destination:d,departureDate:new Date().toISOString().split("T")[0],cargoType:"general"}})
            if (w) return { route:`${o.split("(")[0].trim().split(",")[0]} → ${d.split("(")[0].trim().split(",")[0]}`, risk:w.risk??"medium", probability:w.delayProbabilityPercent??20 }
          } catch {}
          return null
        }))
        setDelays(rs.filter(Boolean) as any)
      }
    } catch(e) { console.error("load error:", e) }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { loadData() }, [loadData])

  const fetchWeather = useCallback(async (idx: number) => {
    if (weatherCache[idx]) return
    setWeatherLoading(true)
    const r = POPULAR_ROUTES[idx]
    try {
      const [dr, or] = await Promise.all([
        fetch(`https://wttr.in/${encodeURIComponent(r.destination)}?format=j1`),
        fetch(`https://wttr.in/${encodeURIComponent(r.origin)}?format=j1`),
      ])
      const ports: PortWeather[] = []
      if (or.ok) {
        const d = await or.json(); const c = d.current_condition?.[0]
        if (c) ports.push({ name:r.origin, role:"Origin", icon:wIcon(parseInt(c.weatherCode)), temp:parseInt(c.temp_C), desc:c.weatherDesc?.[0]?.value??"Clear", wind:parseInt(c.windspeedKmph), humidity:parseInt(c.humidity) })
      }
      ports.push({ name:"Open sea", role:"Transit", icon:"🌊", temp:27, desc:"Ocean conditions", wind:22 })
      let days: DayForecast[] = []
      let alert = ""
      if (dr.ok) {
        const d = await dr.json(); const c = d.current_condition?.[0]
        if (c) ports.push({ name:r.destination, role:"Destination", icon:wIcon(parseInt(c.weatherCode)), temp:parseInt(c.temp_C), desc:c.weatherDesc?.[0]?.value??"Clear", wind:parseInt(c.windspeedKmph), humidity:parseInt(c.humidity) })
        days = (d.weather??[]).slice(0,7).map((w:any,i:number) => {
          const mw = Math.max(...(w.hourly??[]).map((h:any) => parseInt(h.windspeedKmph)||0))
          const code = parseInt(w.hourly?.[4]?.weatherCode??"113")
          const date = new Date(w.date)
          return { day:i===0?"Today":DAYS[date.getDay()], icon:wIcon(code), high:parseInt(w.maxtempC), low:parseInt(w.mintempC), wind:mw, alert:mw>35||code>=296 }
        })
        const alertDay = days.find(dd => dd.alert)
        if (alertDay) alert = `⚠ Adverse conditions expected ${alertDay.day} at ${r.destination}. Possible port delays.`
      }
      setWeatherCache(prev => ({ ...prev, [idx]: { origin:r.originFull, destination:r.destFull, label:r.label, ports, days, alert } }))
    } catch(e) { console.error("weather error:", e) }
    finally { setWeatherLoading(false) }
  }, [weatherCache])

  const fetchForecast = useCallback(async (idx: number) => {
    if (forecastCache[idx]) return
    setForecastLoading(true)
    const r = POPULAR_ROUTES[idx]
    try {
      const { data } = await supabase.functions.invoke("predict-price-ai", {
        body: { origin:r.originFull, destination:r.destFull, cargoType:"general", weightKg:500, cbm:2, departureDate:new Date(Date.now()+7*86400000).toISOString().split("T")[0] }
      })
      if (data) setForecastCache(prev => ({ ...prev, [idx]: data }))
    } catch(e) { console.error("forecast error:", e) }
    finally { setForecastLoading(false) }
  }, [forecastCache])

  useEffect(() => {
    fetchWeather(activeRouteIdx)
    fetchForecast(activeRouteIdx)
  }, [activeRouteIdx])

  const currentForecast = forecastCache[activeRouteIdx]
  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null }
    const base = currentForecast?.recommended ?? 1600
    const labels = Array.from({length:30},(_,i) => `D${i+1}`)
    const data = labels.map((_,i) => Math.round(base - i*0.6 + Math.sin(i*0.5)*22 + (Math.random()-0.5)*18))
    chartInst.current = new Chart(chartRef.current, {
      type:"line",
      data:{ labels, datasets:[
        { data:data.map(v=>v+90), borderColor:"transparent", backgroundColor:"rgba(168,85,247,0.07)", fill:"+1", pointRadius:0, tension:0.4 },
        { data, borderColor:"#a855f7", backgroundColor:"rgba(168,85,247,0.18)", fill:"-1", borderWidth:2.5, pointRadius:0, tension:0.4 },
        { data:data.map(v=>v-90), borderColor:"transparent", fill:false, pointRadius:0, tension:0.4 },
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ backgroundColor:"rgba(10,10,20,.96)", borderColor:"rgba(168,85,247,.4)", borderWidth:1, padding:10, callbacks:{ label:(ctx:any) => fmt(ctx.raw)+"/CBM" } } }, scales:{ x:{display:false}, y:{display:false} } },
    })
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null } }
  }, [currentForecast, activeRouteIdx])

  const currentWeather = weatherCache[activeRouteIdx]

  return (
    <div style={s.shell}>
      <div style={s.sidebar}>
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <div>
            <div style={s.logoText}>CargoHub</div>
            <div style={s.logoSub}>Trader</div>
          </div>
        </div>
        <div style={s.navSection}>TRADER PANEL</div>
        <nav style={s.nav}>
          {NAV.map(item => {
            const active = location.pathname === item.path
            return (
              <div key={item.path} style={{...s.navItem,...(active?s.navActive:{})}} onClick={() => navigate(item.path)}>
                <Icon t={item.icon} col={active?"#a855f7":"rgba(255,255,255,0.4)"} />
                <span style={{...s.navLabel, color:active?"#a855f7":"rgba(255,255,255,0.55)"}}>{item.label}</span>
                {item.label==="My bookings" && pendingB>0 && <span style={s.navBadge}>{pendingB}</span>}
              </div>
            )
          })}
        </nav>
        <div style={s.sidebarFooter}>
          <div style={s.userRow}>
            <div style={s.avatar}>{(user?.email??"T").substring(0,2).toUpperCase()}</div>
            <div style={s.userInfo}>
              <div style={s.userName}>{user?.email?.split("@")[0]??"Trader"}</div>
              <div style={s.userEmail}>{(user?.email??"").length>16?(user?.email??"").substring(0,16)+"…":user?.email}</div>
            </div>
            <button style={s.signOutBtn} onClick={async () => { await supabase.auth.signOut(); navigate("/") }} title="Sign out">
              <Icon t="signout" col="rgba(255,255,255,0.3)" />
            </button>
          </div>
        </div>
      </div>
      <div style={s.main}>
        <div style={s.topbar}>
          <div>
            <div style={s.pt}>Trader Dashboard</div>
            <div style={s.ps}>{today} · {activeRoute.label}</div>
          </div>
          <div style={s.tr}>
            <div style={s.notifBtn}>
              <Icon t="bell" col="rgba(255,255,255,0.5)" />
              {(activeB+pendingB)>0 && <div style={s.notifDot}/>}
            </div>
            <button style={s.searchBtn} onClick={() => navigate("/dashboard/trader/search")}>
              <Icon t="search" col="white" />
              Search containers
            </button>
          </div>
        </div>
        <div style={s.content}>
          <div style={s.routeSelector}>
            <div style={s.routeSelectorLabel}>Active route</div>
            <div style={s.routeTabs}>
              {POPULAR_ROUTES.map((r,i) => (
                <button
                  key={i}
                  style={{ ...s.routeTab, ...(i===activeRouteIdx ? s.routeTabActive : {}) }}
                  onClick={() => setActiveRouteIdx(i)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div style={s.stats4}>
            {[
              { l:"Active bookings", v:String(activeB),    s:`${pendingB} pending`,       c:"#a855f7", bg:"rgba(168,85,247,0.12)" },
              { l:"Pending",         v:String(pendingB),   s:pendingB>0?"Needs action":"All cleared", c:"#f59e0b", bg:"rgba(245,158,11,0.12)" },
              { l:"Completed",       v:String(completedB), s:"Lifetime deliveries",       c:"#10b981", bg:"rgba(16,185,129,0.12)" },
              { l:"Total spent",     v:fmt(totalSpent),    s:"All bookings",              c:"#3b82f6", bg:"rgba(59,130,246,0.12)" },
            ].map(st => (
              <div key={st.l} style={s.statCard}>
                <div style={{...s.statDot, background:st.bg, border:`1px solid ${st.c}44`}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:st.c}}/>
                </div>
                <div>
                  <div style={s.statLabel}>{st.l}</div>
                  {loading?<div style={s.sk}/>:<div style={s.statVal}>{st.v}</div>}
                  <div style={{fontSize:11,color:st.c,marginTop:2}}>{st.s}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={s.grid2}>
            <div style={s.aiCard}>
              <div style={s.aiBadge}>AI PREDICTION</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div>
                  <div style={s.aiT}>AI freight price forecast</div>
                  <div style={s.aiS}>{activeRoute.label} · 30-day projection</div>
                </div>
                {currentForecast && <div style={{fontSize:15,fontWeight:700,color:currentForecast.trend==="falling"?"#10b981":"#ef4444"}}>{currentForecast.trend==="falling"?"↓ Falling":"↑ Rising"}</div>}
              </div>
              <div style={{position:"relative",width:"100%",height:150,marginBottom:12}}>
                <canvas ref={chartRef}/>
              </div>
              <div style={s.priceRow}>
                {[
                  {l:"Current",    v:currentForecast?fmt(currentForecast.recommended)+"<s>/CBM</s>":"—", c:"#fff"},
                  {l:"30-day low", v:currentForecast?fmt(currentForecast.min):"—",                       c:"#10b981"},
                  {l:"30-day high",v:currentForecast?fmt(currentForecast.max):"—",                       c:"#ef4444"},
                  {l:"Confidence", v:currentForecast?.confidence??"—",                                   c:"#a855f7"},
                ].map((p,i) => (
                  <div key={p.l} style={{...s.priceBox,borderLeft:i>0?"1px solid rgba(255,255,255,0.06)":"none"}}>
                    <div style={s.priceLbl}>{p.l}</div>
                    <div style={{fontSize:13,fontWeight:700,color:p.c}}>{p.v}</div>
                  </div>
                ))}
              </div>
              <div style={s.insightBox}>
                <div style={s.insightI}>i</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",lineHeight:1.6}}>{currentForecast?.reasoning??"Analyzing market trends..."}</div>
              </div>
            </div>
            <div style={s.aiCard}>
              <div style={{...s.aiBadge, background:"rgba(59,130,246,0.2)", color:"#60a5fa"}}>LIVE WEATHER</div>
              <div style={s.aiT}>Route weather forecast</div>
              <div style={s.aiS}>{activeRoute.label} · 7-day strip</div>
              <div style={s.portRow}>
                {(currentWeather?.ports ?? []).map(pw => (
                  <div key={pw.name} style={s.portCard}>
                    <div style={s.portRole}>{pw.role}</div>
                    <div style={s.portName}>{pw.name}</div>
                    <div style={{fontSize:24,margin:"4px 0"}}>{pw.icon}</div>
                    <div style={s.portTemp}>{pw.temp}°C</div>
                  </div>
                ))}
              </div>
              <div style={s.dayStrip}>
                {(currentWeather?.days ?? []).map((d,i) => (
                  <div key={i} style={{...s.dayCard, borderColor:d.alert?"rgba(239,68,68,0.35)":"rgba(255,255,255,0.06)"}}>
                    <div style={s.dayName}>{d.day}</div>
                    <div style={{fontSize:14,margin:"3px 0"}}>{d.icon}</div>
                    <div style={s.dayHigh}>{d.high}°</div>
                  </div>
                ))}
              </div>
              <div style={{...s.insightBox, background:"rgba(59,130,246,0.07)", borderColor:"rgba(59,130,246,0.2)"}}>
                <div style={{...s.insightI, background:"rgba(59,130,246,0.25)", color:"#60a5fa"}}>i</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.6}}>{currentWeather?.alert||"No significant weather disruptions expected."}</div>
              </div>
            </div>
          </div>
          <AICargoOptimizerSection />
        </div>
      </div>
    </div>
  )
}

function Sk({n}:{n:number}){return<div style={{display:"flex",flexDirection:"column",gap:8}}>{Array.from({length:n}).map((_,i)=><div key={i} style={{height:34,background:"rgba(255,255,255,0.04)",borderRadius:7}}/>)}</div>}

const s:Record<string,React.CSSProperties>={
  shell:          {display:"flex",minHeight:"100vh",background:"#0a0a0f",color:"#fff",fontFamily:"system-ui,sans-serif"},
  sidebar:        {width:212,minWidth:212,background:"#0f0f18",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column"},
  logoWrap:       {display:"flex",alignItems:"center",gap:10,padding:"18px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  logoIcon:       {width:28,height:28,background:"rgba(168,85,247,0.15)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"},
  logoText:       {fontSize:13,fontWeight:700,color:"#a855f7"},
  logoSub:        {fontSize:10,color:"rgba(255,255,255,0.3)"},
  navSection:     {fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.18)",padding:"14px 16px 6px"},
  nav:            {flex:1,padding:"4px 8px",display:"flex",flexDirection:"column",gap:1},
  navItem:        {display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,cursor:"pointer"},
  navActive:      {background:"rgba(168,85,247,0.12)",borderLeft:"2px solid #a855f7"},
  navLabel:       {fontSize:12},
  navBadge:       {marginLeft:"auto",fontSize:9,background:"#a855f7",color:"#fff",borderRadius:9,padding:"1px 5px"},
  sidebarFooter:  {padding:"10px 8px",borderTop:"1px solid rgba(255,255,255,0.06)"},
  userRow:        {display:"flex",alignItems:"center",gap:8,padding:8,borderRadius:8,background:"rgba(255,255,255,0.03)"},
  avatar:         {width:28,height:28,borderRadius:"50%",background:"rgba(168,85,247,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10},
  userInfo:       {flex:1,minWidth:0},
  userName:       {fontSize:11,fontWeight:500},
  userEmail:      {fontSize:9,color:"rgba(255,255,255,0.25)"},
  signOutBtn:     {background:"none",border:"none",cursor:"pointer"},
  main:           {flex:1,overflow:"auto",display:"flex",flexDirection:"column"},
  topbar:         {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  pt:             {fontSize:17,fontWeight:700},
  ps:             {fontSize:11,color:"rgba(255,255,255,0.25)"},
  tr:             {display:"flex",alignItems:"center",gap:10},
  notifBtn:       {position:"relative",width:34,height:34,borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center"},
  notifDot:       {position:"absolute",top:7,right:7,width:7,height:7,background:"#a855f7",borderRadius:"50%"},
  searchBtn:      {display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#7c3aed",borderRadius:8,color:"#fff",fontSize:12,border:"none"},
  content:        {padding:"18px 22px",display:"flex",flexDirection:"column",gap:14},
  routeSelector:  {background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:11,padding:12,display:"flex",alignItems:"center",gap:14},
  routeSelectorLabel:{fontSize:11,color:"rgba(255,255,255,0.35)"},
  routeTabs:      {display:"flex",gap:6},
  routeTab:       {fontSize:11,padding:"5px 12px",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",background:"none",color:"rgba(255,255,255,0.45)",cursor:"pointer"},
  routeTabActive: {borderColor:"rgba(168,85,247,0.5)",background:"rgba(168,85,247,0.15)",color:"#c084fc"},
  stats4:         {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10},
  statCard:       {background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:14},
  statDot:        {width:36,height:36,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center"},
  statLabel:      {fontSize:11,color:"rgba(255,255,255,0.35)"},
  statVal:        {fontSize:22,fontWeight:700},
  grid2:          {display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  aiCard:         {background:"#13131e",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:18,position:"relative"},
  aiBadge:        {position:"absolute",top:14,right:16,fontSize:9,fontWeight:700,color:"#a855f7",background:"rgba(168,85,247,0.15)",borderRadius:4,padding:"2px 7px"},
  aiT:            {fontSize:14,fontWeight:600},
  aiS:            {fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:14},
  priceRow:       {display:"flex",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:12},
  priceBox:       {flex:1,padding:10},
  priceLbl:       {fontSize:10,color:"rgba(255,255,255,0.3)"},
  insightBox:     {display:"flex",gap:8,background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:8,padding:10},
  insightI:       {width:16,height:16,borderRadius:"50%",background:"rgba(168,85,247,0.25)",color:"#a855f7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9},
  portRow:        {display:"flex",gap:8,marginBottom:12},
  portCard:       {background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:10,flex:1,textAlign:"center"},
  portRole:       {fontSize:9,color:"rgba(255,255,255,0.3)"},
  portName:       {fontSize:11,fontWeight:500},
  portTemp:       {fontSize:18,fontWeight:700},
  dayStrip:       {display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:12},
  dayCard:        {border:"1px solid",borderRadius:7,padding:6,textAlign:"center"},
  dayName:        {fontSize:9,color:"rgba(255,255,255,0.35)"},
  dayHigh:        {fontSize:11,fontWeight:600},
  optimizerCard:  {background:"#13131e",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:20},
  optimizerHeader:{display:"flex",alignItems:"center",gap:12,marginBottom:18},
  optimizerIcon:  {width:36,height:36,borderRadius:9,background:"rgba(168,85,247,0.15)",display:"flex",alignItems:"center",justifyContent:"center"},
  optimizerTitle: {fontSize:14,fontWeight:600},
  optimizerSub:   {fontSize:11,color:"rgba(255,255,255,0.35)"},
  aiBadgeInline:  {fontSize:10,color:"#a855f7",background:"rgba(168,85,247,0.12)",borderRadius:6,padding:"4px 10px"},
  cargoRow:       {display:"flex",gap:7},
  cargoIn:        {flex:2,height:30,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"0 9px",color:"#fff",fontSize:12},
  cargoSm:        {flex:1,height:30,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"0 7px",color:"#fff",fontSize:12},
  rmBtn:          {background:"none",border:"none",color:"#ef4444",cursor:"pointer"},
  addItemBtn:     {fontSize:12,color:"#a855f7",background:"none",border:"1px dashed rgba(168,85,247,0.3)",borderRadius:7,padding:"6px 14px",width:"100%",marginBottom:10},
  runBtn:         {width:"100%",height:40,background:"#7c3aed",borderRadius:8,color:"#fff",fontSize:14,fontWeight:600,border:"none"},
}