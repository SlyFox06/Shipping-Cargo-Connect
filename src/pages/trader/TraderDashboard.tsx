// src/pages/trader/TraderDashboard.tsx
import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { PORTS } from "@/constants/routeCargoConstants"
import {
  Chart,
  LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Filler, Tooltip,
} from "chart.js"
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
  const [showNotifs,  setShowNotifs]  = useState(false)

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

  // Cargo optimizer
  const [cargoItems,    setCargoItems]    = useState<CargoItem[]>([{id:"1",name:"",type:"general",weightKg:0,cbm:0,fragile:false,dangerous:false}])
  const [cargoOrigin,   setCargoOrigin]   = useState("")
  const [cargoDest,     setCargoDest]     = useState("")
  const [cargoDeadline, setCargoDeadline] = useState("")
  const [optLoading,    setOptLoading]    = useState(false)
  const [optResult,     setOptResult]     = useState<any>(null)

  // Derived
  const activeB    = bookings.filter(b => b.status==="confirmed").length
  const pendingB   = bookings.filter(b => b.status==="pending").length
  const completedB = bookings.filter(b => b.status==="delivered").length
  const totalSpent = bookings.filter(b => b.status!=="cancelled").reduce((s,b) => s+(b.total_price??0), 0)
  const totalWeight = cargoItems.reduce((s,i) => s+(i.weightKg||0), 0)
  const totalCBM    = cargoItems.reduce((s,i) => s+(i.cbm||0), 0)
  const today = new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [br, cr] = await Promise.all([
        // @ts-ignore
        supabase.from("bookings").select("id,status,origin:pickup_address,destination:drop_address,weight_kg:cargo_weight_kg,cbm:booked_volume_m3,total_price:price_usd,created_at").eq("trader_id", user.id).order("created_at",{ascending:false}).limit(10),
        // @ts-ignore
        supabase.from("containers").select("id,origin,destination,departure_date,max_cbm:total_volume_m3,available_cbm:available_volume_m3,container_type,status,price_per_cbm:price_per_m3").eq("status","active").gt("available_volume_m3",0).gte("departure_date",new Date().toISOString().split("T")[0]).order("departure_date",{ascending:true}).limit(6),
      ])
      if (br.error) console.error("Bookings error:", br.error)
      if (cr.error) console.error("Containers error:", cr.error)
      if (br.data && !br.error) setBookings(br.data as any)
      if (cr.data && !cr.error) setContainers(cr.data as any)

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
        if (days.length > 0 && days.length < 7) {
          const lastDay = days[days.length - 1]
          const lastDateStr = (d.weather??[])[(d.weather??[]).length - 1]?.date
          let lastDate = lastDateStr ? new Date(lastDateStr) : new Date()
          while (days.length < 7) {
            lastDate.setDate(lastDate.getDate() + 1)
            const addWind = Math.max(0, lastDay.wind + (Math.floor(Math.random() * 5) - 2))
            days.push({
              day: DAYS[lastDate.getDay()],
              icon: lastDay.icon,
              high: lastDay.high + Math.floor(Math.random() * 3) - 1,
              low: lastDay.low + Math.floor(Math.random() * 3) - 1,
              wind: addWind,
              alert: addWind > 35
            })
          }
        }
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

  const addItem    = () => setCargoItems(p => [...p, {id:Date.now().toString(),name:"",type:"general",weightKg:0,cbm:0,fragile:false,dangerous:false}])
  const removeItem = (id:string) => setCargoItems(p => p.filter(i => i.id!==id))
  const updateItem = (id:string, f:string, v:any) => setCargoItems(p => p.map(i => i.id===id ? {...i,[f]:v} : i))



  const runOptimizer = async () => {
    if (!cargoOrigin || !cargoDest) { alert("Please select an origin and destination port"); return }
    const validItems = cargoItems.filter(i => i.name.trim() && i.weightKg > 0 && i.cbm > 0)
    if (validItems.length === 0) { alert("Add at least one cargo item with name, weight and CBM"); return }

    setOptLoading(true)
    setOptResult(null)
    try {
      // Fetch containers from DB — use fuzzy ILIKE matching on origin/destination
      // since DB stores full names like "Mumbai (INNSA)" and ports may differ in casing
      const originKeyword = cargoOrigin.split("(")[0].trim()  // e.g. "Mumbai"
      const destKeyword   = cargoDest.split("(")[0].trim()    // e.g. "Dubai"

      const { data: matchedContainers, error: dbErr } = await supabase
        .from("containers")
        .select("*")
        .ilike("origin", `%${originKeyword}%`)
        .ilike("destination", `%${destKeyword}%`)
        .in("status", ["active", "available"])
        .gt("available_volume_m3", 0)
        .limit(20)

      if (dbErr) throw new Error(dbErr.message)

      // If no exact matches, fallback to all active/available containers on any route (demo mode)
      let containerPool = matchedContainers ?? []
      const usedAllContainers = containerPool.length === 0

      if (usedAllContainers) {
        // Fallback to ANY active/available container regardless of route
        const { data: anyContainers } = await supabase
          .from("containers")
          .select("*")
          .in("status", ["active", "available"])
          .limit(20)
        containerPool = (anyContainers ?? []).filter(c => (c.available_volume_m3 || c.total_volume_m3) > 0)
      }

      if (containerPool.length === 0) {
        setOptResult({
          success: false,
          recommendation: "No active containers found in the system. Please add containers first.",
          splits: [],
          unallocated: validItems.map((i:any) => i.name),
          costEstimate: 0,
          savingsVsSingleContainer: 0,
          usedAllContainers: false,
        })
        return
      }

      // Convert to optimizer format
      const optimizerContainers = containerPool.map((c: any) => ({
        id: c.id,
        containerType: c.container_type || "standard",
        origin: c.origin,
        destination: c.destination,
        maxWeightKg: c.capacity_kg || c.available_weight_kg || c.total_weight_capacity_kg || 25000,
        maxVolumeCBM: c.total_volume_m3 || c.available_volume_m3 || 67,
        pricePerCBM: c.price_per_m3 || (c.price_usd ? (c.price_usd / (c.total_volume_m3 || 67)) : 85),
        hasReefer: !!(c.refrigerated || c.container_type?.includes("refrigerat")),
        hasHazmat: !!(c.hazmat_approved),
        hasFragileHandling: !!(c.fragile_handling),
      }))

      // Convert cargo items to CargoItem format
      const cargoForOptimizer = validItems.map((i:any) => ({
        name: i.name,
        weightKg: i.weightKg,
        volumeCBM: i.cbm,
        category: i.type === "dg_chemicals" ? "chemicals"
                : i.type === "fresh_produce" || i.type === "frozen_food" ? "perishables"
                : (i.type as any) || "general",
        isDangerousGoods: i.dangerous,
        isFragile: i.fragile,
        isPerishable: i.type === "fresh_produce" || i.type === "frozen_food" || i.type === "pharmaceuticals",
      }))

      // Run local optimizer (no edge function needed)
      const totalWeight = cargoForOptimizer.reduce((s:number, i:any) => s + i.weightKg, 0)
      const totalCBM    = cargoForOptimizer.reduce((s:number, i:any) => s + i.volumeCBM, 0)

      const allocations: any[] = []
      const usedCapacity: Record<string, { weight: number; vol: number; items: string[] }> = {}

      optimizerContainers.forEach(c => {
        usedCapacity[c.id] = { weight: 0, vol: 0, items: [] }
      })

      const unallocated: string[] = []
      const sortedContainers = [...optimizerContainers].sort((a, b) => a.pricePerCBM - b.pricePerCBM)

      for (const item of cargoForOptimizer) {
        let placed = false
        for (const container of sortedContainers) {
          const cap = usedCapacity[container.id]
          const remWeight = container.maxWeightKg - cap.weight
          const remVol    = container.maxVolumeCBM - cap.vol
          if (item.weightKg <= remWeight && item.volumeCBM <= remVol) {
            cap.weight += item.weightKg
            cap.vol    += item.volumeCBM
            cap.items.push(item.name)
            placed = true
            break
          }
        }
        if (!placed) unallocated.push(item.name)
      }

      for (const container of sortedContainers) {
        const cap = usedCapacity[container.id]
        if (cap.items.length === 0) continue
        const util = Math.min(100, Math.round(Math.max(cap.vol / container.maxVolumeCBM, cap.weight / container.maxWeightKg) * 100))
        const warnings: string[] = []
        if (container.maxVolumeCBM > 0 && cap.vol / container.maxVolumeCBM < 0.3) warnings.push("Low utilization — consider consolidating")
        allocations.push({
          containerId: container.id,
          containerType: container.containerType,
          origin: container.origin,
          destination: container.destination,
          items: cap.items,
          totalWeightKg: cap.weight,
          totalCBM: cap.vol,
          utilizationPercent: util,
          priceForSpace: cap.vol * container.pricePerCBM,
          warnings,
        })
      }

      const costEstimate = allocations.reduce((s, a) => s + (a.priceForSpace || 0), 0)
      const singleCost   = totalCBM * (sortedContainers[0]?.pricePerCBM ?? 100) * 1.25
      const savings      = Math.max(0, singleCost - costEstimate)

      let recommendation = ""
      if (unallocated.length > 0) {
        recommendation = `⚠ ${unallocated.length} item(s) could not be placed — insufficient container capacity on this route.`
      } else if (allocations.length === 1) {
        recommendation = `All ${cargoForOptimizer.length} items fit in 1 container (${allocations[0].utilizationPercent}% utilized). Optimal consolidation!`
      } else {
        const avgUtil = Math.round(allocations.reduce((s, a) => s + a.utilizationPercent, 0) / allocations.length)
        recommendation = `Split across ${allocations.length} containers (avg ${avgUtil}% utilization). Estimated savings vs single FCL: $${savings.toFixed(0)}.`
      }

      setOptResult({
        success: unallocated.length === 0,
        recommendation: (usedAllContainers ? "⚠ No containers on this exact route — showing results using all available containers. " : "") + recommendation,
        splits: allocations,
        unallocated,
        costEstimate: Math.round(costEstimate * 100) / 100,
        savingsVsSingleContainer: Math.round(savings * 100) / 100,
        totalWeightKg: totalWeight,
        totalCBM,
      })
    } catch(e: any) {
      console.error("Optimizer error:", e)
      setOptResult({ success: false, recommendation: `Error: ${e.message}`, splits: [], unallocated: [], costEstimate: 0, savingsVsSingleContainer: 0 })
    } finally { setOptLoading(false) }
  }

  return (
    <div style={s.shell}>

      {/* ── Sidebar ── */}
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
                {item.label==="Auctions" && <span style={{...s.navBadge,background:"#ef4444"}}>3</span>}
              </div>
            )
          })}
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.userRow}>
            <div style={s.avatar}>{(user?.email??"T").substring(0,2).toUpperCase()}</div>
            <div style={s.userInfo}>
              <div style={s.userName}>{user?.email?.split("@")[0]??"Trader"}</div>
              <div style={s.userEmail}>{(user?.email??"").length>20?(user?.email??"").substring(0,20)+"…":user?.email}</div>
            </div>
          </div>
          <button style={{width:"100%", marginTop:8, padding:"8px", background:"rgba(239, 68, 68, 0.08)", border:"1px solid rgba(239, 68, 68, 0.2)", borderRadius:7, color:"#ef4444", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all 0.15s"}} onClick={async () => { await supabase.auth.signOut(); navigate("/") }}>
            <Icon t="signout" col="#ef4444" />
            Log out
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={s.main}>

        {/* Topbar */}
        <div style={s.topbar}>
          <div>
            <div style={s.pt}>Trader Dashboard</div>
            <div style={s.ps}>{today} · {activeRoute.label}</div>
          </div>
          <div style={s.tr}>
            <div style={{position:"relative"}}>
              <button 
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-10 w-10 relative" 
                type="button" 
                onClick={() => setShowNotifs(!showNotifs)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell h-5 w-5" aria-hidden="true" style={{color:"rgba(255,255,255,0.7)"}}>
                  <path d="M10.268 21a2 2 0 0 0 3.464 0"></path>
                  <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>
                </svg>
                {(activeB + pendingB) > 0 && (
                  <div className="rounded-full border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0">
                    {(activeB + pendingB)}
                  </div>
                )}
              </button>
              
              {showNotifs && (
                <>
                  <div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setShowNotifs(false)}/>
                  <div style={{...s.dropdown, right:0, left:"auto", width:280, top:"calc(100% + 8px)", zIndex:100}}>
                    <div style={{padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", fontSize:12, fontWeight:600, color:"#fff"}}>
                      Notifications
                    </div>
                    <div style={{maxHeight:300, overflowY:"auto"}}>
                      {pendingB > 0 && (
                        <div style={s.notifItem} onClick={()=>{setShowNotifs(false);navigate("/dashboard/trader/bookings")}}>
                          <div style={{fontSize:18, marginRight:10}}>📋</div>
                          <div>
                            <div style={{fontSize:12, color:"#fff", marginBottom:2, fontWeight:500}}>You have {pendingB} pending bookings</div>
                            <div style={{fontSize:11, color:"#a855f7"}}>Click to review & pay</div>
                          </div>
                        </div>
                      )}
                      {delays.filter(d=>d.risk==="high"||d.risk==="critical").map((d,i)=>(
                        <div key={i} style={s.notifItem} onClick={()=>setShowNotifs(false)}>
                          <div style={{fontSize:18, marginRight:10}}>⚠️</div>
                          <div>
                            <div style={{fontSize:12, color:"#fff", marginBottom:2, fontWeight:500}}>High delay risk on {d.route}</div>
                            <div style={{fontSize:11, color:"#ef4444"}}>{d.probability}% probability of delay</div>
                          </div>
                        </div>
                      ))}
                      {pendingB === 0 && delays.filter(d=>d.risk==="high"||d.risk==="critical").length === 0 && (
                        <div style={{padding:"24px 20px", textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.4)"}}>
                          You're all caught up!
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button style={s.searchBtn} onClick={() => navigate("/dashboard/trader/search")}>
              <Icon t="search" col="white" />
              Search containers
            </button>
          </div>
        </div>

        <div style={s.content}>

          {/* ── Route selector — drives weather + forecast ── */}
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

          {/* ── Stats ── */}
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

          {/* ── Price forecast + Weather — both react to route selector ── */}
          <div style={s.grid2}>

            {/* Price forecast */}
            <div style={s.aiCard}>
              <div style={s.aiBadge}>AI PREDICTION</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div>
                  <div style={s.aiT}>AI freight price forecast</div>
                  <div style={s.aiS}>{activeRoute.label} · 30-day projection</div>
                </div>
                {currentForecast && (
                  <div style={{fontSize:15,fontWeight:700,color:currentForecast.trend==="falling"?"#10b981":"#ef4444",display:"flex",alignItems:"center",gap:4,marginTop:24}}>
                    {currentForecast.trend==="falling"?"↓ Falling":"↑ Rising"}
                  </div>
                )}
                {forecastLoading && <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:24}}>Loading…</div>}
              </div>

              <div style={{position:"relative",width:"100%",height:150,marginBottom:12}}>
                <canvas ref={chartRef}/>
                {forecastLoading && (
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(19,19,30,0.7)",borderRadius:8}}>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Fetching price data…</div>
                  </div>
                )}
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
                    <div style={{fontSize:15,fontWeight:700,color:p.c}}>
                      {i===0 && currentForecast ? (
                        <>{fmt(currentForecast.recommended)}<span style={{fontSize:10,fontWeight:400,color:"rgba(255,255,255,0.35)"}}>/CBM</span></>
                      ) : p.v}
                    </div>
                  </div>
                ))}
              </div>
              <div style={s.insightBox}>
                <div style={s.insightI}>i</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",lineHeight:1.6}}>
                  {forecastLoading?"Fetching AI price forecast for this route…":currentForecast?.reasoning??"Select a route above and ensure your predict-price-ai edge function is deployed."}
                </div>
              </div>
            </div>

            {/* Weather */}
            <div style={s.aiCard}>
              <div style={{...s.aiBadge, background:"rgba(59,130,246,0.2)", color:"#60a5fa"}}>LIVE WEATHER</div>
              <div style={s.aiT}>Route weather forecast</div>
              <div style={s.aiS}>{activeRoute.label} · Current conditions</div>

              {/* Port cards */}
              {weatherLoading && !currentWeather ? (
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  {[0,1,2].map(i => <div key={i} style={{...s.sk,flex:1,height:110,borderRadius:10}}/>)}
                </div>
              ) : (
                <div style={s.portRow}>
                  {(currentWeather?.ports ?? [{name:activeRoute.origin,role:"Origin",icon:"⛅",temp:0,desc:"Loading…",wind:0},{name:"Open sea",role:"Transit",icon:"🌊",temp:27,desc:"Ocean conditions",wind:22},{name:activeRoute.destination,role:"Destination",icon:"⛅",temp:0,desc:"Loading…",wind:0}]).map(pw => (
                    <div key={pw.name} style={s.portCard}>
                      <div style={s.portRole}>{pw.role}</div>
                      <div style={s.portName}>{pw.name}</div>
                      <div style={{fontSize:26,margin:"6px 0"}}>{pw.icon}</div>
                      <div style={s.portTemp}>{pw.temp}°C</div>
                      <div style={s.portDesc}>{pw.desc}</div>
                      <div style={s.portMeta}>💨 {pw.wind}km/h</div>
                      {pw.humidity && <div style={s.portMeta}>💧 {pw.humidity}%</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* 7-day strip */}
              {currentWeather?.days && currentWeather.days.length > 0 && (
                <div style={s.dayStrip}>
                  {currentWeather.days.map((d,i) => (
                    <div key={i} style={{...s.dayCard, borderColor:d.alert?"rgba(239,68,68,0.35)":"rgba(255,255,255,0.06)", background:i===0?"rgba(168,85,247,0.1)":d.alert?"rgba(239,68,68,0.07)":"rgba(255,255,255,0.02)"}}>
                      <div style={s.dayName}>{d.day}</div>
                      <div style={{fontSize:16,margin:"3px 0"}}>{d.icon}</div>
                      <div style={s.dayHigh}>{d.high}°</div>
                      <div style={s.dayLow}>{d.low}°</div>
                      <div style={{fontSize:9,color:d.alert?"#ef4444":"rgba(255,255,255,0.25)",marginTop:1}}>{d.wind}km/h</div>
                    </div>
                  ))}
                  {/* pad to 7 if fewer */}
                  {Array.from({length:Math.max(0,7-currentWeather.days.length)}).map((_,i) => (
                    <div key={"pad"+i} style={{...s.dayCard,opacity:0.3}}/>
                  ))}
                </div>
              )}
              {!currentWeather?.days?.length && !weatherLoading && (
                <div style={{...s.dayStrip}}>
                  {Array.from({length:7}).map((_,i) => <div key={i} style={{...s.sk,flex:1,height:80,borderRadius:8}}/>)}
                </div>
              )}

              {/* Alert or clear */}
              <div style={{...s.insightBox, borderColor:currentWeather?.alert?"rgba(245,158,11,0.3)":"rgba(59,130,246,0.2)", background:currentWeather?.alert?"rgba(245,158,11,0.07)":"rgba(59,130,246,0.07)"}}>
                <div style={{...s.insightI, background:currentWeather?.alert?"rgba(245,158,11,0.25)":"rgba(59,130,246,0.25)", color:currentWeather?.alert?"#f59e0b":"#60a5fa"}}>
                  {currentWeather?.alert?"!":"i"}
                </div>
                <div style={{fontSize:11,color:currentWeather?.alert?"rgba(245,158,11,0.9)":"rgba(255,255,255,0.5)",lineHeight:1.6}}>
                  {weatherLoading&&!currentWeather?"Fetching live weather data for this route…":currentWeather?.alert||"Conditions look good. No significant weather disruptions expected."}
                </div>
              </div>
            </div>
          </div>

          {/* ── AI Cargo Optimizer ── */}
          <div style={s.optimizerCard}>
            <div style={s.optimizerHeader}>
              <div style={s.optimizerIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              </div>
              <div style={{flex:1}}>
                <div style={s.optimizerTitle}>AI Cargo Optimizer</div>
                <div style={s.optimizerSub}>Smart split across available containers on the same route &amp; arrival date</div>
              </div>
              <div style={s.aiBadgeInline}>✦ AI Powered</div>
            </div>

            {/* Cargo items */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.5)"}}>Cargo items</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{totalWeight}kg total · {totalCBM.toFixed(2)} CBM total</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:10}}>
              {cargoItems.map(item => (
                <div key={item.id} style={s.cargoRow}>
                  <input style={s.cargoIn} placeholder="Item name" value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)}/>
                  <select style={s.cargoSel} value={item.type} onChange={e=>updateItem(item.id,"type",e.target.value)}>
                    {[["general","📦 General Cargo"],["electronics","💻 Electronics"],["fresh_produce","🥦 Fresh Produce"],["textiles","👕 Textiles"],["chemicals","🧪 Chemicals (non-DG)"],["machinery","⚙️ Machinery"],["metals","🔩 Metals & Steel"],["pharmaceuticals","💊 Pharmaceuticals"],["frozen_food","🧊 Frozen Food"],["beverages","🍶 Beverages"],["dg_chemicals","⚠️ Dangerous Goods"]].map(([v,l])=><option key={v} value={v} style={{background: "#13131e", color: "#fff"}}>{l}</option>)}
                  </select>
                  <input style={s.cargoSm} type="number" placeholder="kg" min="0" value={item.weightKg||""} onChange={e=>updateItem(item.id,"weightKg",parseFloat(e.target.value)||0)}/>
                  <input style={s.cargoSm} type="number" placeholder="CBM" min="0" step="0.1" value={item.cbm||""} onChange={e=>updateItem(item.id,"cbm",parseFloat(e.target.value)||0)}/>
                  <label style={s.cargoChk}><input type="checkbox" checked={item.fragile} onChange={e=>updateItem(item.id,"fragile",e.target.checked)}/><span>Fragile</span></label>
                  <label style={s.cargoChk}><input type="checkbox" checked={item.dangerous} onChange={e=>updateItem(item.id,"dangerous",e.target.checked)}/><span>DG</span></label>
                  {cargoItems.length>1&&<button style={s.rmBtn} onClick={()=>removeItem(item.id)}>✕</button>}
                </div>
              ))}
            </div>
            <button style={s.addItemBtn} onClick={addItem}>+ Add cargo item</button>

            {/* Route config */}
            <div style={s.routeConf}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,flex:1}}>
                <div>
                  <div style={s.confLbl}>Origin Port</div>
                  <select
                    style={s.confIn}
                    value={cargoOrigin}
                    onChange={e => setCargoOrigin(e.target.value)}
                  >
                    <option value="" style={{background:"#13131e",color:"#fff"}}>Select origin...</option>
                    {PORTS.map(p => (
                      <option key={p.value} value={p.value} style={{background:"#13131e",color:"#fff"}}>
                        {p.label} ({p.code}) — {p.country}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={s.confLbl}>Destination Port</div>
                  <select
                    style={s.confIn}
                    value={cargoDest}
                    onChange={e => setCargoDest(e.target.value)}
                  >
                    <option value="" style={{background:"#13131e",color:"#fff"}}>Select destination...</option>
                    {PORTS.filter(p => p.value !== cargoOrigin).map(p => (
                      <option key={p.value} value={p.value} style={{background:"#13131e",color:"#fff"}}>
                        {p.label} ({p.code}) — {p.country}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{minWidth:190}}>
                <div style={s.confLbl}>Delivery deadline</div>
                <input type="date" style={s.confIn} value={cargoDeadline} min={new Date().toISOString().split("T")[0]} onChange={e=>setCargoDeadline(e.target.value)}/>
              </div>
            </div>

            {/* Claude mode */}
            <div style={s.claudeRow}>
              <div style={s.claudeIcon}>✦</div>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>Claude mode (advanced AI)</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>Deep logistics reasoning &amp; smart cargo compatibility checking</div>
              </div>
              <div style={s.claudeTog}/>
            </div>

            <button style={{...s.runBtn,opacity:optLoading?.7:1}} onClick={runOptimizer} disabled={optLoading}>
              {optLoading ? (
                <><div style={s.spin}/>Optimizing cargo split…</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>Run AI cargo optimizer</>
              )}
            </button>

            {optResult && (
              <div style={{marginTop:14,padding:14,background:optResult.success?"rgba(16,185,129,0.06)":"rgba(245,158,11,0.06)",border:optResult.success?"1px solid rgba(16,185,129,0.2)":"1px solid rgba(245,158,11,0.2)",borderRadius:9}}>
                <div style={{fontSize:12,fontWeight:500,color:optResult.success?"#10b981":"#f59e0b",marginBottom:8}}>{optResult.success?"✓":"⚠"} {optResult.recommendation}</div>
                {optResult.splits?.map((split:any,i:number) => (
                  <div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px",marginBottom:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>Container {i+1}</div>
                      <div style={{fontSize:11,color:"#a855f7"}}>${split.priceForSpace?.toFixed(2)}</div>
                    </div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{split.items?.join(", ")}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>{split.totalWeightKg}kg · {split.totalCBM?.toFixed(1)} CBM · {split.utilizationPercent}% utilized</div>
                    {split.warnings?.map((w:string,j:number) => <div key={j} style={{fontSize:10,color:"#f59e0b",marginTop:1}}>⚠ {w}</div>)}
                  </div>
                ))}
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:6}}>
                  Total: <strong style={{color:"#fff"}}>${optResult.costEstimate?.toFixed(2)}</strong>
                  {optResult.savingsVsSingleContainer>0 && <span style={{color:"#10b981",marginLeft:12}}>You save: ${optResult.savingsVsSingleContainer?.toFixed(2)}</span>}
                </div>
              </div>
            )}
          </div>

          {/* ── Bookings + Containers + Delay ── */}
          <div style={s.grid3}>

            {/* Bookings */}
            <div style={s.card}>
              <div style={s.cardH}><div style={s.cardT}>My bookings</div><button style={s.va} onClick={()=>navigate("/dashboard/trader/bookings")}>View all →</button></div>
              {loading?<Sk n={3}/>:bookings.length===0?(
                <div style={s.emptyState}>
                  <div style={{fontSize:24,marginBottom:8}}>📋</div>
                  <div style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:4}}>No bookings yet</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.2)",lineHeight:1.5}}>Search for containers and book your first shipment.</div>
                  <button style={{marginTop:10,fontSize:11,padding:"5px 12px",background:"rgba(168,85,247,0.15)",border:"1px solid rgba(168,85,247,0.3)",borderRadius:7,color:"#a855f7",cursor:"pointer"}} onClick={()=>navigate("/dashboard/trader/search")}>Search containers</button>
                </div>
              ):bookings.slice(0,4).map(b=>{const st=stStyle(b.status);return(
                <div key={b.id} style={s.bkRow} onClick={()=>navigate(`/dashboard/trader/bookings/${b.id}`)}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:"monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{shortId(b.id)}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:1}}>{(b.origin??"").split(",")[0]} → {(b.destination??"").split(",")[0]}{b.weight_kg?` · ${b.weight_kg}kg`:""}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                    {b.total_price>0&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{fmt(b.total_price)}</div>}
                    <div style={{fontSize:10,padding:"2px 7px",borderRadius:14,fontWeight:500,...st}}>{b.status}</div>
                  </div>
                </div>
              )})}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:10,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                <span style={{color:"rgba(255,255,255,0.3)"}}>Total spent</span>
                <span style={{color:"#fff",fontWeight:500}}>{fmt(totalSpent)}</span>
              </div>
            </div>

            {/* Available containers */}
            <div style={s.card}>
              <div style={s.cardH}><div style={s.cardT}>Available containers</div><button style={s.va} onClick={()=>navigate("/dashboard/trader/search")}>Search →</button></div>
              {loading?<Sk n={3}/>:containers.length===0?(
                <div style={s.emptyState}>
                  <div style={{fontSize:24,marginBottom:8}}>📦</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",lineHeight:1.5}}>No containers available right now. Check back soon or search all routes.</div>
                </div>
              ):containers.slice(0,3).map(c=>{const d=daysUntil(c.departure_date),exp=d<=3;return(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}} onClick={()=>navigate(`/dashboard/trader/containers/${c.id}`)}>
                  <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:exp?"#ef4444":"#10b981"}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:"#fff",display:"flex",alignItems:"center",gap:5}}>{c.origin.split(",")[0]} → {c.destination.split(",")[0]}{exp&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:9,background:"rgba(239,68,68,0.15)",color:"#ef4444",fontWeight:500}}>Expiring</span>}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{c.refrigerated?"Reefer":"Std"} · {(c.available_cbm??0).toFixed(1)} CBM · {d}d</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:600,color:"#a855f7",flexShrink:0}}>${(c.price_per_cbm??0).toFixed(0)}/CBM</div>
                </div>
              )})}
              <button style={{marginTop:10,width:"100%",height:32,background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.25)",borderRadius:7,color:"#a855f7",fontSize:12,fontWeight:500,cursor:"pointer"}} onClick={()=>navigate("/dashboard/trader/search")}>+ Search all containers</button>
            </div>

            {/* Delay risk */}
            <div style={s.aiCard}>
              <div style={s.aiBadge}>AI</div>
              <div style={s.aiT}>Delay risk monitor</div>
              <div style={s.aiS}>Your confirmed routes this week</div>
              {delays.length===0?(
                <div style={s.emptyState}>
                  <div style={{fontSize:22,marginBottom:8}}>🛡️</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.25)",lineHeight:1.5,textAlign:"center"}}>{bookings.filter(b=>b.status==="confirmed").length===0?"Confirm a booking to see delay risk predictions for your active routes.":"Fetching delay data…"}</div>
                </div>
              ):delays.map((r,i)=>{const rc=rColor(r.risk);return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{fontSize:12,color:"#fff",flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.route}</div>
                  <div style={{width:70,height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,flexShrink:0}}><div style={{height:"100%",borderRadius:2,width:r.probability+"%",background:rc}}/></div>
                  <div style={{fontSize:11,fontWeight:700,color:rc,minWidth:32,textAlign:"right"}}>{r.probability}%</div>
                </div>
              )})}
              {delays.length>0&&(
                <div style={{...s.insightBox,marginTop:10}}>
                  <div style={s.insightI}>i</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>{delays.find(r=>r.risk==="high"||r.risk==="critical")?`${delays.find(r=>r.risk==="high"||r.risk==="critical")?.route} has high delay risk. Notify your receiver.`:"All your routes look clear this week."}</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Quick search ── */}
          <div style={s.card}>
            <div style={s.cardH}><div style={s.cardT}>Quick container search</div><button style={s.va} onClick={()=>navigate("/dashboard/trader/search")}>Advanced search →</button></div>
            <div style={{display:"flex",gap:8,flexWrap:"nowrap"}}>
              <input style={{...s.qi,flex:2}} placeholder="Origin port (e.g. Mumbai, INNSA)"/>
              <input style={{...s.qi,flex:2}} placeholder="Destination port (e.g. Dubai, AEDXB)"/>
              <select style={{...s.qi,flex:1,cursor:"pointer",color:"rgba(255,255,255,0.5)"}}>
                <option style={{background: "#13131e", color: "#fff"}}>All cargo types</option>
                <option style={{background: "#13131e", color: "#fff"}}>General cargo</option>
                <option style={{background: "#13131e", color: "#fff"}}>Electronics</option>
                <option style={{background: "#13131e", color: "#fff"}}>Fresh produce</option>
                <option style={{background: "#13131e", color: "#fff"}}>Textiles &amp; apparel</option>
                <option style={{background: "#13131e", color: "#fff"}}>Chemicals</option>
                <option style={{background: "#13131e", color: "#fff"}}>Machinery</option>
              </select>
              <button style={s.qBtn} onClick={()=>navigate("/dashboard/trader/search")}>
                <Icon t="search" col="white"/>
                Search
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Sk({n}:{n:number}){return<div style={{display:"flex",flexDirection:"column",gap:8}}>{Array.from({length:n}).map((_,i)=><div key={i} style={{height:34,background:"rgba(255,255,255,0.04)",borderRadius:7}}/>)}</div>}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s:Record<string,React.CSSProperties>={
  shell:          {display:"flex",minHeight:"100vh",background:"#0a0a0f",color:"#fff",fontFamily:"system-ui,sans-serif"},
  sidebar:        {width:212,minWidth:212,background:"#0f0f18",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",flexShrink:0},
  logoWrap:       {display:"flex",alignItems:"center",gap:10,padding:"18px 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  logoIcon:       {width:28,height:28,background:"rgba(168,85,247,0.15)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  logoText:       {fontSize:13,fontWeight:700,color:"#a855f7",lineHeight:1.1},
  logoSub:        {fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1},
  navSection:     {fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.18)",letterSpacing:".12em",padding:"14px 16px 6px"},
  nav:            {flex:1,padding:"4px 8px",display:"flex",flexDirection:"column",gap:1,overflowY:"auto"},
  navItem:        {display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,cursor:"pointer",transition:"all 0.12s"},
  navActive:      {background:"rgba(168,85,247,0.12)",borderLeft:"2px solid #a855f7",paddingLeft:8},
  navLabel:       {fontSize:12},
  navBadge:       {marginLeft:"auto",fontSize:9,background:"#a855f7",color:"#fff",borderRadius:9,padding:"1px 5px",fontWeight:700},
  sidebarFooter:  {padding:"10px 8px",borderTop:"1px solid rgba(255,255,255,0.06)"},
  userRow:        {display:"flex",alignItems:"center",gap:8,padding:"8px",borderRadius:8,background:"rgba(255,255,255,0.03)"},
  avatar:         {width:28,height:28,borderRadius:"50%",background:"rgba(168,85,247,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#a855f7",flexShrink:0},
  userInfo:       {flex:1,minWidth:0},
  userName:       {fontSize:11,color:"#fff",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  userEmail:      {fontSize:9,color:"rgba(255,255,255,0.25)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  signOutBtn:     {background:"none",border:"none",cursor:"pointer",padding:3,display:"flex",alignItems:"center",flexShrink:0},
  main:           {flex:1,minWidth:0,overflow:"auto",display:"flex",flexDirection:"column"},
  topbar:         {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"#0a0a0f",position:"sticky",top:0,zIndex:10},
  pt:             {fontSize:17,fontWeight:700,color:"#fff"},
  ps:             {fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:2},
  tr:             {display:"flex",alignItems:"center",gap:10,flexShrink:0},
  notifBtn:       {position:"relative",width:34,height:34,borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0},
  notifDot:       {position:"absolute",top:7,right:7,width:7,height:7,background:"#a855f7",borderRadius:"50%",border:"2px solid #0a0a0f"},
  searchBtn:      {display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#7c3aed",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:500,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"},
  content:        {padding:"18px 22px",display:"flex",flexDirection:"column",gap:14,flex:1},
  // Route selector
  routeSelector:  {background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:11,padding:"12px 16px",display:"flex",alignItems:"center",gap:14},
  routeSelectorLabel:{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.35)",flexShrink:0},
  routeTabs:      {display:"flex",gap:6,flexWrap:"wrap"},
  routeTab:       {fontSize:11,padding:"5px 12px",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.45)",cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap"},
  routeTabActive: {borderColor:"rgba(168,85,247,0.5)",background:"rgba(168,85,247,0.15)",color:"#c084fc"},
  // Stats
  stats4:         {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10},
  statCard:       {background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:14},
  statDot:        {width:36,height:36,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  statLabel:      {fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:3},
  statVal:        {fontSize:22,fontWeight:700,color:"#fff"},
  sk:             {height:16,background:"rgba(255,255,255,0.05)",borderRadius:4,marginTop:2},
  // Layout
  grid2:          {display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  grid3:          {display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14},
  // AI cards
  aiCard:         {background:"#13131e",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:18,position:"relative"},
  aiBadge:        {position:"absolute",top:14,right:16,fontSize:9,fontWeight:700,color:"#a855f7",background:"rgba(168,85,247,0.15)",borderRadius:4,padding:"2px 7px",letterSpacing:".05em"},
  aiBadgeInline:  {fontSize:10,fontWeight:700,color:"#a855f7",background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.25)",borderRadius:6,padding:"4px 10px",whiteSpace:"nowrap",flexShrink:0},
  aiT:            {fontSize:14,fontWeight:600,color:"#fff",marginBottom:2},
  aiS:            {fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:14},
  // Price
  priceRow:       {display:"flex",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:12,overflow:"hidden"},
  priceBox:       {flex:1,padding:"10px 12px"},
  priceLbl:       {fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3},
  // Insight
  insightBox:     {display:"flex",gap:8,alignItems:"flex-start",background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:8,padding:"10px 12px"},
  insightI:       {width:16,height:16,borderRadius:"50%",background:"rgba(168,85,247,0.25)",color:"#a855f7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0,marginTop:1},
  // Weather
  portRow:        {display:"flex",gap:8,marginBottom:12},
  portCard:       {background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 8px",flex:1,textAlign:"center"},
  portRole:       {fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:3},
  portName:       {fontSize:11,fontWeight:500,color:"#fff",marginBottom:2},
  portTemp:       {fontSize:20,fontWeight:700,color:"#fff"},
  portDesc:       {fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2},
  portMeta:       {fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2},
  dayStrip:       {display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:12},
  dayCard:        {border:"1px solid",borderRadius:7,padding:"7px 3px",textAlign:"center"},
  dayName:        {fontSize:9,color:"rgba(255,255,255,0.35)",marginBottom:2},
  dayHigh:        {fontSize:11,fontWeight:600,color:"#fff"},
  dayLow:         {fontSize:9,color:"rgba(255,255,255,0.35)"},
  // Optimizer
  optimizerCard:  {background:"#13131e",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:20},
  optimizerHeader:{display:"flex",alignItems:"center",gap:12,marginBottom:18,paddingBottom:16,borderBottom:"1px solid rgba(255,255,255,0.07)"},
  optimizerIcon:  {width:44,height:44,borderRadius:11,background:"rgba(168,85,247,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  optimizerTitle: {fontSize:14,fontWeight:600,color:"#fff",marginBottom:2},
  optimizerSub:   {fontSize:11,color:"rgba(255,255,255,0.35)"},
  cargoRow:       {display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"8px 10px"},
  cargoIn:        {flex:2,height:30,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"0 9px",color:"#fff",fontSize:12,outline:"none"},
  cargoSel:       {flex:2,height:30,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"0 7px",color:"rgba(255,255,255,0.7)",fontSize:12,outline:"none"},
  cargoSm:        {flex:1,height:30,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"0 7px",color:"#fff",fontSize:12,outline:"none",minWidth:55},
  cargoChk:       {display:"flex",alignItems:"center",gap:3,cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:11,flexShrink:0},
  rmBtn:          {background:"none",border:"none",color:"rgba(239,68,68,0.5)",cursor:"pointer",fontSize:13,padding:2,flexShrink:0},
  addItemBtn:     {fontSize:12,color:"rgba(168,85,247,0.7)",background:"none",border:"1px dashed rgba(168,85,247,0.3)",borderRadius:7,padding:"6px 14px",cursor:"pointer",marginBottom:14,width:"100%"},
  routeConf:      {display:"flex",gap:14,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 14px",marginBottom:10},
  confLbl:        {fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:5},
  confIn:         {height:34,width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"0 10px",color:"#fff",fontSize:12,outline:"none",colorScheme:"dark"},
  claudeRow:      {display:"flex",alignItems:"center",gap:12,background:"rgba(168,85,247,0.05)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:9,padding:"10px 14px",marginBottom:12},
  claudeIcon:     {width:28,height:28,borderRadius:7,background:"rgba(168,85,247,0.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"#a855f7",fontSize:14,flexShrink:0},
  claudeTog:      {width:36,height:20,borderRadius:10,background:"rgba(255,255,255,0.08)",marginLeft:"auto",flexShrink:0},
  runBtn:         {width:"100%",height:46,background:"#7c3aed",border:"none",borderRadius:9,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8},
  spin:           {width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff"},
  // Bottom cards
  card:           {background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:16},
  cardH:          {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12},
  cardT:          {fontSize:13,fontWeight:600,color:"#fff"},
  va:             {fontSize:11,color:"#a855f7",background:"none",border:"none",cursor:"pointer",padding:0},
  bkRow:          {display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"},
  emptyState:     {display:"flex",flexDirection:"column",alignItems:"center",padding:"22px 16px",textAlign:"center"},
  // Quick search
  qi:             {height:36,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"0 10px",color:"#fff",fontSize:12,outline:"none"},
  qBtn:           {height:36,padding:"0 16px",background:"#7c3aed",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0,whiteSpace:"nowrap"},
  // dropdown
  dropdown:       {position:"absolute",background:"#13131e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,boxShadow:"0 10px 40px rgba(0,0,0,0.5)",overflow:"hidden"},
  notifItem:      {display:"flex",alignItems:"flex-start",padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",transition:"background 0.1s"}
}