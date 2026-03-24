import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import ProviderLayout from "@/components/layout/ProviderLayout"

interface Booking {
  id: string; status: string; created_at: string
  trader_id: string; provider_id: string; container_id: string
  origin: string; destination: string
  departure_date: string; arrival_date?: string
  cargo_type: string; cargo_description?: string
  weight_kg: number; cbm: number; pieces?: number
  total_price: number; incoterms?: string
  fragile?: boolean; dangerous?: boolean; perishable?: boolean
  first_mile_type?: string; last_mile_type?: string
  pickup_address?: string; delivery_address?: string
  special_instructions?: string
  uploaded_documents?: any[]
  doc_review_status?: Record<string, { status: string; note: string }>
  review_notes?: string; revision_note?: string
  docs_submitted_at?: string; reviewed_at?: string
  container?: { container_type: string; max_cbm: number; price_per_cbm: number; refrigerated: boolean }
  trader?: { email: string; raw_user_meta_data?: { first_name?: string; last_name?: string } }
}

type LegStatus = "pending" | "active" | "at_port" | "customs" | "delayed" | "done"

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:            { label: "Pending",       color: "#f59e0b", bg: "rgba(245,158,11,0.15)"  },
  docs_pending:       { label: "Docs pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.15)"  },
  docs_submitted:     { label: "Needs review",  color: "#a855f7", bg: "rgba(168,85,247,0.15)"  },
  docs_reviewing:     { label: "Reviewing",     color: "#3b82f6", bg: "rgba(59,130,246,0.15)"  },
  revision_requested: { label: "Revision sent", color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  confirmed:          { label: "Confirmed",     color: "#10b981", bg: "rgba(16,185,129,0.15)"  },
  in_transit:         { label: "In Transit",    color: "#3b82f6", bg: "rgba(59,130,246,0.15)"  },
  delivered:          { label: "Delivered",     color: "#10b981", bg: "rgba(16,185,129,0.15)"  },
  cancelled:          { label: "Cancelled",     color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
}

const LEG_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label:"Pending",    color:"rgba(255,255,255,0.4)", bg:"rgba(255,255,255,0.07)", icon:"○" },
  active:  { label:"In Transit", color:"#3b82f6",               bg:"rgba(59,130,246,0.18)",  icon:"▶" },
  at_port: { label:"At Port",    color:"#f59e0b",               bg:"rgba(245,158,11,0.18)",  icon:"⚓" },
  customs: { label:"Customs",    color:"#c084fc",               bg:"rgba(168,85,247,0.18)",  icon:"🛃" },
  delayed: { label:"Delayed",    color:"#ef4444",               bg:"rgba(239,68,68,0.15)",   icon:"⚠" },
  done:    { label:"Completed",  color:"#10b981",               bg:"rgba(16,185,129,0.18)",  icon:"✓" },
}

const fmt   = (n:number) => "$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtD  = (d:string) => new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})
const fmtDT = (d:string) => new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})
const daysTo= (d:string) => Math.ceil((new Date(d).getTime()-Date.now())/86400000)
const wIcon = (c:number) => c<=113?"☀️":c<=119?"⛅":c<=176?"🌦":c<=296?"🌧":"⛈"

