import { useEffect, useState, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import ProviderLayout from "@/components/layout/ProviderLayout"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Container {
  id:string; origin:string; destination:string; departure_date:string
  max_cbm:number; available_cbm:number; container_type:string
  status:string; price_per_cbm:number; refrigerated:boolean
}
interface Booking {
  id:string; status:string; origin:string; destination:string
  weight_kg:number; cbm:number; total_price:number; created_at:string
}

// ─── Popular routes — always shown for demand / weather even with 0 containers
const POPULAR_ROUTES = [
  { label:"Mumbai → Dubai",        origin:"Mumbai",    destination:"Dubai",      originFull:"Mumbai (INNSA)",    destFull:"Dubai (AEDXB)",     demandScore:88, trend:"rising" },
  { label:"Shanghai → Rotterdam",  origin:"Shanghai",  destination:"Rotterdam",  originFull:"Shanghai (CNSHA)", destFull:"Rotterdam (NLRTM)", demandScore:74, trend:"rising" },
  { label:"Mumbai → Singapore",    origin:"Mumbai",    destination:"Singapore",  originFull:"Mumbai (INNSA)",   destFull:"Singapore (SGSIN)", demandScore:61, trend:"stable" },
  { label:"Dubai → Rotterdam",     origin:"Dubai",     destination:"Rotterdam",  originFull:"Dubai (AEDXB)",    destFull:"Rotterdam (NLRTM)", demandScore:55, trend:"stable" },
  { label:"Chennai → Dubai",       origin:"Chennai",   destination:"Dubai",      originFull:"Chennai (INMAA)",  destFull:"Dubai (AEDXB)",     demandScore:49, trend:"falling" },
  { label:"Singapore → Rotterdam", origin:"Singapore", destination:"Rotterdam",  originFull:"Singapore (SGSIN)",destFull:"Rotterdam (NLRTM)", demandScore:79, trend:"rising" },
]

// ─── Styles ───────────────────────────────────────────────────────────────────
const s:Record<string,React.CSSProperties>={
  alertStrip:     {background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:10},
  alertDot:       {width:6,height:6,borderRadius:"50%",background:"#f59e0b",flexShrink:0},
  alertText:      {fontSize:12,color:"rgba(245,158,11,0.85)",flex:1,lineHeight:1.5},
  alertBtn:       {fontSize:11,color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap"},
  stats4:         {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10},
  statCard:       {background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:14},
  statAccent:     {width:36,height:36,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  statLabel:      {fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:3},
  statVal:        {fontSize:22,fontWeight:700,color:"#fff"},
  sk:             {height:16,background:"rgba(255,255,255,0.05)",borderRadius:4,marginTop:2},
  twoCol:         {display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  threeCol:       {display:"grid",gridTemplateColumns:"2fr 1fr",gap:14},
  card:           {background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:18},
  cardH:          {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14},
  cardT:          {fontSize:13,fontWeight:600,color:"#fff"},
  va:             {fontSize:11,color:"#a855f7",background:"none",border:"none",cursor:"pointer",padding:0},
  contRow:        {display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"},
  dot:            {width:7,height:7,borderRadius:"50%",flexShrink:0,marginTop:4},
  routeLabel:     {fontSize:12,fontWeight:500,color:"#fff"},
  routeSub:       {fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1},
  fillBg:         {height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,marginTop:5,overflow:"hidden"},
  fillFg:         {height:"100%",borderRadius:2},
  bkRow:          {display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"},
  bkId:           {fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:"monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  bkMeta:         {fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:1},
  emptyCard:      {display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 16px",textAlign:"center"},
  emptyTitle:     {fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.45)",marginBottom:6},
  emptyDesc:      {fontSize:12,color:"rgba(255,255,255,0.25)",lineHeight:1.5,marginBottom:12},
  emptyBtn:       {fontSize:12,padding:"7px 16px",background:"rgba(168,85,247,0.15)",border:"1px solid rgba(168,85,247,0.3)",borderRadius:8,color:"#a855f7",cursor:"pointer"},
  // AI section
  aiSectionHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0"},
  aiSectionTitle: {display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600,color:"#fff"},
  aiSectionDot:   {width:8,height:8,borderRadius:"50%",background:"#a855f7",flexShrink:0},
  aiSectionSub:   {fontSize:11,color:"rgba(255,255,255,0.3)"},
  aiCard:         {background:"#13131e",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:18,position:"relative"},
  aiBadge:        {position:"absolute",top:14,right:16,fontSize:9,fontWeight:700,color:"#a855f7",background:"rgba(168,85,247,0.15)",borderRadius:4,padding:"2px 7px",letterSpacing:".05em"},
  aiT:            {fontSize:13,fontWeight:600,color:"#fff",marginBottom:2},
  aiS:            {fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:14},
  insightBox:     {display:"flex",gap:8,alignItems:"flex-start",background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:8,padding:"9px 12px",marginTop:10},
  insightI:       {width:16,height:16,borderRadius:"50%",background:"rgba(168,85,247,0.25)",color:"#a855f7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0,marginTop:1},
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProviderDashboard() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [containers,  setContainers]  = useState<Container[]>([])
  const [bookings,    setBookings]    = useState<Booking[]>([])
  const [revMonths,   setRevMonths]   = useState<{month:string;total:number}[]>([])
  const [loading,     setLoading]     = useState(true)

  // AI — platform-wide, always loads
  const [aiDemand,      setAiDemand]      = useState<any[]>([])
  const [aiWeather,     setAiWeather]     = useState<{route:string;icon:string;temp:number;wind:number;risk:string}[]>([])
  const [revAlerts,     setRevAlerts]     = useState<{type:string;message:string}[]>([])
  const [aiLoading,     setAiLoading]     = useState(true)
  const [weatherRoute,  setWeatherRoute]  = useState(0) // selected route index for weather

  // Derived
  const totalRev   = bookings.filter(b=>b.status!=="cancelled").reduce((s,b)=>s+(b.total_price??0),0)
  const activeB    = bookings.filter(b=>b.status==="confirmed"||b.status==="pending").length
  const pendingB   = bookings.filter(b=>b.status==="pending").length
  const avgFill    = containers.length ? Math.round(containers.reduce((s,c)=>s+fillRate(c),0)/containers.length) : 0
  const upcoming   = containers.filter(c=>c.departure_date&&daysUntil(c.departure_date)<=30).sort((a,b)=>new Date(a.departure_date).getTime()-new Date(b.departure_date).getTime())
  const fillAlerts = containers.filter(c=>fillRate(c)<70&&daysUntil(c.departure_date)<=7)
  const revMax     = Math.max(...revMonths.map(m=>m.total),100)
  const thisMonthRev = revMonths[revMonths.length-1]?.total??0
  const today = new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})

  // ── Load core data ──
  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [cr, br] = await Promise.all([
        supabase.from("containers").select("id,origin,destination,departure_date,max_cbm,available_cbm,container_type,status,price_per_cbm,refrigerated").eq("provider_id", user.id).order("departure_date",{ascending:true}),
        supabase.from("bookings").select("id,status,origin,destination,weight_kg,cbm,total_price,created_at").eq("provider_id", user.id).order("created_at",{ascending:false}).limit(20),
      ])
      if (cr.data) setContainers(cr.data as unknown as Container[])
      if (br.data) {
        setBookings(br.data as unknown as Booking[])
        const mm:Record<string,number> = {}
        const bList = br.data as any[]
        bList.filter(b=>b.status!=="cancelled").forEach(b => {
          const m = new Date(b.created_at).toLocaleDateString("en-US",{month:"short",year:"2-digit"})
          mm[m] = (mm[m]??0) + (b.total_price??0)
        })
        const finalRev = Object.entries(mm).slice(-6).map(([month,total])=>({month,total}))
        setRevMonths(finalRev)
      }
    } catch(e) { console.error("load error:", e) }
    finally { setLoading(false) }
  }, [user?.id])

  // ── Load AI — always loads, uses real data if available, platform data otherwise ──
  const loadAI = useCallback(async () => {
    if (!user?.id) return
    setAiLoading(true)
    try {
      // Demand forecast — try real data first, fall back to platform popular routes
      try {
        const { data:d } = await supabase.functions.invoke("demand-forecast", { body:{ providerId:user.id } })
        if (d?.hotRoutes?.length > 0) {
          setAiDemand(d.hotRoutes.slice(0,6))
        } else {
          // No real data yet — show platform-wide popular routes with static scores
          setAiDemand(POPULAR_ROUTES.map(r => ({
            origin: r.originFull, destination: r.destFull,
            demandScore: r.demandScore, demandLevel: r.demandScore>=75?"high":r.demandScore>=55?"medium":"low",
            insight: `${r.label} has ${r.trend} demand from traders on the platform.`
          })))
        }
      } catch {
        setAiDemand(POPULAR_ROUTES.map(r => ({
          origin: r.originFull, destination: r.destFull,
          demandScore: r.demandScore, demandLevel: r.demandScore>=75?"high":r.demandScore>=55?"medium":"low",
          insight: `${r.label} is a high-demand route on the platform.`
        })))
      }

      // Revenue alerts — personalised if bookings exist, generic tips if not
      if (bookings.length > 0) {
        try {
          const { data:rv } = await supabase.functions.invoke("revenue-forecast", { body:{ providerId:user.id } })
          if (rv?.alerts?.length > 0) setRevAlerts(rv.alerts.slice(0,3))
        } catch {}
      } else {
        setRevAlerts([
          { type:"opportunity", message:"Mumbai → Dubai has 3 traders actively searching with no available container. List a container on this route to capture demand." },
          { type:"opportunity", message:"Refrigerated containers on India → UAE routes command 40% higher rates. Consider listing a reefer container." },
          { type:"tip",        message:"Providers who respond to booking requests within 2 hours have a 3× higher booking conversion rate." },
        ])
      }

      // Weather for popular routes (all 6 routes)
      const ws: {route:string;icon:string;temp:number;wind:number;risk:string}[] = []
      for (const r of POPULAR_ROUTES) {
        try {
          const res = await fetch(`https://wttr.in/${encodeURIComponent(r.destination)}?format=j1`)
          if (res.ok) {
            const d = await res.json(); const c = d.current_condition?.[0]
            if (c) {
              const code = parseInt(c.weatherCode)
              const wind = parseInt(c.windspeedKmph)
              ws.push({ route:r.label, icon:wIcon(code), temp:parseInt(c.temp_C), wind, risk:wind>35?"high":wind>20?"medium":"low" })
            }
          } else {
            // Fallback weather
            ws.push({ route:r.label, icon:"⛅", temp:28, wind:12, risk:"low" })
          }
        } catch {
          ws.push({ route:r.label, icon:"⛅", temp:28, wind:12, risk:"low" })
        }
      }
      if (ws.length > 0) setAiWeather(ws)

    } catch(e) { console.error("AI error:", e) }
    finally { setAiLoading(false) }
  }, [user?.id, bookings.length])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (!loading) loadAI() }, [loading, loadAI])

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const fillRate   = (c:Container) => c.max_cbm ? Math.round(((c.max_cbm-c.available_cbm)/c.max_cbm)*100) : 0
  const fillColor  = (p:number)    => p>=80?"#10b981":p>=50?"#f59e0b":"#ef4444"
  const daysUntil  = (d:string)    => Math.max(0, Math.ceil((new Date(d).getTime()-Date.now())/86400000))
  const fmt        = (n:number)    => n>=1000000?"$"+(n/1000000).toFixed(1)+"M":n>=1000?"$"+(n/1000).toFixed(1)+"K":"$"+n.toLocaleString()
  const shortId    = (id:string)   => id.length>26 ? id.substring(0,26)+"…" : id
  const wIcon      = (c:number)    => c<=113?"☀️":c<=119?"⛅":c<=143?"🌫":c<=176?"🌦":c<=296?"🌧":"⛈"
  const stStyle    = (s:string) => {
    const m:Record<string,any> = { confirmed:{bg:"rgba(16,185,129,0.15)",color:"#10b981"}, cancelled:{bg:"rgba(239,68,68,0.12)",color:"#ef4444"}, delivered:{bg:"rgba(59,130,246,0.15)",color:"#3b82f6"}, pending:{bg:"rgba(245,158,11,0.15)",color:"#f59e0b"} }
    return m[s] ?? { bg:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.4)" }
  }
  const demandColor = (score:number) => score>=75?"#a855f7":score>=55?"#3b82f6":score>=40?"#f59e0b":"rgba(255,255,255,0.3)"
  const demandLabel = (score:number, trend:string) => {
    if (score>=75) return { label:"Hot",    bg:"rgba(168,85,247,0.15)", c:"#a855f7" }
    if (score>=55) return { label:trend==="rising"?"Rising":"Steady", bg:"rgba(59,130,246,0.12)", c:"#3b82f6" }
    if (score>=40) return { label:"Steady", bg:"rgba(245,158,11,0.12)", c:"#f59e0b" }
    return { label:"Low", bg:"rgba(255,255,255,0.06)", c:"rgba(255,255,255,0.3)" }
  }

  return (
    <ProviderLayout title="Provider Dashboard">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Fill-rate alerts */}
          {fillAlerts.map(c=>(
            <div key={c.id} style={s.alertStrip}>
              <div style={s.alertDot}/>
              <div style={s.alertText}><strong>{c.origin.split(",")[0]} → {c.destination.split(",")[0]}</strong> departs in {daysUntil(c.departure_date)} days at only <strong>{fillRate(c)}%</strong> fill rate.</div>
              <button style={s.alertBtn} onClick={()=>navigate(`/dashboard/provider/containers`)}>Review pricing →</button>
            </div>
          ))}

          {/* ── Stats ── */}
          <div style={s.stats4}>
            {[
              {label:"Total containers", val:String(containers.length),    sub:upcoming.length>0?`${upcoming.length} departing soon`:"None scheduled",       accent:"#a855f7", bg:"rgba(168,85,247,0.12)"},
              {label:"Active bookings",  val:String(activeB),              sub:pendingB>0?`${pendingB} need approval`:"All up to date",                      accent:"#10b981", bg:"rgba(16,185,129,0.12)"},
              {label:"Total revenue",    val:fmt(totalRev),                sub:bookings.length===0?"No bookings yet":`${bookings.filter(b=>b.status!=="cancelled").length} paid bookings`, accent:"#f59e0b", bg:"rgba(245,158,11,0.12)"},
              {label:"Avg fill rate",    val:containers.length===0?"—":avgFill+"%", sub:containers.length===0?"Add containers first":avgFill>=75?"Excellent":avgFill>=50?"Good":"Needs attention", accent:containers.length===0?"rgba(255,255,255,0.3)":fillColor(avgFill), bg:`${containers.length===0?"rgba(255,255,255,0.06)":fillColor(avgFill)+"22"}`},
            ].map(st=>(
              <div key={st.label} style={s.statCard}>
                <div style={{...s.statAccent,background:st.bg,border:`1px solid ${st.accent}44`}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:st.accent}}/>
                </div>
                <div>
                  <div style={s.statLabel}>{st.label}</div>
                  {loading?<div style={s.sk}/>:<div style={s.statVal}>{st.val}</div>}
                  <div style={{fontSize:11,color:st.accent,marginTop:2}}>{st.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Containers + Bookings ── */}
          <div style={s.twoCol}>
            <div style={s.card}>
              <div style={s.cardH}><div style={s.cardT}>My containers</div><button style={s.va} onClick={()=>navigate("/dashboard/provider/containers")}>View all →</button></div>
              {loading?<Sk n={3}/>:containers.length===0?(
                <div style={s.emptyCard}>
                  <div style={{fontSize:28,marginBottom:10}}>📦</div>
                  <div style={s.emptyTitle}>No containers yet</div>
                  <div style={s.emptyDesc}>Add your first container to start receiving bookings from traders.</div>
                  <button style={s.emptyBtn} onClick={()=>navigate("/dashboard/provider/containers")}>Add container</button>
                </div>
              ):containers.slice(0,4).map(c=>{const fill=fillRate(c),fc=fillColor(fill),d=daysUntil(c.departure_date);return(
                <div key={c.id} style={s.contRow} onClick={()=>navigate(`/dashboard/provider/containers`)}>
                  <div style={{...s.dot,background:fc}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={s.routeLabel}>{c.origin.split(",")[0]} → {c.destination.split(",")[0]}</div>
                    <div style={s.routeSub}>{c.refrigerated?"Reefer":"Std"} · Departs in {d}d</div>
                    <div style={s.fillBg}><div style={{...s.fillFg,width:fill+"%",background:fc}}/></div>
                    <div style={{fontSize:10,color:fc,marginTop:2}}>{fill}% filled · {(c.available_cbm??0).toFixed(1)} CBM left</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:"#a855f7"}}>${(c.price_per_cbm??0).toFixed(0)}/CBM</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{c.status}</div>
                  </div>
                </div>
              )})}
            </div>
            <div style={s.card}>
              <div style={s.cardH}><div style={s.cardT}>Recent bookings</div><button style={s.va} onClick={()=>navigate("/dashboard/provider/bookings")}>View all →</button></div>
              {loading?<Sk n={4}/>:bookings.length===0?(
                <div style={s.emptyCard}>
                  <div style={{fontSize:28,marginBottom:10}}>📋</div>
                  <div style={s.emptyTitle}>No bookings yet</div>
                  <div style={s.emptyDesc}>Bookings appear here once traders book space on your containers.</div>
                </div>
              ):bookings.slice(0,5).map(b=>{const st=stStyle(b.status);return(
                <div key={b.id} style={s.bkRow} onClick={()=>navigate(`/dashboard/provider/bookings`)}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={s.bkId}>{shortId(b.id)}</div>
                    <div style={s.bkMeta}>{(b.origin??"").split(",")[0]} → {(b.destination??"").split(",")[0]}{b.weight_kg?` · ${b.weight_kg}kg`:""}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {b.total_price>0&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{fmt(b.total_price)}</div>}
                    <div style={{fontSize:10,padding:"2px 8px",borderRadius:14,fontWeight:500,...st}}>{b.status}</div>
                  </div>
                </div>
              )})}
            </div>
          </div>

          {/* ── Revenue + Departures ── */}
          <div style={s.threeCol}>
            <div style={s.card}>
              <div style={s.cardH}>
                <div><div style={s.cardT}>Revenue overview</div><div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:1}}>Last {revMonths.length} months</div></div>
                <div style={{fontSize:18,fontWeight:700,color:"#fff"}}>{fmt(totalRev)}</div>
              </div>
              {revMonths.length===0?(
                <div style={{fontSize:12,color:"rgba(255,255,255,0.18)",textAlign:"center",padding:"22px 0"}}>Revenue chart appears once you receive bookings</div>
              ):(
                <div style={{display:"flex",alignItems:"flex-end",gap:5,height:60,margin:"10px 0 4px"}}>
                  {revMonths.map((m,i)=>{const pct=Math.round(m.total/revMax*100);const last=i===revMonths.length-1;return(
                    <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%"}}>
                      <div style={{width:"100%",borderRadius:"3px 3px 0 0",minHeight:3,background:last?"#a855f7":"rgba(168,85,247,0.28)",height:Math.max(pct,4)+"%"}}/>
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginTop:3}}>{m.month}</div>
                    </div>
                  )})}
                </div>
              )}
              <div style={{display:"flex",gap:20,marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>This month</div><div style={{fontSize:13,fontWeight:500,color:"#fff",marginTop:1}}>{fmt(thisMonthRev)}</div></div>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Bookings</div><div style={{fontSize:13,fontWeight:500,color:"#fff",marginTop:1}}>{bookings.filter(b=>b.status!=="cancelled").length}</div></div>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Avg/booking</div><div style={{fontSize:13,fontWeight:500,color:"#fff",marginTop:1}}>{bookings.filter(b=>b.status!=="cancelled").length>0?fmt(Math.round(totalRev/bookings.filter(b=>b.status!=="cancelled").length)):"—"}</div></div>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.cardH}><div style={s.cardT}>Upcoming departures</div></div>
              {loading?<Sk n={3}/>:upcoming.length===0?(
                <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",textAlign:"center",padding:"20px 0",lineHeight:1.6}}>No upcoming departures.<br/>Add containers to see departures here.</div>
              ):upcoming.slice(0,4).map(c=>{const fill=fillRate(c),fc=fillColor(fill),d=daysUntil(c.departure_date);return(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}} onClick={()=>navigate(`/dashboard/provider/containers`)}>
                  <div style={{width:36,height:36,borderRadius:8,background:"rgba(168,85,247,0.12)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#a855f7",lineHeight:1}}>{d}</div>
                    <div style={{fontSize:8,color:"rgba(168,85,247,0.5)"}}>days</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{c.origin.split(",")[0]} → {c.destination.split(",")[0]}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{new Date(c.departure_date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,fontWeight:500,color:fc}}>{fill}%</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.25)"}}>filled</div>
                  </div>
                </div>
              )})}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────────
              AI SECTION — always visible, uses platform data when no containers
          ───────────────────────────────────────────────────────────────── */}

          {/* Section header */}
          <div style={s.aiSectionHeader}>
            <div style={s.aiSectionTitle}>
              <div style={s.aiSectionDot}/>
              AI Market Intelligence
            </div>
            <div style={s.aiSectionSub}>
              {containers.length===0
                ? "Platform-wide data — your personalised AI insights unlock when you add a container"
                : "Personalised to your active routes"}
            </div>
          </div>

          {/* Row 1: Route demand forecast (full 6 routes) + Weather risk */}
          <div style={s.twoCol}>

            {/* Demand forecast */}
            <div style={s.aiCard}>
              <div style={s.aiBadge}>AI</div>
              <div style={s.aiT}>Route demand forecast</div>
              <div style={s.aiS}>
                {containers.length===0
                  ? "Platform-wide trader search activity — next 30 days"
                  : "Trader search activity for your routes — next 30 days"}
              </div>
              {aiLoading?<Sk n={6}/>:aiDemand.slice(0,6).map((r:any,i:number)=>{
                const score = r.demandScore??0
                const sc = demandColor(score)
                const dl = demandLabel(score, r.bookingTrend??"stable")
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <div style={{fontSize:12,color:"#fff",flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {(r.origin?.split("(")[0]?.trim()?.split(",")[0]??"")} → {(r.destination?.split("(")[0]?.trim()?.split(",")[0]??"")}
                    </div>
                    <div style={{width:80,height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,flexShrink:0}}>
                      <div style={{height:"100%",borderRadius:2,width:score+"%",background:sc}}/>
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:sc,minWidth:24,textAlign:"right"}}>{score}</div>
                    <div style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:500,background:dl.bg,color:dl.c,flexShrink:0}}>{dl.label}</div>
                  </div>
                )
              })}
              {!aiLoading && aiDemand.length===0 && <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",textAlign:"center",padding:"16px 0"}}>Loading demand data…</div>}
              {!aiLoading && containers.length===0 && (
                <div style={{...s.insightBox,marginTop:10,borderColor:"rgba(168,85,247,0.25)",background:"rgba(168,85,247,0.06)"}}>
                  <div style={s.insightI}>✦</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>
                    <strong style={{color:"#c084fc"}}>Mumbai → Dubai</strong> and <strong style={{color:"#c084fc"}}>Singapore → Rotterdam</strong> have the highest trader demand right now. List a container on these routes to start earning immediately.
                  </div>
                </div>
              )}
            </div>

            {/* Weather & risk */}
            <div style={s.aiCard}>
              <div style={{...s.aiBadge,background:"rgba(59,130,246,0.2)",color:"#60a5fa"}}>LIVE</div>
              <div style={s.aiT}>Route weather &amp; risk</div>
              <div style={s.aiS}>Current conditions on popular shipping routes</div>

              {/* Route selector pills */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {POPULAR_ROUTES.slice(0,6).map((r,i)=>(
                  <button key={i} style={{fontSize:10,padding:"4px 10px",borderRadius:20,border:"1px solid",cursor:"pointer",transition:"all .15s",borderColor:i===weatherRoute?"rgba(168,85,247,0.5)":"rgba(255,255,255,0.08)",background:i===weatherRoute?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.03)",color:i===weatherRoute?"#c084fc":"rgba(255,255,255,0.4)"}} onClick={()=>setWeatherRoute(i)}>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Weather card for selected route */}
              {aiLoading?(
                <div style={{display:"flex",gap:8,marginBottom:12}}>{[0,1,2].map(i=><div key={i} style={{...s.sk,flex:1,height:90,borderRadius:9}}/>)}</div>
              ):(
                <div>
                  {aiWeather[weatherRoute] ? (
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:14,marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{POPULAR_ROUTES[weatherRoute].label}</div>
                        <div style={{fontSize:9,padding:"2px 8px",borderRadius:10,fontWeight:600,background:aiWeather[weatherRoute].risk==="high"?"rgba(239,68,68,0.15)":aiWeather[weatherRoute].risk==="medium"?"rgba(245,158,11,0.15)":"rgba(16,185,129,0.15)",color:aiWeather[weatherRoute].risk==="high"?"#ef4444":aiWeather[weatherRoute].risk==="medium"?"#f59e0b":"#10b981"}}>
                          {aiWeather[weatherRoute].risk==="low"?"Good conditions":"Moderate risk"}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:16}}>
                        <div style={{fontSize:36}}>{aiWeather[weatherRoute].icon}</div>
                        <div>
                          <div style={{fontSize:24,fontWeight:700,color:"#fff"}}>{aiWeather[weatherRoute].temp}°C</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>💨 {aiWeather[weatherRoute].wind}km/h at destination port</div>
                        </div>
                      </div>
                    </div>
                  ):(
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:14,marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#fff",marginBottom:6}}>{POPULAR_ROUTES[weatherRoute].label}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Loading weather data…</div>
                    </div>
                  )}
                </div>
              )}

              <div style={s.insightBox}>
                <div style={s.insightI}>i</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>
                  {containers.length===0
                    ? "Select any route above to see live weather conditions at the destination port. Weather alerts affect delay risk for cargo on that route."
                    : aiWeather[0]?.risk==="high" ? `High wind warning at ${POPULAR_ROUTES[0].destination}. Notify traders expecting delivery this week.` : "Conditions look manageable across your active routes this week."
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Revenue predictions + Fill-rate alerts */}
          <div style={s.twoCol}>

            {/* Revenue predictions */}
            <div style={s.aiCard}>
              <div style={s.aiBadge}>AI</div>
              <div style={s.aiT}>Revenue predictions</div>
              <div style={s.aiS}>
                {containers.length===0
                  ? "Estimated earnings potential based on platform market rates"
                  : "30 and 90-day revenue forecast for your containers"}
              </div>

              {containers.length===0 ? (
                /* Onboarding revenue preview */
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {label:"Mumbai → Dubai (20ft std)",   low:"$1,400", high:"$1,800", note:"High demand · avg 85% fill rate on platform"},
                    {label:"Mumbai → Dubai (40ft reefer)", low:"$2,800", high:"$3,600", note:"Premium route · refrigerated commands +40%"},
                    {label:"Mumbai → Singapore (20ft)",   low:"$900",   high:"$1,200", note:"Growing demand · 12-day transit"},
                  ].map((r,i)=>(
                    <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                        <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{r.label}</div>
                        <div style={{fontSize:12,fontWeight:600,color:"#10b981"}}>{r.low} – {r.high}</div>
                      </div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{r.note}</div>
                    </div>
                  ))}
                  <div style={{...s.insightBox,borderColor:"rgba(16,185,129,0.25)",background:"rgba(16,185,129,0.06)"}}>
                    <div style={{...s.insightI,background:"rgba(16,185,129,0.25)",color:"#10b981"}}>$</div>
                    <div style={{fontSize:11,color:"rgba(16,185,129,0.85)",lineHeight:1.5}}>Providers with 1–2 containers on high-demand routes earn on average <strong>$3,200–$6,800/month</strong>. Add a container to start.</div>
                  </div>
                </div>
              ) : (
                /* Real revenue forecast */
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                    {[
                      {l:"This month",    v:fmt(thisMonthRev),                  c:"#fff"},
                      {l:"30-day est.",   v:fmt(Math.round(thisMonthRev*1.15)), c:"#10b981"},
                      {l:"90-day est.",   v:fmt(Math.round(thisMonthRev*3.2)),  c:"#a855f7"},
                    ].map(st=>(
                      <div key={st.l} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3}}>{st.l}</div>
                        <div style={{fontSize:15,fontWeight:600,color:st.c}}>{st.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={s.insightBox}>
                    <div style={s.insightI}>i</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>
                      Projections based on your current booking rate. Actual results depend on container fill rates and market conditions.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fill-rate alerts / tips */}
            <div style={s.aiCard}>
              <div style={s.aiBadge}>AI</div>
              <div style={s.aiT}>Fill-rate alerts &amp; tips</div>
              <div style={s.aiS}>
                {containers.length===0
                  ? "Platform insights to maximise your container fill rates"
                  : "Personalised alerts for your containers"}
              </div>

              {aiLoading ? <Sk n={3}/> : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {revAlerts.map((alert:any,i:number)=>(
                    <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",borderRadius:9,border:"1px solid",borderColor:alert.type==="risk"?"rgba(239,68,68,0.25)":alert.type==="opportunity"?"rgba(168,85,247,0.25)":"rgba(245,158,11,0.2)",background:alert.type==="risk"?"rgba(239,68,68,0.06)":alert.type==="opportunity"?"rgba(168,85,247,0.06)":"rgba(245,158,11,0.06)"}}>
                      <div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:alert.type==="risk"?"rgba(239,68,68,0.25)":alert.type==="opportunity"?"rgba(168,85,247,0.25)":"rgba(245,158,11,0.2)",color:alert.type==="risk"?"#ef4444":alert.type==="opportunity"?"#a855f7":"#f59e0b",marginTop:1}}>
                        {alert.type==="risk"?"!":alert.type==="opportunity"?"✦":"→"}
                      </div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.6}}>{alert.message}</div>
                    </div>
                  ))}
                  {revAlerts.length===0&&(
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",textAlign:"center",padding:"16px 0"}}>No alerts right now. All looking good.</div>
                  )}
                </div>
              )}

              {containers.length===0&&(
                <div style={{marginTop:12}}>
                  <button style={{width:"100%",height:38,background:"#7c3aed",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}} onClick={()=>navigate("/dashboard/provider/containers")}>
                    + Add a container to start earning
                  </button>
                </div>
              )}
            </div>
          </div>

      </div>
    </ProviderLayout>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Sk({n}:{n:number}){return<div style={{display:"flex",flexDirection:"column",gap:8}}>{Array.from({length:n}).map((_,i)=><div key={i} style={{height:34,background:"rgba(255,255,255,0.04)",borderRadius:7}}/>)}</div>}

