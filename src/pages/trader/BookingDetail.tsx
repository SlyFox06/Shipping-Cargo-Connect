// src/pages/trader/BookingDetail.tsx
//
// Full booking detail page with 3 tabs:
//   Details  — status timeline, space utilisation, cargo info, price breakdown
//   Tracking — 3-leg journey with live status, weather, port congestion
//   Documents — required doc list + upload + provider-reviewed status
//
// ROUTER:
//   <Route path="/dashboard/trader/bookings/:id" element={<BookingDetail />} />

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { fetchFullPortData, conditionEmoji, shippingRisk, type PortWeather } from "@/services/weatherService"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: string; status: string; created_at: string
  origin: string; destination: string
  departure_date: string; arrival_date?: string
  cargo_type: string; cargo_description?: string
  weight_kg: number; cbm: number; pieces?: number
  total_price: number; incoterms?: string
  fragile?: boolean; dangerous?: boolean; perishable?: boolean
  first_mile_type?: string; last_mile_type?: string
  pickup_address?: string; delivery_address?: string
  special_instructions?: string
  container_id?: string; provider_id?: string
  uploaded_documents?: any[]
  doc_review_status?: Record<string, { status: string; note: string }>
  revision_note?: string
  container?: { container_type: string; max_cbm: number; refrigerated: boolean; price_per_cbm: number }
}

type LegStatus = "pending" | "active" | "at_port" | "customs" | "delayed" | "done"

const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  pending:            { label:"Pending",          color:"#f59e0b", bg:"rgba(245,158,11,0.15)"  },
  docs_pending:       { label:"Docs pending",     color:"#f59e0b", bg:"rgba(245,158,11,0.15)"  },
  docs_submitted:     { label:"Under review",     color:"#a855f7", bg:"rgba(168,85,247,0.15)"  },
  docs_reviewing:     { label:"Reviewing",        color:"#3b82f6", bg:"rgba(59,130,246,0.15)"  },
  revision_requested: { label:"Revision needed",  color:"#ef4444", bg:"rgba(239,68,68,0.12)"   },
  confirmed:          { label:"Confirmed",        color:"#10b981", bg:"rgba(16,185,129,0.15)"  },
  in_transit:         { label:"In Transit",       color:"#3b82f6", bg:"rgba(59,130,246,0.15)"  },
  delivered:          { label:"Delivered",        color:"#10b981", bg:"rgba(16,185,129,0.15)"  },
  cancelled:          { label:"Cancelled",        color:"#6b7280", bg:"rgba(107,114,128,0.12)" },
}

const LEG_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label:"Pending",    color:"rgba(255,255,255,0.4)", bg:"rgba(255,255,255,0.07)", icon:"○" },
  active:   { label:"In Transit", color:"#3b82f6",               bg:"rgba(59,130,246,0.18)",  icon:"▶" },
  at_port:  { label:"At Port",    color:"#f59e0b",               bg:"rgba(245,158,11,0.18)",  icon:"⚓" },
  customs:  { label:"Customs",    color:"#c084fc",               bg:"rgba(168,85,247,0.18)",  icon:"🛃" },
  delayed:  { label:"Delayed",    color:"#ef4444",               bg:"rgba(239,68,68,0.15)",   icon:"⚠" },
  done:     { label:"Completed",  color:"#10b981",               bg:"rgba(16,185,129,0.18)",  icon:"✓" },
}

const fmt   = (n: number) => "$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtD  = (d: string) => new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})
const fmtDT = (d: string) => new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime()-Date.now())/86400000)
const congColor = (l: string) => l==="high"?"#ef4444":l==="medium"?"#f59e0b":"#10b981"