export default function ProviderBookingDetail() {
  const { id }   = useParams<{id:string}>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [booking,       setBooking]      = useState<Booking|null>(null)
  const [loading,       setLoading]      = useState(true)
  const [tab,           setTab]          = useState<"details"|"tracking"|"documents">("details")
  const [legStates,     setLegStates]    = useState<Record<number,{status:LegStatus;startedAt?:string;completedAt?:string}>>({1:{status:"pending"},2:{status:"pending"},3:{status:"pending"}})
  const [weather,       setWeather]      = useState<Record<string,any>>({})
  const [updating,      setUpdating]     = useState<number|null>(null)
  const [actionLoading, setActionLoading]= useState<string|null>(null)
  const [docReview,     setDocReview]    = useState<Record<string,{status:string;note:string}>>({})
  const [overallNote,   setOverallNote]  = useState("")
  const [revisionNote,  setRevisionNote] = useState("")
  const [showRevision,  setShowRevision] = useState(false)
  const [showConfirm,   setShowConfirm]  = useState(false)
  const [showCancel,    setShowCancel]   = useState(false)
  const [signedUrls,    setSignedUrls]   = useState<Record<string,string>>({})

  const loadBooking = useCallback(async()=>{
    if(!id) return; setLoading(true)
    try {
      const {data} = await supabase.from("bookings").select("*,container:containers(container_type,max_cbm,price_per_cbm,refrigerated)").eq("id",id).single()
      if(data){ setBooking(data as any); setDocReview((data as any).doc_review_status??{}); setOverallNote((data as any).review_notes??"") }
      const {data:legs} = await supabase.from("shipment_legs" as any).select("*").eq("booking_id",id)
      if(legs?.length){ const map:any={}; legs.forEach((l:any)=>{map[l.leg]={status:l.status,startedAt:l.started_at,completedAt:l.completed_at}}); setLegStates(map) }
    } catch(e){console.error(e)} finally{setLoading(false)}
  },[id])

  useEffect(()=>{loadBooking()},[loadBooking])

  useEffect(()=>{
    if(!booking) return
    const cities=[booking.origin?.split(",")[0],booking.destination?.split(",")[0]].filter(Boolean) as string[]
    cities.forEach(async city=>{
      try{
        const r=await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`); if(!r.ok) return
        const d=await r.json(); const c=d.current_condition?.[0]
        if(c) setWeather(p=>({...p,[city]:{icon:wIcon(parseInt(c.weatherCode)),temp:parseInt(c.temp_C),wind:parseInt(c.windspeedKmph),humidity:parseInt(c.humidity)}}))
      }catch{}
    })
  },[booking?.origin,booking?.destination])

  const confirmBooking = async()=>{
    setActionLoading("confirm")
    await supabase.from("bookings").update({status:"confirmed",doc_review_status:docReview,review_notes:overallNote,reviewed_at:new Date().toISOString()} as any).eq("id",id!)
    try{await supabase.from("notifications" as any).insert({user_id:booking!.trader_id,type:"booking_confirmed",title:"Booking confirmed!",message:`${booking!.origin?.split(",")[0]} → ${booking!.destination?.split(",")[0]}`,booking_id:id})}catch{}
    await loadBooking(); setShowConfirm(false); setActionLoading(null)
  }

  const requestRevision = async()=>{
    if(!revisionNote.trim()) return; setActionLoading("revision")
    await supabase.from("bookings").update({status:"revision_requested",revision_note:revisionNote,doc_review_status:docReview,reviewed_at:new Date().toISOString()} as any).eq("id",id!)
    try{await supabase.from("notifications" as any).insert({user_id:booking!.trader_id,type:"revision_requested",title:"Document revision needed",message:revisionNote,booking_id:id})}catch{}
    await loadBooking(); setShowRevision(false); setActionLoading(null)
  }

  const startShipment = async()=>{
    setActionLoading("shipment")
    await supabase.from("bookings").update({status:"in_transit"} as any).eq("id",id!)
    await loadBooking(); setActionLoading(null)
  }

  const cancelBooking = async()=>{
    setActionLoading("cancel")
    await supabase.from("bookings").update({status:"cancelled"} as any).eq("id",id!)
    try{await supabase.from("notifications" as any).insert({user_id:booking!.trader_id,type:"booking_cancelled",title:"Booking cancelled",message:"Your booking has been cancelled by the provider.",booking_id:id})}catch{}
    await loadBooking(); setShowCancel(false); setActionLoading(null)
  }

  const saveDocReview = async()=>{
    await supabase.from("bookings").update({doc_review_status:docReview,review_notes:overallNote,status:"docs_reviewing"} as any).eq("id",id!)
    await loadBooking()
  }

  const updateLeg = async(legN:number,newStatus:LegStatus)=>{
    setUpdating(legN)
    const now=new Date().toISOString()
    const update:any={booking_id:id,leg:legN,status:newStatus}
    if(newStatus==="active"&&!legStates[legN]?.startedAt) update.started_at=now
    if(newStatus==="done") update.completed_at=now
    try{
      await supabase.from("shipment_legs" as any).upsert(update,{onConflict:"booking_id,leg"})
      if(newStatus==="done"&&legN===3) await supabase.from("bookings").update({status:"delivered"} as any).eq("id",id!)
      await loadBooking()
    }catch{
      const extra={...(update.started_at?{startedAt:update.started_at}:{}),...(newStatus==="done"?{completedAt:now}:{})}
      setLegStates(p=>({...p,[legN]:{...p[legN],status:newStatus,...extra}}))
    }finally{setUpdating(null)}
  }

  const getSignedUrl=async(path:string)=>{
    if(signedUrls[path]){window.open(signedUrls[path],"_blank");return}
    const {data}=await supabase.storage.from("booking-documents").createSignedUrl(path,3600)
    if(data?.signedUrl){setSignedUrls(p=>({...p,[path]:data.signedUrl}));window.open(data.signedUrl,"_blank")}
  }

  if(loading) return <ProviderLayout><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:"rgba(255,255,255,0.3)",fontSize:13}}>Loading…</div></ProviderLayout>
  if(!booking) return <ProviderLayout><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:"rgba(255,255,255,0.3)",fontSize:13}}>Booking not found.</div></ProviderLayout>

  const sm           = STATUS_META[booking.status]??STATUS_META.pending
  const uploadedDocs = booking.uploaded_documents??[]
  const allVerified  = uploadedDocs.length>0&&uploadedDocs.every((d:any)=>docReview[d.docId]?.status==="verified")
  const needsAction  = ["docs_submitted","docs_reviewing","pending"].includes(booking.status)
  const canConfirm   = needsAction
  const canRevise    = ["docs_submitted","docs_reviewing"].includes(booking.status)
  const canStart     = booking.status==="confirmed"
  const deadlinePassed = booking.departure_date&&daysTo(booking.departure_date)<0
  const originCity   = booking.origin?.split(",")[0]
  const destCity     = booking.destination?.split(",")[0]
  const completedLegs= Object.values(legStates).filter(l=>l.status==="done").length
  const hasActiveLeg = Object.values(legStates).some(l=>["active","at_port","customs","delayed"].includes(l.status))
  const progressPct  = completedLegs===3?100:completedLegs*33+(hasActiveLeg?17:0)
  const traderName   = booking.trader?.raw_user_meta_data?.first_name
    ? `${booking.trader.raw_user_meta_data.first_name} ${booking.trader.raw_user_meta_data.last_name??""}`.trim()
    : (booking.trader?.email??"Trader")

  const LEGS=[
    {n:1,icon:"🚛",title:"Leg 1: Pickup from origin",    sub:booking.first_mile_type==="provider_pickup"?"You collect from trader warehouse":"Trader self drop-off",ports:[{city:originCity!,role:"Origin"}]},
    {n:2,icon:"🚢",title:"Leg 2: Port-to-port vessel",   sub:`${originCity} → ${destCity}`,ports:[{city:originCity!,role:"Origin"},{city:destCity!,role:"Destination"}]},
    {n:3,icon:"📦",title:"Leg 3: Final delivery",         sub:booking.last_mile_type==="provider_delivery"?"You deliver to trader address":"Trader self-pickup",ports:[{city:destCity!,role:"Destination"}]},
  ]

  const congColor=(l:string)=>l==="high"?"#ef4444":l==="medium"?"#f59e0b":"#10b981"

  return (
    <ProviderLayout title={`Booking BK-${booking.id.substring(0,8).toUpperCase()}`}>
      <div style={{color:"#fff",fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:"#0f0f18",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"18px 28px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <button style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.45)",fontSize:12,padding:"6px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}} onClick={()=>navigate("/dashboard/provider/bookings")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>My Bookings
            </button>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:20,fontWeight:700,color:"#fff"}}>BK-{booking.id.substring(0,8).toUpperCase()}</div>
                <div style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:10,background:sm.bg,color:sm.color}}>{sm.label}</div>
                {needsAction&&<div style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:9,background:"rgba(168,85,247,0.2)",color:"#a855f7"}}>ACTION NEEDED</div>}
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>Requested {fmtD(booking.created_at)} · {originCity} → {destCity}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={{display:"flex",alignItems:"center",gap:6,fontSize:12,padding:"8px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.6)",cursor:"pointer"}} onClick={()=>navigate(`/dashboard/provider/messages?booking=${booking.id}`)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Message Trader
            </button>
            {!["confirmed","delivered","cancelled"].includes(booking.status)&&(
              <button style={{fontSize:12,padding:"8px 16px",borderRadius:8,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.08)",color:"#ef4444",cursor:"pointer"}} onClick={()=>setShowCancel(true)}>Cancel</button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"#0f0f18",padding:"0 28px"}}>
        {(["details","tracking","documents"] as const).map(t=>(
          <button key={t} style={{fontSize:13,fontWeight:tab===t?500:400,padding:"14px 20px",border:"none",background:"none",color:tab===t?"#fff":"rgba(255,255,255,0.4)",cursor:"pointer",borderBottom:tab===t?"2px solid #a855f7":"2px solid transparent",textTransform:"capitalize",display:"flex",alignItems:"center",gap:6}} onClick={()=>setTab(t)}>
            {t}
            {t==="documents"&&uploadedDocs.length>0&&<span style={{fontSize:10,background:"rgba(168,85,247,0.2)",color:"#a855f7",borderRadius:9,padding:"1px 6px",fontWeight:600}}>{uploadedDocs.length}</span>}
            {t==="documents"&&needsAction&&uploadedDocs.length>0&&<div style={{width:7,height:7,borderRadius:"50%",background:"#a855f7"}}/>}
          </button>
        ))}
      </div>

      <div style={{padding:"24px 28px",maxWidth:960,margin:"0 auto",display:"flex",flexDirection:"column",gap:14}}>

        {/* DETAILS TAB */}
        {tab==="details"&&(
          <>
            {/* Trader info */}
            <div style={cs.card}>
              <div style={cs.cardTitle}>Trader information</div>
              <div style={{display:"flex",alignItems:"center",gap:14,marginTop:12}}>
                <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(168,85,247,0.2)",border:"1px solid rgba(168,85,247,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:600,color:"#a855f7",flexShrink:0}}>
                  {traderName.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{fontSize:14,fontWeight:500,color:"#fff"}}>{traderName}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>{booking.trader?.email??"—"}</div>
                </div>
                <button style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,fontSize:11,padding:"6px 12px",borderRadius:7,border:"1px solid rgba(168,85,247,0.3)",background:"rgba(168,85,247,0.08)",color:"#a855f7",cursor:"pointer"}} onClick={()=>navigate(`/dashboard/provider/messages?booking=${booking.id}`)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Message trader
                </button>
              </div>
            </div>

            {/* Shipment details */}
            <div style={cs.card}>
              <div style={cs.cardTitle}>Shipment details</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:12}}>
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
                  ...(booking.fragile?[{l:"Handling",v:"⚠ Fragile"}]:[]),
                  ...(booking.dangerous?[{l:"DG class",v:"⚠ Dangerous goods"}]:[]),
                ].map((r,i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>{r.l}</div>
                    <div style={{fontSize:13,fontWeight:500,color:r.l.includes("DG")?"#ef4444":r.l==="Handling"?"#f59e0b":"#fff"}}>{r.v}</div>
                  </div>
                ))}
              </div>
              {booking.cargo_description&&<div style={{marginTop:10,background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3}}>Description</div><div style={{fontSize:12,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>{booking.cargo_description}</div></div>}
              {booking.special_instructions&&<div style={{marginTop:8,background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:"#f59e0b",fontWeight:600,marginBottom:2}}>Special instructions</div><div style={{fontSize:12,color:"rgba(245,158,11,0.8)",lineHeight:1.5}}>{booking.special_instructions}</div></div>}
            </div>

            {/* Payment */}
            <div style={cs.card}>
              <div style={cs.cardTitle}>Payment</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10}}>
                <div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:4}}>Freight ({booking.cbm} CBM × ${booking.container?.price_per_cbm}/CBM)</div>
                  <div style={{fontSize:22,fontWeight:700,color:"#a855f7"}}>{fmt(booking.total_price??0)}</div>
                </div>
                <div style={{fontSize:11,padding:"5px 12px",borderRadius:9,background:booking.status==="confirmed"?"rgba(16,185,129,0.12)":"rgba(245,158,11,0.12)",color:booking.status==="confirmed"?"#10b981":"#f59e0b",fontWeight:500}}>
                  {["confirmed","in_transit","delivered"].includes(booking.status)?"✓ Payment secured":"⏳ Awaiting confirmation"}
                </div>
              </div>
            </div>

            {/* Deadline */}
            {booking.departure_date&&(
              <div style={{background:deadlinePassed?"rgba(239,68,68,0.07)":"rgba(245,158,11,0.06)",border:`1px solid ${deadlinePassed?"rgba(239,68,68,0.25)":"rgba(245,158,11,0.2)"}`,borderRadius:10,padding:"12px 16px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{fontSize:18,flexShrink:0}}>📦</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:"#fff",marginBottom:3}}>Cargo delivery deadline: {fmtD(new Date(new Date(booking.departure_date).getTime()-2*86400000).toISOString())}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:4}}>Trader must deliver cargo 2 days before container departure</div>
                    {deadlinePassed
                      ? <div style={{fontSize:11,color:"#ef4444",fontWeight:500}}>⚠ Delivery deadline has passed</div>
                      : <div style={{fontSize:11,color:"#10b981"}}>✓ {daysTo(booking.departure_date)} days until departure</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {canConfirm&&!showConfirm&&(
                <button style={{width:"100%",height:46,background:"#10b981",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={()=>setTab("documents")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Review documents &amp; confirm booking
                </button>
              )}
              {canStart&&(
                <button style={{width:"100%",height:46,background:actionLoading==="shipment"?"rgba(124,58,237,0.5)":"#7c3aed",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={startShipment} disabled={actionLoading==="shipment"}>
                  {actionLoading==="shipment"?<><Spin/>Starting…</>:<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start Shipment</>}
                </button>
              )}
              {booking.status==="pending"&&<div style={{width:"100%",height:44,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,color:"#f59e0b",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>⏳ Waiting for trader to upload documents</div>}
              {booking.status==="in_transit"&&<div style={{width:"100%",height:44,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,color:"#3b82f6",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>▶ Shipment in transit — manage legs in Tracking tab</div>}
              {booking.status==="delivered"&&<div style={{width:"100%",height:44,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:10,color:"#10b981",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>✓ Shipment delivered</div>}
              {!["confirmed","delivered","cancelled","in_transit"].includes(booking.status)&&(
                <button style={{width:"100%",height:42,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,color:"#ef4444",fontSize:13,fontWeight:500,cursor:"pointer"}} onClick={()=>setShowCancel(true)}>Cancel booking</button>
              )}
            </div>
          </>
        )}

        {/* TRACKING TAB */}
        {tab==="tracking"&&(
          <>
            <div style={{...cs.card,borderColor:"rgba(168,85,247,0.2)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div><div style={cs.cardTitle}>Transport journey</div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1}}>{originCity} → {destCity} · {completedLegs}/3 legs complete</div></div>
                <div style={{fontSize:12,fontWeight:500,color:completedLegs===3?"#10b981":hasActiveLeg?"#3b82f6":"rgba(255,255,255,0.4)"}}>{completedLegs===3?"✓ Delivered":hasActiveLeg?"▶ In progress":"○ Not started"}</div>
              </div>
              <div style={{height:6,background:"rgba(255,255,255,0.07)",borderRadius:3,overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",borderRadius:3,width:progressPct+"%",background:"#a855f7",transition:"width .6s ease"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                {["Origin","Vessel","Customs","Delivered"].map((label,i)=>{
                  const thr=[0,33,66,100][i]; const done=progressPct>=thr
                  return(<div key={label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:11,height:11,borderRadius:"50%",border:"2px solid #0a0a0f",background:done?"#10b981":progressPct>=thr-5?"#a855f7":"rgba(255,255,255,0.15)"}}/><div style={{fontSize:9,color:"rgba(255,255,255,0.25)"}}>{label}</div></div>)
                })}
              </div>
            </div>

            {LEGS.map((leg,idx)=>{
              const ls=legStates[leg.n]??{status:"pending" as LegStatus}
              const lm=LEG_META[ls.status]
              const prevOk=idx===0||legStates[idx]?.status==="done"
              const canGo=prevOk&&ls.status==="pending"
              const inProg=["active","at_port","customs","delayed"].includes(ls.status)
              const borderC=ls.status==="active"?"rgba(59,130,246,0.4)":ls.status==="at_port"?"rgba(245,158,11,0.4)":ls.status==="customs"?"rgba(168,85,247,0.4)":ls.status==="delayed"?"rgba(239,68,68,0.4)":ls.status==="done"?"rgba(16,185,129,0.3)":"rgba(255,255,255,0.07)"
              const bgC=ls.status==="active"?"rgba(59,130,246,0.04)":ls.status==="at_port"?"rgba(245,158,11,0.04)":ls.status==="delayed"?"rgba(239,68,68,0.04)":ls.status==="done"?"rgba(16,185,129,0.03)":"rgba(255,255,255,0.02)"
              return(
                <div key={leg.n} style={{border:`1px solid ${borderC}`,background:bgC,borderRadius:11,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px 10px"}}>
                    <div style={{position:"relative",flexShrink:0}}>
                      <div style={{width:40,height:40,borderRadius:10,background:ls.status==="done"?"rgba(16,185,129,0.18)":ls.status==="active"?"rgba(59,130,246,0.18)":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {ls.status==="done"?<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>:<span style={{fontSize:18}}>{leg.icon}</span>}
                      </div>
                      {ls.status==="active"&&<div style={{position:"absolute",inset:-5,borderRadius:"50%",border:"2px solid rgba(59,130,246,0.35)",pointerEvents:"none"}}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:"#fff",marginBottom:2}}>{leg.title}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{leg.sub}</div>
                      {ls.startedAt&&<div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>Started {fmtDT(ls.startedAt)}</div>}
                      {ls.completedAt&&<div style={{fontSize:10,color:"#10b981",marginTop:1}}>Completed {fmtDT(ls.completedAt)}</div>}
                    </div>
                    <div style={{fontSize:11,fontWeight:500,padding:"3px 9px",borderRadius:10,background:lm.bg,color:lm.color,flexShrink:0}}>{lm.icon} {lm.label}</div>
                  </div>
                  {leg.n===2&&booking.departure_date&&(
                    <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.04)",margin:"0 14px 10px",borderRadius:8,padding:"10px 14px"}}>
                      <div><div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:2}}>Departure</div><div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{originCity} · {fmtD(booking.departure_date)}</div></div>
                      <div style={{fontSize:16,color:"rgba(168,85,247,0.5)",flex:1,textAlign:"center"}}>→</div>
                      {booking.arrival_date&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:2}}>Arrival</div><div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{destCity} · {fmtD(booking.arrival_date)}</div></div>}
                    </div>
                  )}
                  {leg.ports.filter(p=>weather[p.city]).length>0&&(
                    <div style={{display:"grid",gridTemplateColumns:leg.ports.length>1?"1fr 1fr":"1fr",gap:8,padding:"0 14px 10px"}}>
                      {leg.ports.filter(p=>weather[p.city]).map(p=>{
                        const w=weather[p.city]; const congLevel=w.wind>35?"high":w.wind>20?"medium":"low"; const cc=congColor(congLevel)
                        return(<div key={p.city} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"10px 12px"}}>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>{p.role}</div>
                          <div style={{fontSize:12,fontWeight:500,color:"#fff",marginBottom:6}}>{p.city}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:20}}>{w.icon}</span><div><div style={{fontSize:15,fontWeight:500,color:"#fff"}}>{w.temp}°C</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>💨 {w.wind}km/h · 💧 {w.humidity}%</div></div></div>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>Congestion</span><span style={{fontSize:10,color:cc,fontWeight:500}}>{congLevel}</span></div>
                          <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",borderRadius:2,width:(w.wind>35?70:w.wind>20?40:20)+"%",background:cc}}/></div>
                        </div>)
                      })}
                    </div>
                  )}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"0 14px 12px"}}>
                    {ls.status==="done"&&<div style={{fontSize:12,color:"#10b981",fontWeight:500,display:"flex",alignItems:"center",gap:5}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Leg {leg.n} completed</div>}
                    {ls.status==="pending"&&<LegBtn label={`▶ Start Leg ${leg.n}`} cls="start" disabled={!canGo||updating===leg.n} onClick={()=>updateLeg(leg.n,"active")}/>}
                    {inProg&&(<>
                      {ls.status!=="at_port"&&<LegBtn label="⚓ At port" cls="port" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"at_port")}/>}
                      {leg.n===2&&ls.status!=="customs"&&<LegBtn label="🛃 Customs" cls="customs" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"customs")}/>}
                      {ls.status!=="delayed"&&<LegBtn label="⚠ Delayed" cls="delayed" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"delayed")}/>}
                      {(ls.status==="at_port"||ls.status==="customs"||ls.status==="delayed")&&<LegBtn label="▶ Resume" cls="start" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"active")}/>}
                      <LegBtn label="✓ Complete" cls="done" disabled={updating===leg.n} onClick={()=>updateLeg(leg.n,"done")}/>
                    </>)}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* DOCUMENTS TAB */}
        {tab==="documents"&&(
          <>
            {needsAction&&uploadedDocs.length>0&&(
              <div style={{background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.25)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:"#a855f7",flexShrink:0}}/>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500,color:"#c084fc"}}>{uploadedDocs.length} document{uploadedDocs.length!==1?"s":""} submitted for review</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>Review and verify each document, then confirm or request revision.</div></div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{booking.docs_submitted_at?`Submitted ${fmtDT(booking.docs_submitted_at)}`:""}</div>
              </div>
            )}
            {uploadedDocs.length===0?(
              <div style={cs.card}><div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"32px 0",gap:10}}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><div style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>{["pending","docs_pending"].includes(booking.status)?"Waiting for trader to upload documents":"No documents uploaded"}</div></div></div>
            ):(
              uploadedDocs.map((doc:any,i:number)=>{
                const rev=docReview[doc.docId]??{status:"pending",note:""}
                const verified=rev.status==="verified"; const issues=rev.status==="issues"
                return(
                  <div key={i} style={{background:verified?"rgba(16,185,129,0.04)":issues?"rgba(239,68,68,0.04)":"rgba(255,255,255,0.03)",border:`1px solid ${verified?"rgba(16,185,129,0.25)":issues?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"14px 16px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                      <div style={{width:38,height:38,borderRadius:9,background:verified?"rgba(16,185,129,0.15)":issues?"rgba(239,68,68,0.12)":"rgba(168,85,247,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {verified?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          :issues?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
                          :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:"#fff",marginBottom:2}}>{doc.docName}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{doc.fileName} · {doc.fileSize?(doc.fileSize/1024).toFixed(0)+" KB":"—"}</div>
                        {doc.uploadedAt&&<div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:1}}>Uploaded {fmtDT(doc.uploadedAt)}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                        <div style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:9,background:verified?"rgba(16,185,129,0.15)":issues?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.07)",color:verified?"#10b981":issues?"#ef4444":"rgba(255,255,255,0.4)"}}>
                          {verified?"✓ Verified":issues?"⚠ Issues":"○ Pending"}
                        </div>
                        {doc.filePath&&<button style={{fontSize:10,color:"#a855f7",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:6,padding:"3px 9px",cursor:"pointer"}} onClick={()=>getSignedUrl(doc.filePath)}>View doc</button>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,marginBottom:issues?10:0}}>
                      <button style={{flex:1,height:32,fontSize:11,fontWeight:500,borderRadius:7,border:`1px solid ${verified?"rgba(16,185,129,0.5)":"rgba(16,185,129,0.2)"}`,background:verified?"rgba(16,185,129,0.18)":"rgba(16,185,129,0.07)",color:"#10b981",cursor:"pointer"}}
                        onClick={()=>setDocReview(p=>({...p,[doc.docId]:{...p[doc.docId],status:verified?"pending":"verified",note:""}}))}>
                        {verified?"✓ Verified — click to undo":"✓ Mark as verified"}
                      </button>
                      <button style={{flex:1,height:32,fontSize:11,fontWeight:500,borderRadius:7,border:`1px solid ${issues?"rgba(239,68,68,0.5)":"rgba(239,68,68,0.2)"}`,background:issues?"rgba(239,68,68,0.15)":"rgba(239,68,68,0.07)",color:"#ef4444",cursor:"pointer"}}
                        onClick={()=>setDocReview(p=>({...p,[doc.docId]:{...p[doc.docId],status:issues?"pending":"issues",note:p[doc.docId]?.note??""}}))}>
                        {issues?"⚠ Issues flagged — click to undo":"⚠ Flag issue"}
                      </button>
                    </div>
                    {issues&&<input style={{width:"100%",height:34,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:7,padding:"0 10px",color:"#fff",fontSize:12,outline:"none"}} placeholder="Describe the issue (trader will see this)…" value={rev.note} onChange={e=>setDocReview(p=>({...p,[doc.docId]:{...p[doc.docId],note:e.target.value}}))}/>}
                  </div>
                )
              })
            )}
            {uploadedDocs.length>0&&(
              <div style={cs.card}>
                <div style={cs.cardTitle}>Internal review notes</div>
                <textarea style={{width:"100%",minHeight:64,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px",color:"#fff",fontSize:12,outline:"none",resize:"vertical",lineHeight:1.5,marginTop:10,fontFamily:"system-ui"}} placeholder="Internal notes (not shown to trader)…" value={overallNote} onChange={e=>setOverallNote(e.target.value)}/>
                <button style={{marginTop:8,fontSize:11,color:"rgba(255,255,255,0.4)",background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"5px 12px",cursor:"pointer"}} onClick={saveDocReview}>Save review progress</button>
              </div>
            )}
            {uploadedDocs.length>0&&needsAction&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {!allVerified&&<div style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,padding:"9px 14px",fontSize:11,color:"rgba(245,158,11,0.8)",display:"flex",gap:8,alignItems:"center"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>{uploadedDocs.filter((d:any)=>docReview[d.docId]?.status!=="verified").length} document(s) not yet verified — you can still confirm.</div>}
                {!showConfirm
                  ?<button style={{width:"100%",height:46,background:"#10b981",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={()=>setShowConfirm(true)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Confirm booking</button>
                  :<div style={{background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:10,padding:"14px 16px"}}>
                    <div style={{fontSize:13,fontWeight:500,color:"#fff",marginBottom:6}}>Confirm this booking?</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:12,lineHeight:1.6}}>The trader will be notified and the booking becomes active.</div>
                    <div style={{display:"flex",gap:8}}>
                      <button style={{flex:1,height:38,background:"#10b981",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}} onClick={confirmBooking} disabled={actionLoading==="confirm"}>{actionLoading==="confirm"?"Confirming…":"Yes, confirm"}</button>
                      <button style={{flex:1,height:38,background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.4)",fontSize:13,cursor:"pointer"}} onClick={()=>setShowConfirm(false)}>Cancel</button>
                    </div>
                  </div>}
                {canRevise&&!showRevision
                  ?<button style={{width:"100%",height:42,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:10,color:"#f59e0b",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}} onClick={()=>setShowRevision(true)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Request document revision</button>
                  :canRevise&&showRevision?<div style={{background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:10,padding:"14px 16px"}}>
                    <div style={{fontSize:13,fontWeight:500,color:"#fff",marginBottom:6}}>What needs to be revised?</div>
                    <textarea style={{width:"100%",minHeight:80,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:8,padding:"10px 12px",color:"#fff",fontSize:12,outline:"none",resize:"vertical",lineHeight:1.5,fontFamily:"system-ui",marginBottom:10}} placeholder="e.g. Commercial invoice missing signature…" value={revisionNote} onChange={e=>setRevisionNote(e.target.value)}/>
                    <div style={{display:"flex",gap:8}}>
                      <button style={{flex:1,height:38,background:"#f59e0b",border:"none",borderRadius:8,color:"#000",fontSize:13,fontWeight:600,cursor:"pointer"}} onClick={requestRevision} disabled={!revisionNote.trim()||actionLoading==="revision"}>{actionLoading==="revision"?"Sending…":"Send revision request"}</button>
                      <button style={{flex:1,height:38,background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.4)",fontSize:13,cursor:"pointer"}} onClick={()=>setShowRevision(false)}>Cancel</button>
                    </div>
                  </div>:null}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel dialog */}
      {showCancel&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#13131e",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:28,maxWidth:380,width:"100%"}}>
            <div style={{fontSize:16,fontWeight:600,color:"#fff",marginBottom:8}}>Cancel this booking?</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",lineHeight:1.6,marginBottom:20}}>The trader will be notified immediately.</div>
            <div style={{display:"flex",gap:10}}>
              <button style={{flex:1,height:40,background:"#ef4444",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}} onClick={cancelBooking} disabled={actionLoading==="cancel"}>{actionLoading==="cancel"?"Cancelling…":"Yes, cancel"}</button>
              <button style={{flex:1,height:40,background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.4)",fontSize:13,cursor:"pointer"}} onClick={()=>setShowCancel(false)}>Keep</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProviderLayout>
  )
}

function LegBtn({label,cls,disabled,onClick}:{label:string;cls:string;disabled?:boolean;onClick:()=>void}) {
  const colors:Record<string,{border:string;color:string}>={start:{border:"rgba(168,85,247,0.4)",color:"#a855f7"},port:{border:"rgba(245,158,11,0.4)",color:"#f59e0b"},customs:{border:"rgba(168,85,247,0.35)",color:"#c084fc"},delayed:{border:"rgba(239,68,68,0.35)",color:"#ef4444"},done:{border:"rgba(16,185,129,0.4)",color:"#10b981"}}
  const c=colors[cls]??colors.start
  return <button style={{fontSize:11,fontWeight:500,padding:"6px 11px",borderRadius:7,border:`1px solid ${c.border}`,color:c.color,background:"none",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1}} disabled={disabled} onClick={onClick}>{label}</button>
}

function Spin(){return <div style={{width:12,height:12,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.25)",borderTopColor:"#fff"}}/>}

const cs:Record<string,React.CSSProperties>={
  card:{background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:18},
  cardTitle:{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:".08em"},
}
