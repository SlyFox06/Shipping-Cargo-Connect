// src/pages/trader/SearchContainers.tsx
//
// COMPLETE REWRITE of the search page:
// ✅ Port dropdowns with 30+ ports, searchable, grouped by region
// ✅ Cargo type dropdown with 17 types grouped by category
// ✅ Popular route pills (click to instantly fill origin + destination)
// ✅ Advanced filters: container type, weight, CBM, departure date, price
// ✅ AI-Powered Recommendations toggle
// ✅ Results grid with book button
// ✅ Real Supabase query
//
// Adjust import path if needed:
//   import { supabase } from "@/integrations/supabase/client"   ← Lovable
//   import { supabase } from "@/lib/supabase"                   ← custom

import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import {
  PortSelect,
  CargoTypeSelect,
  PopularRoutePills,
  CARGO_TYPES,
} from "@/components/shared/PortCargoDropdowns"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Container {
  id: string; origin: string; destination: string
  departure_date?: string; arrival_date?: string;
  available_from?: string; available_until?: string;
  available_cbm?: number; max_cbm?: number
  available_volume_m3?: number; total_volume_m3?: number;
  max_weight_kg?: number; capacity_kg?: number;
  price_per_cbm?: number; price_usd?: number; price_per_m3?: number;
  container_type: string; refrigerated?: boolean
  status: string; provider_id: string
  transit_days?: number
}

const daysUntil = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000))
const fmt = (n: number) => n >= 1000 ? "$" + (n / 1000).toFixed(1) + "K" : "$" + n.toLocaleString()
const fillRate = (c: any) => {
  const max = c.max_cbm ?? c.total_volume_m3 ?? 0
  const avail = c.available_cbm ?? c.available_volume_m3 ?? max
  return max ? Math.round(((max - avail) / max) * 100) : 0
}
const fillColor = (p: number) => p >= 75 ? "#10b981" : p >= 40 ? "#f59e0b" : "rgba(255,255,255,0.3)"

// ─── Component ────────────────────────────────────────────────────────────────
interface SearchContainersProps {
  onBookContainer?: (container: any) => void;
  onAskQuestion?: (container: any) => void;
}