function Countdown({ target }: { target: string }) {
  const [,tick] = useState(0)
  useEffect(()=>{ const t=setInterval(()=>tick(n=>n+1),1000); return()=>clearInterval(t) },[])
  const diff = new Date(target).getTime()-Date.now()
  if(diff<=0) return <span style={{color:"#10b981"}}>Arrived</span>
  const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),sec=Math.floor((diff%60000)/1000)
  return <span style={{fontVariantNumeric:"tabular-nums"}}>{d>0?`${d}d `:""}{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(sec).padStart(2,"0")}</span>
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BookingDetail() {
  const { id }     = useParams<{id:string}>()
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [booking,   setBooking]   = useState<Booking|null>(null)
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState<"details"|"tracking"|"documents">("details")
  const [legStates, setLegStates] = useState<Record<number,{status:LegStatus;startedAt?:string;completedAt?:string}>>({1:{status:"pending"},2:{status:"pending"},3:{status:"pending"}})
  const [weather,   setWeather]   = useState<Record<string, PortWeather>>({})
  const [updating,  setUpdating]  = useState<number|null>(null)
  const [uploading, setUploading] = useState<string|null>(null)
  const [docType,   setDocType]   = useState("")
  const [cancelDlg, setCancelDlg] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadBooking = useCallback(async()=>{
    if(!id) return
    setLoading(true)
    try {
      const {data} = await supabase
        .from("bookings")
        .select("*,container:containers(container_type,max_cbm,refrigerated,price_per_cbm)")
        .eq("id",id)
        .single()
      if(data) setBooking(data as any)
      // Load leg statuses
      const {data:legs} = await supabase.from("shipment_legs" as any).select("*").eq("booking_id",id)
      if(legs?.length) {
        const map:any={}
        legs.forEach((l:any)=>{ map[l.leg]={status:l.status,startedAt:l.started_at,completedAt:l.completed_at} })
        setLegStates(map)
      }
    } catch(e){console.error(e)} finally{setLoading(false)}
  },[id])

  useEffect(()=>{loadBooking()},[loadBooking])

  // Fetch weather once booking loads
  useEffect(()=>{
    if(!booking) return
    const cities = [booking.origin?.split(",")[0], booking.destination?.split(",")[0]].filter(Boolean) as string[]
    cities.forEach(async city=>{
      const data = await fetchFullPortData(city)
      if(data) setWeather(p=>({...p,[city]:data}))
    })
  },[booking?.origin,booking?.destination])

  const updateLeg = async(legN:number,newStatus:LegStatus)=>{
    if(!id) return
    setUpdating(legN)
    const now=new Date().toISOString()
    const update:any={booking_id:id,leg:legN,status:newStatus}
    if(newStatus==="active"&&!legStates[legN]?.startedAt) update.started_at=now
    if(newStatus==="done") update.completed_at=now
    try {
      await supabase.from("shipment_legs" as any).upsert(update,{onConflict:"booking_id,leg"})
      if(newStatus==="done"&&legN===3) await supabase.from("bookings").update({status:"delivered"} as any).eq("id",id)
      await loadBooking()
    } catch {
      // Fix: both spreads need the ... operator
      const extra = {
        ...(update.started_at ? {startedAt:update.started_at} : {}),
        ...(newStatus==="done" ? {completedAt:now} : {}),
      }
      setLegStates(p=>({...p,[legN]:{...p[legN],status:newStatus,...extra}}))
    } finally{setUpdating(null)}
  }

  const cancelBooking = async()=>{
    if(!id) return
    await supabase.from("bookings").update({status:"cancelled"} as any).eq("id",id)
    await loadBooking(); setCancelDlg(false)
  }

  const uploadDocument = async(file:File)=>{
    if(!file||!docType||!id||!user?.id) return
    setUploading(docType)
    try {
      const ext=file.name.split(".").pop()
      const path=`${user.id}/${id}/${docType.replace(/\s+/g,"_")}_${Date.now()}.${ext}`
      await supabase.storage.from("booking-documents").upload(path,file)
      const existing = booking?.uploaded_documents??[]
      await supabase.from("bookings").update({
        uploaded_documents:[...existing,{docId:docType,docName:docType,fileName:file.name,filePath:path,fileSize:file.size,uploadedAt:new Date().toISOString()}]
      } as any).eq("id",id)
      await loadBooking(); setDocType("")
    }catch(e){console.error(e)} finally{setUploading(null)}
  }

  const getSignedUrl = async(path:string)=>{
    const {data} = await supabase.storage.from("booking-documents").createSignedUrl(path,3600)
    if(data?.signedUrl) window.open(data.signedUrl,"_blank")
  }

  if(loading) return <div style={{background:"#0a0a0f",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.3)",fontSize:13}}>Loading booking…</div>
  if(!booking) return <div style={{background:"#0a0a0f",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.3)",fontSize:13}}>Booking not found.</div>

  const sm = STATUS_DISPLAY[booking.status]??STATUS_DISPLAY.pending
  const completedLegs = Object.values(legStates).filter(l=>l.status==="done").length
  const hasActiveleg  = Object.values(legStates).some(l=>["active","at_port","customs","delayed"].includes(l.status))
  const progressPct   = completedLegs===3?100:completedLegs*33+(hasActiveleg?17:0)
  const spaceUsedPct  = booking.container?.max_cbm ? Math.round((booking.cbm/booking.container.max_cbm)*100) : 0
  const uploadedDocs  = booking.uploaded_documents??[]
  const reviewStatus  = booking.doc_review_status??{}
  const originCity    = booking.origin?.split(",")[0]
  const destCity      = booking.destination?.split(",")[0]

  const LEGS = [
    { n:1, icon:"🚛", title:"Leg 1: Pickup from origin address",   sub: booking.first_mile_type==="provider_pickup"?"Provider collects from warehouse":"Self drop-off at port", ports:[{city:originCity,role:"Origin"}] },
    { n:2, icon:"🚢", title:"Leg 2: Port-to-port vessel shipping",  sub:`${originCity} → ${destCity}`, ports:[{city:originCity,role:"Origin"},{city:destCity,role:"Destination"}] },
    { n:3, icon:"📦", title:"Leg 3: Final delivery to destination", sub: booking.last_mile_type==="provider_delivery"?"Provider delivers to your door":"Self-pickup at port", ports:[{city:destCity,role:"Destination"}] },
  ]

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"#fff",fontFamily:"system-ui,sans-serif"}}>

      {/* ── Top header ── */}
      <div style={{background:"#0f0f18",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"18px 28px",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.45)",fontSize:12,padding:"6px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}} onClick={()=>navigate("/dashboard/trader/bookings")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Bookings
          </button>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:20,fontWeight:700,color:"#fff"}}>BK-{booking.id.substring(0,8).toUpperCase()}</div>
              <div style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:10,background:sm.bg,color:sm.color}}>{sm.label}</div>
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>Created {fmtD(booking.created_at)} · {booking.origin?.split(",")[0]} → {booking.destination?.split(",")[0]}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button style={{display:"flex",alignItems:"center",gap:6,fontSize:12,padding:"8px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.6)",cursor:"pointer"}} onClick={()=>navigate(`/dashboard/trader/messages?booking=${booking.id}`)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Message Provider
          </button>
          {!["confirmed","delivered","cancelled"].includes(booking.status)&&(
            <button style={{display:"flex",alignItems:"center",gap:6,fontSize:12,padding:"8px 16px",borderRadius:8,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.08)",color:"#ef4444",cursor:"pointer"}} onClick={()=>setCancelDlg(true)}>Cancel</button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"#0f0f18",padding:"0 28px"}}>
        {(["details","tracking","documents"] as const).map(t=>(
          <button key={t} style={{fontSize:13,fontWeight:tab===t?500:400,padding:"14px 20px",border:"none",background:"none",color:tab===t?"#fff":"rgba(255,255,255,0.4)",cursor:"pointer",borderBottom:tab===t?"2px solid #a855f7":"2px solid transparent",textTransform:"capitalize"}} onClick={()=>setTab(t)}>
            {t}
            {t==="documents"&&uploadedDocs.length>0&&<span style={{marginLeft:6,fontSize:10,background:"rgba(168,85,247,0.2)",color:"#a855f7",borderRadius:9,padding:"1px 6px",fontWeight:600}}>{uploadedDocs.length}</span>}
          </button>
        ))}
      </div>

      <div style={{padding:"24px 28px",maxWidth:960,margin:"0 auto",display:"flex",flexDirection:"column",gap:16}}>

        {/* ════════ DETAILS TAB ════════ */}
        {tab==="details"&&(
          <>
            {/* Status timeline */}
            <div style={c.card}>
              <div style={c.cardTitle}>Booking status</div>
              <div style={{display:"flex",alignItems:"center",gap:0,marginTop:6}}>
                {["Pending","Confirmed","In Transit","Delivered"].map((label,i)=>{
                  const statuses=[["pending","docs_pending","docs_submitted","docs_reviewing","revision_requested"],["confirmed"],["in_transit"],["delivered"]]
                  const active = statuses[i].includes(booking.status)
                  const done   = i < statuses.findIndex(ss=>ss.includes(booking.status))
                  const isLast = i===3
                  return(
                    <div key={label} style={{display:"flex",alignItems:"center",flex:isLast?"none":1}}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                        <div style={{width:38,height:38,borderRadius:"50%",border:`2px solid ${done||active?"#a855f7":"rgba(255,255,255,0.1)"}`,background:done?"#7c3aed":active?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {done
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            : active
                              ? <div style={{width:10,height:10,borderRadius:"50%",background:"#a855f7"}}/>
                              : <div style={{width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,0.15)"}}/>
                          }
                        </div>
                        <div style={{fontSize:11,color:done||active?"#c084fc":"rgba(255,255,255,0.3)",fontWeight:active?500:400,whiteSpace:"nowrap"}}>{label}</div>
                      </div>
                      {!isLast&&<div style={{flex:1,height:2,background:done?"#7c3aed":"rgba(255,255,255,0.08)",margin:"0 4px 18px"}}/>}
                    </div>
                  )
                })}
              </div>
              {booking.status==="revision_requested"&&booking.revision_note&&(
                <div style={{display:"flex",gap:8,alignItems:"flex-start",background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"10px 14px",marginTop:12}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{flexShrink:0,marginTop:1}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
                  <div>
                    <div style={{fontSize:11,fontWeight:500,color:"#ef4444",marginBottom:2}}>Revision requested by provider</div>
                    <div style={{fontSize:11,color:"rgba(239,68,68,0.8)",lineHeight:1.5}}>{booking.revision_note}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Space utilisation */}
            <div style={c.card}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={c.cardTitle}>Your space utilisation</div>
                <div style={{fontSize:13,fontWeight:600,color:spaceUsedPct>85?"#ef4444":spaceUsedPct>60?"#f59e0b":"#10b981"}}>{spaceUsedPct.toFixed(1)}%</div>
              </div>
              <div style={{height:8,background:"rgba(255,255,255,0.07)",borderRadius:4,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",borderRadius:4,width:spaceUsedPct+"%",background:spaceUsedPct>85?"#ef4444":spaceUsedPct>60?"#f59e0b":"#a855f7",transition:"width .5s ease"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,0.35)"}}>
                <span>Your space: {booking.cbm?.toFixed(2)} CBM</span>
                <span>Shared container — {spaceUsedPct.toFixed(1)}% of total space</span>
                <span>Total: {booking.container?.max_cbm?.toFixed(2)||"—"} CBM</span>
              </div>
            </div>

            {/* Cargo details */}
            <div style={c.card}>
              <div style={c.cardTitle}>Cargo details</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:10}}>
                {[
                  {l:"Container",  v:booking.container?.container_type?.replace(/_/g," ")??"—"},
                  {l:"Route",      v:`${originCity} → ${destCity}`},
                  {l:"Cargo type", v:booking.cargo_type??"—"},
                  {l:"Weight",     v:`${booking.weight_kg?.toLocaleString()} kg`},
                  {l:"Volume",     v:`${booking.cbm} CBM`},
                  {l:"Pieces",     v:booking.pieces?String(booking.pieces):"—"},
                  {l:"Incoterms",  v:booking.incoterms??"—"},
                  {l:"Departure",  v:booking.departure_date?fmtD(booking.departure_date):"—"},
                  {l:"Arrival",    v:booking.arrival_date?fmtD(booking.arrival_date):"—"},
                  ...(booking.fragile   ?[{l:"Handling",v:"Fragile ⚠"}]  :[]),
                  ...(booking.dangerous ?[{l:"Class",   v:"Dangerous goods ⚠"}]:[]),
                  ...(booking.perishable?[{l:"Type",    v:"Perishable"}]  :[]),
                ].map((r,i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3,textTransform:"uppercase",letterSpacing:".06em"}}>{r.l}</div>
                    <div style={{fontSize:13,fontWeight:500,color:r.l==="Class"?"#ef4444":"#fff"}}>{r.v}</div>
                  </div>
                ))}
              </div>
              {booking.cargo_description&&(
                <div style={{marginTop:10,background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3}}>Description</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.5}}>{booking.cargo_description}</div>
                </div>
              )}
              {booking.special_instructions&&(
                <div style={{marginTop:8,background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:10,color:"#f59e0b",fontWeight:600,marginBottom:3}}>Special instructions</div>
                  <div style={{fontSize:12,color:"rgba(245,158,11,0.8)",lineHeight:1.5}}>{booking.special_instructions}</div>
                </div>
              )}
            </div>

            {/* Price breakdown */}
            <div style={c.card}>
              <div style={c.cardTitle}>Price breakdown</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,0.5)"}}>
                  <span>Freight ({booking.cbm} CBM × ${booking.container?.price_per_cbm??0}/CBM)</span>
                  <span>{fmt((booking.cbm??0)*(booking.container?.price_per_cbm??0))}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid rgba(168,85,247,0.2)",marginTop:4}}>
                  <span style={{fontSize:14,color:"rgba(255,255,255,0.7)"}}>Total</span>
                  <span style={{fontSize:22,fontWeight:700,color:"#a855f7"}}>{fmt(booking.total_price??0)}</span>
                </div>
              </div>
            </div>

            {/* Cancel */}
            {!["confirmed","delivered","cancelled"].includes(booking.status)&&(
              <button style={{width:"100%",height:44,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,color:"#ef4444",fontSize:13,fontWeight:500,cursor:"pointer"}} onClick={()=>setCancelDlg(true)}>
                Cancel booking
              </button>
            )}
            {booking.status==="cancelled"&&(
              <div style={{background:"rgba(107,114,128,0.08)",border:"1px solid rgba(107,114,128,0.2)",borderRadius:10,padding:"14px 18px",textAlign:"center"}}>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>This booking has been cancelled.</div>
              </div>
            )}
          </>
        )}

        {/* ════════ TRACKING TAB ════════ */}
        {tab==="tracking"&&(
          <>
            {/* Overall progress */}
            <div style={{...c.card,borderColor:"rgba(168,85,247,0.2)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div style={c.cardTitle}>Transport journey</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1}}>{originCity} → {destCity}</div>
                </div>
                {booking.arrival_date&&(
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:".07em"}}>ETA</div>
                    <div style={{fontSize:17,fontWeight:600,color:"#a855f7"}}><Countdown target={booking.arrival_date}/></div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{fmtD(booking.arrival_date)}</div>
                  </div>
                )}
              </div>
              <div style={{height:6,background:"rgba(255,255,255,0.07)",borderRadius:3,overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",borderRadius:3,width:progressPct+"%",background:"#a855f7",transition:"width .6s ease"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                {["Origin","Vessel","Customs","Destination"].map((label,i)=>{
                  const thr=[0,33,66,100][i]
                  const state=progressPct>=thr?"done":progressPct>=thr-5?"active":"idle"
                  return(
                    <div key={label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                      <div style={{width:11,height:11,borderRadius:"50%",border:"2px solid #0a0a0f",background:state==="done"?"#10b981":state==="active"?"#a855f7":"rgba(255,255,255,0.15)"}}/>
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.25)"}}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legs */}
            {LEGS.map((leg,idx)=>{
              const ls     = legStates[leg.n]??{status:"pending" as LegStatus}
              const lsMeta = LEG_STATUS_META[ls.status]
              const prevOk = idx===0||legStates[idx]?.status==="done"
              const canStart = prevOk && ls.status==="pending"
              const isInProg = ["active","at_port","customs","delayed"].includes(ls.status)
              const cardBorderColor = ls.status==="active"?"rgba(59,130,246,0.4)":ls.status==="at_port"?"rgba(245,158,11,0.4)":ls.status==="customs"?"rgba(168,85,247,0.4)":ls.status==="delayed"?"rgba(239,68,68,0.4)":ls.status==="done"?"rgba(16,185,129,0.3)":"rgba(255,255,255,0.07)"
              const cardBg = ls.status==="active"?"rgba(59,130,246,0.04)":ls.status==="at_port"?"rgba(245,158,11,0.04)":ls.status==="delayed"?"rgba(239,68,68,0.04)":ls.status==="done"?"rgba(16,185,129,0.03)":"rgba(255,255,255,0.02)"

              return(
                <div key={leg.n} style={{border:`1px solid ${cardBorderColor}`,background:cardBg,borderRadius:11,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px 10px"}}>
                    <div style={{position:"relative",flexShrink:0}}>
                      <div style={{width:40,height:40,borderRadius:10,background:ls.status==="done"?"rgba(16,185,129,0.18)":ls.status==="active"?"rgba(59,130,246,0.18)":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {ls.status==="done"
                          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          : <span style={{fontSize:18}}>{leg.icon}</span>
                        }
                      </div>
                      {ls.status==="active"&&<div style={{position:"absolute",inset:-5,borderRadius:"50%",border:"2px solid rgba(59,130,246,0.35)",pointerEvents:"none"}}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:"#fff",marginBottom:2}}>{leg.title}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{leg.sub}</div>
                      {ls.startedAt&&<div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>Started {fmtDT(ls.startedAt)}</div>}
                      {ls.completedAt&&<div style={{fontSize:10,color:"#10b981",marginTop:1}}>Completed {fmtDT(ls.completedAt)}</div>}
                    </div>
                    <div style={{fontSize:11,fontWeight:500,padding:"3px 9px",borderRadius:10,background:lsMeta.bg,color:lsMeta.color,flexShrink:0}}>{lsMeta.icon} {lsMeta.label}</div>
                  </div>

                  {/* Leg 2 dates */}
                  {leg.n===2&&booking.departure_date&&(
                    <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.04)",margin:"0 14px 10px",borderRadius:8,padding:"10px 14px"}}>
                      <div><div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:2}}>Departure</div><div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{originCity} · {fmtD(booking.departure_date)}</div></div>
                      <div style={{fontSize:16,color:"rgba(168,85,247,0.5)",flex:1,textAlign:"center"}}>→</div>
                      {booking.arrival_date&&(
                        <>
                          <div style={{textAlign:"right"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:2}}>Est. arrival</div><div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{destCity} · {fmtD(booking.arrival_date)}</div></div>
                          {daysUntil(booking.arrival_date)>0&&<div style={{marginLeft:8,textAlign:"right"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginBottom:2}}>ETA</div><div style={{fontSize:12,fontWeight:500,color:"#a855f7"}}><Countdown target={booking.arrival_date}/></div></div>}
                        </>
                      )}
                    </div>
                  )}

                  {/* Port weather */}
                  {leg.ports.filter(p=>weather[p.city]).length>0&&(
                    <div style={{display:"grid",gridTemplateColumns:leg.ports.length>1?"1fr 1fr":"1fr",gap:8,padding:"0 14px 10px"}}>
                      {leg.ports.filter(p=>weather[p.city]).map(p=>{
                        const w = weather[p.city]
                        const cur = w.current
                        const risk = shippingRisk(cur.wind_kph, w.marine?.wave_height_m)
                        const emoji = conditionEmoji(cur.condition, cur.is_day)
                        const congScore = Math.min(95, Math.round(20 + (cur.wind_kph / 80) * 60))
                        return(
                          <div key={p.city} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${congColor(risk) === "#ef4444" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`,borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>{p.role}</div>
                            <div style={{fontSize:12,fontWeight:500,color:"#fff",marginBottom:6}}>{cur.city || p.city}</div>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                              {cur.condition_icon
                                ? <img src={cur.condition_icon} alt={cur.condition} style={{width:28,height:28}}/>
                                : <span style={{fontSize:22}}>{emoji}</span>}
                              <div>
                                <div style={{fontSize:15,fontWeight:600,color:"#fff"}}>{cur.temp_c}°C <span style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:400}}>feels {cur.feels_like_c}°C</span></div>
                                <div style={{fontSize:10,color:"rgba(255,255,255,0.45)"}}>{cur.condition}</div>
                              </div>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:8}}>
                              {[
                                {l:"💨 Wind",  v:`${cur.wind_kph} km/h ${cur.wind_dir}`},
                                {l:"💧 Humidity", v:`${cur.humidity}%`},
                                {l:"👁 Visibility", v:`${cur.visibility_km} km`},
                                {l:"🌡 Pressure", v:`${cur.pressure_mb} hPa`},
                              ].map(row=>(
                                <div key={row.l} style={{background:"rgba(255,255,255,0.04)",borderRadius:5,padding:"4px 7px"}}>
                                  <div style={{fontSize:9,color:"rgba(255,255,255,0.35)"}}>{row.l}</div>
                                  <div style={{fontSize:10,fontWeight:500,color:"#fff"}}>{row.v}</div>
                                </div>
                              ))}
                            </div>
                            {w.marine&&(
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:8,paddingTop:6,borderTop:"1px solid rgba(59,130,246,0.15)"}}>
                                {[
                                  {l:"🌊 Wave",  v:`${w.marine.wave_height_m.toFixed(1)}m`},
                                  {l:"⏱ Period", v:`${w.marine.wave_period_s.toFixed(0)}s`},
                                  {l:"🌬 Wind",   v:`${(w.marine.wind_speed_ms*3.6).toFixed(0)} km/h`},
                                ].map(row=>(
                                  <div key={row.l} style={{background:"rgba(59,130,246,0.06)",borderRadius:5,padding:"4px 7px"}}>
                                    <div style={{fontSize:9,color:"rgba(255,255,255,0.35)"}}>{row.l}</div>
                                    <div style={{fontSize:10,fontWeight:500,color:"#3b82f6"}}>{row.v}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                              <span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>Port congestion risk</span>
                              <span style={{fontSize:10,color:congColor(risk),fontWeight:600,textTransform:"capitalize"}}>{risk}</span>
                            </div>
                            <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:2,overflow:"hidden"}}>
                              <div style={{height:"100%",borderRadius:2,width:congScore+"%",background:congColor(risk),transition:"width .5s"}}/>
                            </div>
                            {risk==="high"&&<div style={{fontSize:10,color:"#ef4444",marginTop:5}}>⚠ High wind / rough seas — possible delays</div>}
                            {risk==="medium"&&cur.wind_kph>25&&<div style={{fontSize:10,color:"#f59e0b",marginTop:5}}>⚠ Moderate conditions — monitor closely</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"0 14px 12px"}}>
                    {ls.status==="done"&&<div style={{fontSize:12,color:"#10b981",fontWeight:500,display:"flex",alignItems:"center",gap:5}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Leg {leg.n} completed</div>}
                    {ls.status==="pending"&&<LegBtn label={`▶ Start Leg ${leg.n}`} cls="start" disabled={!canStart||updating===leg.n} onClick={()=>updateLeg(leg.n,"active")}/>}
                    {isInProg&&(
                      <>
                        {ls.status!=="at_port"&&<LegBtn label="⚓ At port" cls="port" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"at_port")}/>}
                        {leg.n===2&&ls.status!=="customs"&&<LegBtn label="🛃 Customs" cls="customs" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"customs")}/>}
                        {ls.status!=="delayed"&&<LegBtn label="⚠ Delayed" cls="delayed" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"delayed")}/>}
                        {(ls.status==="at_port"||ls.status==="customs"||ls.status==="delayed")&&<LegBtn label="▶ Resume" cls="start" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"active")}/>}
                        <LegBtn label="✓ Complete leg" cls="done" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"done")}/>
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {completedLegs===3&&(
              <div style={{background:"rgba(16,185,129,0.07)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:11,padding:24,textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:8}}>🎉</div>
                <div style={{fontSize:15,fontWeight:500,color:"#fff",marginBottom:4}}>Shipment delivered!</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>All 3 legs completed successfully. Your cargo has reached its destination.</div>
              </div>
            )}
          </>
        )}

        {/* ════════ DOCUMENTS TAB ════════ */}
        {tab==="documents"&&(
          <>
            {/* Upload section */}
            <div style={c.card}>
              <div style={c.cardTitle}>Upload document</div>
              <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:12}}>
                <div>
                  <div style={c.fieldLabel}>Document type</div>
                  <select style={c.sel} value={docType} onChange={e=>setDocType(e.target.value)}>
                    <option value="">Select document type…</option>
                    <option value="Commercial Invoice">Commercial Invoice</option>
                    <option value="Packing List">Packing List</option>
                    <option value="Bill of Lading">Bill of Lading</option>
                    <option value="Certificate of Origin">Certificate of Origin</option>
                    <option value="Customs Declaration">Customs Declaration</option>
                    <option value="Insurance Certificate">Insurance Certificate</option>
                    <option value="MSDS">MSDS / Safety Data Sheet</option>
                    <option value="DG Declaration">DG Declaration</option>
                    <option value="Phytosanitary Certificate">Phytosanitary Certificate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Drag-drop zone */}
                <div
                  style={{border:"1px dashed rgba(168,85,247,0.35)",borderRadius:10,padding:"24px 20px",textAlign:"center",background:"rgba(168,85,247,0.04)",cursor:docType?"pointer":"not-allowed",opacity:docType?1:0.5,transition:"all .15s"}}
                  onClick={()=>{ if(docType) fileRef.current?.click() }}
                >
                  <div style={{width:40,height:40,borderRadius:10,background:"rgba(168,85,247,0.12)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  {uploading ? (
                    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:13,color:"rgba(255,255,255,0.5)"}}>
                      <div style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(168,85,247,0.3)",borderTopColor:"#a855f7"}}/>
                      Uploading…
                    </div>
                  ) : (
                    <>
                      <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:3}}>Click to upload or drag &amp; drop</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>PDF, JPG, PNG, DOC, XLS · Max 20MB</div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" style={{display:"none"}} onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadDocument(f); e.target.value="" }}/>
              </div>
            </div>

            {/* Uploaded docs list */}
            <div style={c.card}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={c.cardTitle}>Uploaded documents</div>
                {uploadedDocs.length>0&&<div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{uploadedDocs.length} file{uploadedDocs.length!==1?"s":""}</div>}
              </div>

              {uploadedDocs.length===0?(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"32px 0",gap:10}}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>No documents uploaded yet</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>Upload shipping documents above</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {uploadedDocs.map((doc:any,i:number)=>{
                    const rv = reviewStatus[doc.docId]
                    const isVerified = rv?.status==="verified"
                    const hasIssues  = rv?.status==="issues"
                    return(
                      <div key={i} style={{background:isVerified?"rgba(16,185,129,0.04)":hasIssues?"rgba(239,68,68,0.04)":"rgba(255,255,255,0.03)",border:`1px solid ${isVerified?"rgba(16,185,129,0.25)":hasIssues?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.07)"}`,borderRadius:9,padding:"12px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:36,height:36,borderRadius:8,background:isVerified?"rgba(16,185,129,0.15)":hasIssues?"rgba(239,68,68,0.12)":"rgba(168,85,247,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {isVerified
                              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                              : hasIssues
                                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            }
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:500,color:"#fff",marginBottom:2}}>{doc.docName}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{doc.fileName} · {doc.fileSize?(doc.fileSize/1024).toFixed(0)+"KB":"—"}</div>
                            {doc.uploadedAt&&<div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:1}}>Uploaded {fmtDT(doc.uploadedAt)}</div>}
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                            <div style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:9,background:isVerified?"rgba(16,185,129,0.15)":hasIssues?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.07)",color:isVerified?"#10b981":hasIssues?"#ef4444":"rgba(255,255,255,0.4)"}}>
                              {isVerified?"✓ Verified":hasIssues?"⚠ Issues":"○ Pending review"}
                            </div>
                            {doc.filePath&&(
                              <button style={{fontSize:10,color:"#a855f7",background:"none",border:"1px solid rgba(168,85,247,0.25)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>getSignedUrl(doc.filePath)}>View</button>
                            )}
                          </div>
                        </div>
                        {hasIssues&&rv?.note&&(
                          <div style={{marginTop:8,padding:"7px 10px",background:"rgba(239,68,68,0.07)",borderRadius:7}}>
                            <div style={{fontSize:10,color:"#ef4444",fontWeight:500,marginBottom:2}}>Provider note:</div>
                            <div style={{fontSize:11,color:"rgba(239,68,68,0.8)",lineHeight:1.5}}>{rv.note}</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Cancel dialog */}
      {cancelDlg&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#13131e",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:28,maxWidth:380,width:"100%"}}>
            <div style={{fontSize:16,fontWeight:600,color:"#fff",marginBottom:8}}>Cancel this booking?</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",lineHeight:1.6,marginBottom:20}}>This action cannot be undone. The provider will be notified and any reserved container space will be released.</div>
            <div style={{display:"flex",gap:10}}>
              <button style={{flex:1,height:40,background:"#ef4444",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}} onClick={cancelBooking}>Yes, cancel</button>
              <button style={{flex:1,height:40,background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.5)",fontSize:13,cursor:"pointer"}} onClick={()=>setCancelDlg(false)}>Keep booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Leg action button ────────────────────────────────────────────────────────
function LegBtn({ label,cls,disabled,onClick }:{ label:string;cls:string;disabled?:boolean;onClick:()=>void }) {
  const colors:Record<string,{border:string;color:string}> = {
    start:  {border:"rgba(168,85,247,0.4)",color:"#a855f7"},
    port:   {border:"rgba(245,158,11,0.4)",color:"#f59e0b"},
    customs:{border:"rgba(168,85,247,0.35)",color:"#c084fc"},
    delayed:{border:"rgba(239,68,68,0.35)",color:"#ef4444"},
    done:   {border:"rgba(16,185,129,0.4)",color:"#10b981"},
  }
  const cc = colors[cls]??colors.start
  return(
    <button style={{fontSize:11,fontWeight:500,padding:"6px 11px",borderRadius:7,border:`1px solid ${cc.border}`,color:cc.color,background:"none",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1}} disabled={disabled} onClick={onClick}>{label}</button>
  )
}

// ─── Shared card styles ───────────────────────────────────────────────────────
const c = {
  card:       { background:"#13131e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:18 } as React.CSSProperties,
  cardTitle:  { fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.5)", textTransform:"uppercase" as const, letterSpacing:".07em" } as React.CSSProperties,
  fieldLabel: { fontSize:11, color:"rgba(255,255,255,0.45)", marginBottom:5 } as React.CSSProperties,
  sel:        { width:"100%", height:38, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"0 12px", color:"#fff", fontSize:13, outline:"none", cursor:"pointer", colorScheme:"dark" as const, fontFamily:"system-ui" } as React.CSSProperties,
}