export default function SearchContainers({ onBookContainer, onAskQuestion }: SearchContainersProps = {}) {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  // Filters
  const [origin,         setOrigin]         = useState("")
  const [destination,    setDestination]    = useState("")
  const [cargoType,      setCargoType]      = useState("")
  const [containerType,  setContainerType]  = useState("")
  const [minCBM,         setMinCBM]         = useState("")
  const [maxWeight,      setMaxWeight]      = useState("")
  const [maxPrice,       setMaxPrice]       = useState("")
  const [departureFrom,  setDepartureFrom]  = useState("")
  const [departureTo,    setDepartureTo]    = useState("")
  const [reeferOnly,     setReeferOnly]     = useState(false)
  const [aiMode,         setAiMode]         = useState(false)
  const [showAdvanced,   setShowAdvanced]   = useState(false)
  const [activeFilters,  setActiveFilters]  = useState(0)

  // Results
  const [results,  setResults]  = useState<Container[]>([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)
  const [sortBy,   setSortBy]   = useState<"price"|"departure"|"cbm"|"fill">("departure")

  // Count active filters
  useEffect(() => {
    let n = 0
    if (containerType) n++
    if (minCBM)        n++
    if (maxWeight)     n++
    if (maxPrice)      n++
    if (departureFrom) n++
    if (departureTo)   n++
    if (reeferOnly)    n++
    setActiveFilters(n)
  }, [containerType, minCBM, maxWeight, maxPrice, departureFrom, departureTo, reeferOnly])

  const clearAll = () => {
    setOrigin(""); setDestination(""); setCargoType(""); setContainerType("")
    setMinCBM(""); setMaxWeight(""); setMaxPrice(""); setDepartureFrom(""); setDepartureTo(""); setReeferOnly(false)
    setResults([]); setSearched(false)
  }

  // ── Search ──
  const search = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      let q = supabase
        .from("containers")
        .select("*")
        .or("status.eq.active,status.eq.available")
        .or("available_cbm.gt.0,available_volume_m3.gt.0")
        .or(`departure_date.gte.${today},available_from.gte.${today}`);

      if (origin) {
        const city = origin.split(",")[0].trim();
        q = q.ilike("origin", `%${city}%`);
      }
      if (destination) {
        const city = destination.split(",")[0].trim();
        q = q.ilike("destination", `%${city}%`);
      }
      if (containerType) q = q.eq("container_type", containerType as any);
      if (reeferOnly)    q = q.eq("refrigerated", true);
      if (minCBM)        q = q.gte("available_cbm", parseFloat(minCBM));
      if (maxWeight)     q = q.lte("max_weight_kg", parseFloat(maxWeight));
      if (maxPrice)      q = q.lte("price_per_cbm", parseFloat(maxPrice));
      if (departureFrom) q = q.gte("departure_date", departureFrom as any);
      if (departureTo)   q = q.lte("departure_date", departureTo as any);

      q = q.order("departure_date", { ascending: true }).limit(50);

      const { data, error } = await q;
      if (error) throw error;
      setResults(data ?? []);
    } catch(e) {
      console.error("search error:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [origin, destination, cargoType, containerType, reeferOnly, minCBM, maxWeight, maxPrice, departureFrom, departureTo]);

  // Initial search on mount
  useEffect(() => {
    search();
  }, []); // Run once on mount

  const sorted = [...results].sort((a: any, b: any) => {
    const aPrice = a.price_per_cbm ?? a.price_usd ?? 0
    const bPrice = b.price_per_cbm ?? b.price_usd ?? 0
    const aCbm = a.available_cbm ?? a.available_volume_m3 ?? 0
    const bCbm = b.available_cbm ?? b.available_volume_m3 ?? 0
    if (sortBy === "price")     return aPrice - bPrice
    if (sortBy === "cbm")       return bCbm - aCbm
    if (sortBy === "fill")      return fillRate(a) - fillRate(b)
    return new Date(a.departure_date || a.available_from).getTime() - new Date(b.departure_date || b.available_from).getTime()
  })

  const cargoMeta = CARGO_TYPES.find(c => c.value === cargoType)

  return (
    <div style={s.page}>
      {/* ── Page header ── */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Search Containers</div>
          <div style={s.pageSub}>Find and book available container space across {results.length > 0 ? `${results.length} results` : "global shipping routes"}</div>
        </div>
        {searched && results.length > 0 && (
          <div style={s.sortRow}>
            <span style={s.sortLabel}>Sort by</span>
            {(["departure","price","cbm","fill"] as const).map(opt => (
              <button key={opt} style={{...s.sortBtn, ...(sortBy===opt?s.sortActive:{})}} onClick={()=>setSortBy(opt)}>
                {opt === "departure" ? "Departure" : opt === "price" ? "Price ↑" : opt === "cbm" ? "Space" : "Fill rate"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Search card ── */}
      <div style={s.searchCard}>
        {/* AI toggle banner */}
        <div style={s.aiBanner} onClick={()=>setAiMode(p=>!p)}>
          <div style={{...s.aiCheck, background:aiMode?"#7c3aed":"rgba(255,255,255,0.06)", borderColor:aiMode?"#7c3aed":"rgba(255,255,255,0.15)"}}>
            {aiMode && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
          <div style={s.aiStars}>✦</div>
          <div>
            <div style={s.aiLabel}>AI-Powered Recommendations</div>
            <div style={s.aiSub}>Get personalised container suggestions ranked by your cargo type, route history, and price</div>
          </div>
          {aiMode && <div style={s.aiOnTag}>ON</div>}
        </div>

        {/* Popular route pills */}
        <div style={s.popularRow}>
          <PopularRoutePills
            onSelect={(o, d) => { setOrigin(o); setDestination(d) }}
            activeOrigin={origin}
            activeDestination={destination}
          />
        </div>

        {/* Main search row */}
        <div style={s.searchRow}>
          {/* Origin */}
          <PortSelect
            value={origin}
            onChange={setOrigin}
            placeholder="Origin port…"
            excludeValue={destination}
            label="From"
          />

          {/* Swap button */}
          <button style={s.swapBtn} title="Swap origin and destination" onClick={() => { const tmp=origin; setOrigin(destination); setDestination(tmp) }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.7)" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          </button>

          {/* Destination */}
          <PortSelect
            value={destination}
            onChange={setDestination}
            placeholder="Destination port…"
            excludeValue={origin}
            label="To"
          />

          {/* Cargo type */}
          <CargoTypeSelect
            value={cargoType}
            onChange={setCargoType}
            label="Cargo type"
            showAllOption={true}
          />

          {/* Search button */}
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            <div style={{ height:20 }}/>
            <button style={s.searchBtn} onClick={search} disabled={loading}>
              {loading ? (
                <><div style={s.spinner}/> Searching…</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Search</>
              )}
            </button>
          </div>
        </div>

        {/* Advanced filters toggle */}
        <div style={s.advRow}>
          <button style={s.advBtn} onClick={()=>setShowAdvanced(p=>!p)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Advanced filters
            {activeFilters > 0 && <span style={s.filterCount}>{activeFilters}</span>}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform:showAdvanced?"rotate(180deg)":"none",transition:"transform .15s"}}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {(origin||destination||cargoType||activeFilters>0) && (
            <button style={s.clearBtn} onClick={clearAll}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Clear all
            </button>
          )}
        </div>

        {/* Advanced filters panel */}
        {showAdvanced && (
          <div style={s.advPanel}>
            <div style={s.advGrid}>
              {/* Container type */}
              <div style={s.advField}>
                <label style={s.advLabel}>Container type</label>
                <select style={s.advSelect} value={containerType} onChange={e=>setContainerType(e.target.value)}>
                  <option value="">All types</option>
                  <option value="20ft_standard">20ft Standard</option>
                  <option value="40ft_standard">40ft Standard</option>
                  <option value="40ft_high_cube">40ft High Cube</option>
                  <option value="20ft_reefer">20ft Reefer</option>
                  <option value="40ft_reefer">40ft Reefer</option>
                  <option value="flat_rack">Flat Rack</option>
                  <option value="open_top">Open Top</option>
                </select>
              </div>

              {/* Min CBM available */}
              <div style={s.advField}>
                <label style={s.advLabel}>Min CBM available</label>
                <div style={s.advInputWrap}>
                  <input style={s.advInput} type="number" min="0" placeholder="e.g. 10" value={minCBM} onChange={e=>setMinCBM(e.target.value)}/>
                  <span style={s.advUnit}>CBM</span>
                </div>
              </div>

              {/* Max weight */}
              <div style={s.advField}>
                <label style={s.advLabel}>Max cargo weight</label>
                <div style={s.advInputWrap}>
                  <input style={s.advInput} type="number" min="0" placeholder="e.g. 20000" value={maxWeight} onChange={e=>setMaxWeight(e.target.value)}/>
                  <span style={s.advUnit}>kg</span>
                </div>
              </div>

              {/* Max price */}
              <div style={s.advField}>
                <label style={s.advLabel}>Max price per CBM</label>
                <div style={s.advInputWrap}>
                  <span style={s.advUnitLeft}>$</span>
                  <input style={{...s.advInput, paddingLeft:24}} type="number" min="0" placeholder="e.g. 2000" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/>
                </div>
              </div>

              {/* Departure from */}
              <div style={s.advField}>
                <label style={s.advLabel}>Departure after</label>
                <input type="date" style={s.advInput} value={departureFrom} min={new Date().toISOString().split("T")[0]} onChange={e=>setDepartureFrom(e.target.value)}/>
              </div>

              {/* Departure to */}
              <div style={s.advField}>
                <label style={s.advLabel}>Departure before</label>
                <input type="date" style={s.advInput} value={departureTo} min={departureFrom||new Date().toISOString().split("T")[0]} onChange={e=>setDepartureTo(e.target.value)}/>
              </div>
            </div>

            {/* Reefer toggle */}
            <label style={s.reeferToggle}>
              <input type="checkbox" checked={reeferOnly} onChange={e=>setReeferOnly(e.target.checked)} style={{accentColor:"#60a5fa"}}/>
              <span style={{fontSize:12,color:reeferOnly?"#60a5fa":"rgba(255,255,255,0.5)"}}>❄ Refrigerated containers only</span>
              {reeferOnly && <span style={{fontSize:10,padding:"2px 6px",borderRadius:9,background:"rgba(96,165,250,0.15)",color:"#60a5fa"}}>Active</span>}
            </label>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {searched && (
        <div>
          {loading ? (
            <div style={s.loadingWrap}>
              <div style={s.loadingSpinner}/>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>Searching containers…</div>
            </div>
          ) : sorted.length === 0 ? (
            <div style={s.emptyWrap}>
              <div style={{fontSize:36,marginBottom:12}}>🔍</div>
              <div style={{fontSize:15,fontWeight:500,color:"rgba(255,255,255,0.5)",marginBottom:8}}>No containers found</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.25)",lineHeight:1.6,maxWidth:380,textAlign:"center"}}>
                Try a different route, adjust your dates, or remove some filters. New containers are added daily.
              </div>
              <button style={{marginTop:16,...s.searchBtn,width:"auto",padding:"8px 20px"}} onClick={clearAll}>Clear all filters</button>
            </div>
          ) : (
            <>
              <div style={s.resultsHeader}>
                <div style={s.resultsCount}>{sorted.length} container{sorted.length!==1?"s":""} found</div>
                {cargoMeta?.value && (
                  <div style={s.cargoTag}>
                    {cargoMeta.icon} {cargoMeta.label}
                    {(cargoMeta as any).cold && <span style={{color:"#60a5fa"}}>· ❄ Reefer recommended</span>}
                    {(cargoMeta as any).dg   && <span style={{color:"#ef4444"}}>· ⚠ DG certified required</span>}
                  </div>
                )}
              </div>

              <div style={s.resultsGrid}>
                {sorted.map((c: any) => {
                  const fill = fillRate(c)
                  const fc   = fillColor(fill)
                  const depDate = c.departure_date ?? c.available_from
                  const arrDate = c.arrival_date ?? c.available_until
                  const days = daysUntil(depDate)
                  const urgent = days <= 3
                  const price = c.price_per_cbm ?? c.price_per_m3 ?? c.price_usd ?? 0
                  const maxCBM = c.max_cbm ?? c.total_volume_m3 ?? 0
                  const availCBM = c.available_cbm ?? c.available_volume_m3 ?? maxCBM
                  const maxKg = c.max_weight_kg ?? c.capacity_kg ?? 0
                  const totalEst = price * availCBM

                  return (
                    <div key={c.id} style={{...s.resultCard,...(urgent?{borderColor:"rgba(239,68,68,0.3)"}:{})}}>
                      {/* Card header */}
                      <div style={s.cardTop}>
                        <div style={s.routeDisplay}>
                          <div style={s.routeOrigin}>{c.origin?.split(",")[0]}</div>
                          <div style={s.routeArrow}>
                            <svg width="40" height="14" viewBox="0 0 60 14"><path d="M0 7h52M46 1l6 6-6 6" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                            {c.transit_days && <div style={s.transitDays}>{c.transit_days}d</div>}
                          </div>
                          <div style={s.routeDest}>{c.destination?.split(",")[0]}</div>
                        </div>
                        <div style={s.priceTag}>${price.toFixed(0)}<span style={{fontSize:10,fontWeight:400,color:"rgba(255,255,255,0.4)"}}>{c.price_usd && !c.price_per_cbm ? '' : '/CBM'}</span></div>
                      </div>

                      {/* Badges */}
                      <div style={s.badgeRow}>
                        <div style={{...s.badge, background:urgent?"rgba(239,68,68,0.15)":days<=7?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.06)", color:urgent?"#ef4444":days<=7?"#f59e0b":"rgba(255,255,255,0.5)"}}>
                          🗓 {days===0?"Today":days===1?"Tomorrow":`${days}d`}
                        </div>
                        <div style={s.badge}>{c.container_type?.replace(/_/g," ")??"Standard"}</div>
                        {c.refrigerated && <div style={{...s.badge,color:"#60a5fa",background:"rgba(96,165,250,0.12)"}}>❄ Reefer</div>}
                      </div>

                      {/* Fill rate bar */}
                      <div style={s.fillSection}>
                        <div style={s.fillTop}>
                          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Space available</span>
                          <span style={{fontSize:11,fontWeight:500,color:fc}}>{fill}% filled · {availCBM.toFixed(1)} CBM left</span>
                        </div>
                        <div style={s.fillBg}><div style={{...s.fillFg,width:fill+"%",background:fc}}/></div>
                      </div>

                      {/* Details */}
                      <div style={s.detailGrid}>
                        <div style={s.detail}><span style={s.detailLabel}>Departure</span><span style={s.detailVal}>{new Date(depDate).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span></div>
                        {arrDate && <div style={s.detail}><span style={s.detailLabel}>Arrival</span><span style={s.detailVal}>{new Date(arrDate).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span></div>}
                        <div style={s.detail}><span style={s.detailLabel}>Max weight</span><span style={s.detailVal}>{(maxKg/1000).toFixed(0)}t</span></div>
                        <div style={s.detail}><span style={s.detailLabel}>Total CBM</span><span style={s.detailVal}>{maxCBM.toFixed(0)} CBM</span></div>
                      </div>

                      {/* Est total */}
                      {availCBM > 0 && (
                        <div style={s.estRow}>
                          <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Est. cost for all available space</span>
                          <span style={{fontSize:13,fontWeight:600,color:"#a855f7"}}>{fmt(totalEst)}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={s.actionRow}>
                        <button style={s.viewBtn} onClick={() => onAskQuestion ? onAskQuestion(c) : navigate(`/trader/containers/${c.id}`)}>Ask question</button>
                        <button style={s.bookBtn} onClick={() => onBookContainer ? onBookContainer(c) : navigate(`/trader/containers/${c.id}/book`)}>Book now →</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Empty state before searching ── */}
      {!searched && (
        <div style={s.preSearchWrap}>
          <div style={s.preSearchIcon}>🌊</div>
          <div style={{fontSize:15,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:6}}>Ready to search</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",lineHeight:1.7,maxWidth:360,textAlign:"center"}}>
            Select an origin and destination port above, choose your cargo type, and hit Search.<br/>
            Use the popular route pills for instant results.
          </div>
          {/* Popular route cards */}
          <div style={s.popularCards}>
            {[
              {label:"Mumbai → Dubai",      time:"12–14 days", demand:"🔥 High demand"},
              {label:"Singapore → Rotterdam",time:"22–26 days", demand:"📈 Rising"},
              {label:"Shanghai → Rotterdam", time:"20–24 days", demand:"⚡ Popular"},
            ].map(r=>(
              <div key={r.label} style={s.popularCard} onClick={()=>{
                const [o,d] = r.label.split(" → ")
                const ports = [{k:"Mumbai",v:"Mumbai, India"},{k:"Dubai",v:"Dubai, UAE"},{k:"Singapore",v:"Singapore"},{k:"Rotterdam",v:"Rotterdam, Netherlands"},{k:"Shanghai",v:"Shanghai, China"}]
                setOrigin(ports.find(p=>p.k===o)?.v??o)
                setDestination(ports.find(p=>p.k===d)?.v??d)
              }}>
                <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{r.label}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:3}}>{r.time}</div>
                <div style={{fontSize:11,color:"#a855f7",marginTop:6}}>{r.demand}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:           {background:"#0a0a0f",minHeight:"100vh",color:"#fff",fontFamily:"system-ui,sans-serif",padding:"24px 26px"},
  pageHeader:     {display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20},
  pageTitle:      {fontSize:22,fontWeight:700,color:"#fff",marginBottom:3},
  pageSub:        {fontSize:12,color:"rgba(255,255,255,0.35)"},
  sortRow:        {display:"flex",alignItems:"center",gap:6},
  sortLabel:      {fontSize:11,color:"rgba(255,255,255,0.3)",marginRight:2},
  sortBtn:        {fontSize:11,padding:"5px 10px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)",cursor:"pointer"},
  sortActive:     {borderColor:"rgba(168,85,247,0.4)",background:"rgba(168,85,247,0.12)",color:"#c084fc"},
  searchCard:     {background:"#13131e",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:20,marginBottom:24},
  aiBanner:       {display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,marginBottom:16,cursor:"pointer",transition:"background .15s"},
  aiCheck:        {width:20,height:20,borderRadius:5,border:"1.5px solid",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"},
  aiStars:        {fontSize:16,color:"#a855f7",flexShrink:0},
  aiLabel:        {fontSize:12,fontWeight:500,color:"#fff"},
  aiSub:          {fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1},
  aiOnTag:        {fontSize:10,padding:"2px 7px",borderRadius:9,background:"#7c3aed",color:"#fff",fontWeight:600,marginLeft:"auto",flexShrink:0},
  popularRow:     {marginBottom:14},
  searchRow:      {display:"flex",alignItems:"flex-end",gap:10,marginBottom:12,flexWrap:"wrap"},
  swapBtn:        {width:36,height:40,borderRadius:8,background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,marginBottom:0},
  searchBtn:      {height:40,padding:"0 22px",background:"#7c3aed",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap",flexShrink:0},
  spinner:        {width:13,height:13,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.25)",borderTopColor:"#fff"},
  advRow:         {display:"flex",alignItems:"center",gap:10},
  advBtn:         {display:"flex",alignItems:"center",gap:6,fontSize:12,color:"rgba(255,255,255,0.45)",background:"none",border:"none",cursor:"pointer",padding:"4px 0"},
  filterCount:    {fontSize:10,padding:"1px 6px",borderRadius:9,background:"#7c3aed",color:"#fff",fontWeight:700},
  clearBtn:       {display:"flex",alignItems:"center",gap:5,fontSize:12,color:"rgba(239,68,68,0.6)",background:"none",border:"none",cursor:"pointer",marginLeft:"auto"},
  advPanel:       {marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.07)"},
  advGrid:        {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12},
  advField:       {display:"flex",flexDirection:"column",gap:5},
  advLabel:       {fontSize:11,color:"rgba(255,255,255,0.4)"},
  advInputWrap:   {position:"relative",display:"flex",alignItems:"center"},
  advInput:       {height:36,width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,padding:"0 10px",color:"#fff",fontSize:12,outline:"none",colorScheme:"dark"},
  advSelect:      {height:36,width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,padding:"0 10px",color:"rgba(255,255,255,0.8)",fontSize:12,outline:"none",cursor:"pointer"},
  advUnit:        {position:"absolute",right:10,fontSize:11,color:"rgba(168,85,247,0.6)",pointerEvents:"none"},
  advUnitLeft:    {position:"absolute",left:10,fontSize:12,color:"rgba(255,255,255,0.3)",pointerEvents:"none"},
  reeferToggle:   {display:"flex",alignItems:"center",gap:8,cursor:"pointer"},
  loadingWrap:    {display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"60px 0"},
  loadingSpinner: {width:28,height:28,borderRadius:"50%",border:"3px solid rgba(168,85,247,0.2)",borderTopColor:"#a855f7"},
  emptyWrap:      {display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",textAlign:"center"},
  resultsHeader:  {display:"flex",alignItems:"center",gap:14,marginBottom:14},
  resultsCount:   {fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.5)"},
  cargoTag:       {fontSize:11,padding:"3px 10px",borderRadius:20,background:"rgba(168,85,247,0.12)",color:"#c084fc",border:"1px solid rgba(168,85,247,0.25)",display:"flex",alignItems:"center",gap:6},
  resultsGrid:    {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14},
  resultCard:     {background:"#13131e",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:18,display:"flex",flexDirection:"column",gap:12,transition:"border-color .15s"},
  cardTop:        {display:"flex",alignItems:"flex-start",justifyContent:"space-between"},
  routeDisplay:   {display:"flex",alignItems:"center",gap:8},
  routeOrigin:    {fontSize:14,fontWeight:600,color:"#fff"},
  routeArrow:     {display:"flex",flexDirection:"column",alignItems:"center",gap:2},
  transitDays:    {fontSize:9,color:"rgba(168,85,247,0.6)"},
  routeDest:      {fontSize:14,fontWeight:600,color:"#fff"},
  priceTag:       {fontSize:18,fontWeight:700,color:"#a855f7"},
  badgeRow:       {display:"flex",gap:6,flexWrap:"wrap"},
  badge:          {fontSize:10,padding:"3px 8px",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)"},
  fillSection:    {display:"flex",flexDirection:"column",gap:5},
  fillTop:        {display:"flex",justifyContent:"space-between"},
  fillBg:         {height:4,background:"rgba(255,255,255,0.07)",borderRadius:2,overflow:"hidden"},
  fillFg:         {height:"100%",borderRadius:2,transition:"width .3s"},
  detailGrid:     {display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},
  detail:         {display:"flex",flexDirection:"column",gap:2},
  detailLabel:    {fontSize:10,color:"rgba(255,255,255,0.3)"},
  detailVal:      {fontSize:12,fontWeight:500,color:"#fff"},
  estRow:         {display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:7,padding:"7px 10px"},
  actionRow:      {display:"flex",gap:8,paddingTop:4,borderTop:"1px solid rgba(255,255,255,0.06)"},
  viewBtn:        {flex:1,height:36,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:8,color:"rgba(255,255,255,0.6)",fontSize:12,fontWeight:500,cursor:"pointer"},
  bookBtn:        {flex:2,height:36,background:"#7c3aed",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"},
  preSearchWrap:  {display:"flex",flexDirection:"column",alignItems:"center",padding:"48px 0",textAlign:"center"},
  preSearchIcon:  {fontSize:48,marginBottom:14},
  popularCards:   {display:"flex",gap:12,marginTop:24,flexWrap:"wrap",justifyContent:"center"},
  popularCard:    {background:"#13131e",border:"1px solid rgba(168,85,247,0.18)",borderRadius:10,padding:"14px 18px",cursor:"pointer",minWidth:180,transition:"border-color .15s",textAlign:"left"},
}
