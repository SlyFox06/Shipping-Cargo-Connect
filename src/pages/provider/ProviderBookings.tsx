// src/pages/provider/ProviderBookings.tsx
// Full provider bookings management page.
// Lists all incoming bookings, grouped by status.
// Clicking a booking opens the full document review panel inline.

import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"

interface Booking {
  id: string; status: string; created_at: string
  trader_id: string; origin: string; destination: string
  weight_kg: number; cbm: number; total_price: number
  cargo_type: string; cargo_description: string
  uploaded_documents: any[]; doc_review_status: Record<string,{status:string;note:string}>
  review_notes: string; revision_note: string
  docs_submitted_at: string; reviewed_at: string
  departure_date: string; special_instructions: string
  fragile: boolean; dangerous: boolean
  first_mile_type: string; last_mile_type: string
  incoterms: string
  container_id: string
}

const STATUS_META: Record<string,{label:string;color:string;bg:string;desc:string}> = {
  pending:            { label:"Pending",          color:"#f59e0b", bg:"rgba(245,158,11,0.15)",  desc:"Waiting for trader to add documents" },
  docs_pending:       { label:"Docs pending",     color:"#f59e0b", bg:"rgba(245,158,11,0.15)",  desc:"Trader has not uploaded documents yet" },
  docs_submitted:     { label:"Review needed",    color:"#a855f7", bg:"rgba(168,85,247,0.15)",  desc:"Trader uploaded documents — needs your review" },
  docs_reviewing:     { label:"Reviewing",        color:"#3b82f6", bg:"rgba(59,130,246,0.15)",  desc:"You are currently reviewing" },
  revision_requested: { label:"Revision sent",    color:"#ef4444", bg:"rgba(239,68,68,0.12)",   desc:"You requested changes from trader" },
  confirmed:          { label:"Confirmed",        color:"#10b981", bg:"rgba(16,185,129,0.15)",  desc:"Booking confirmed" },
  cancelled:          { label:"Cancelled",        color:"#6b7280", bg:"rgba(107,114,128,0.12)", desc:"Booking cancelled" },
  delivered:          { label:"Delivered",        color:"#3b82f6", bg:"rgba(59,130,246,0.15)",  desc:"Shipment delivered" },
}

const fmt       = (n:number) => "$"+n.toLocaleString()
const shortId   = (id:string) => id.substring(0,8).toUpperCase()
const daysUntil = (d:string) => Math.max(0, Math.ceil((new Date(d).getTime()-Date.now())/86400000))

export default function ProviderBookings() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [bookings, setBookings]         = useState<Booking[]>([])
  const [loading,  setLoading]          = useState(true)
  const [activeId, setActiveId]         = useState<string|null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const loadBookings = useCallback(async () => {
    if (!user?.id) return; setLoading(true)
    try {
      const { data } = await supabase.from("bookings").select("*").eq("provider_id", user.id).order("created_at", { ascending: false })
      if (data) setBookings(data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { loadBookings() }, [loadBookings])

  // Real-time subscription
  useEffect(() => {
    const ch = supabase.channel("provider-bookings")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`provider_id=eq.${user?.id}` }, () => loadBookings())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id])

  const activeBooking = bookings.find(b => b.id === activeId)
  const needsReview   = bookings.filter(b => b.status === "docs_submitted").length
  const pending       = bookings.filter(b => b.status === "pending" || b.status === "docs_pending").length

  const filtered = filterStatus === "all" ? bookings : bookings.filter(b => b.status === filterStatus)
  const groups: Record<string,Booking[]> = {}
  filtered.forEach(b => { const g = b.status; if (!groups[g]) groups[g] = []; groups[g].push(b) })
  const ORDER = ["docs_submitted","revision_requested","pending","docs_pending","docs_reviewing","confirmed","delivered","cancelled"]

  return (
    <div style={pg.page}>
      {/* Page header */}
      <div style={pg.pageHeader}>
        <div>
          <div style={pg.pageTitle}>Bookings</div>
          <div style={pg.pageSub}>{bookings.length} total · {needsReview} need document review · {pending} pending</div>
        </div>
        {needsReview > 0 && (
          <div style={pg.alertBanner}>
            <div style={pg.alertDot}/>
            <span style={{fontSize:12,color:"rgba(168,85,247,0.9)",flex:1}}><strong>{needsReview}</strong> booking{needsReview!==1?"s":""} with documents ready to review</span>
            <button style={pg.alertBtn} onClick={()=>setFilterStatus("docs_submitted")}>Review now →</button>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={pg.filterRow}>
        {[
          { k:"all",            l:`All (${bookings.length})` },
          { k:"docs_submitted", l:`Needs review (${bookings.filter(b=>b.status==="docs_submitted").length})` },
          { k:"pending",        l:`Pending (${bookings.filter(b=>b.status==="pending"||b.status==="docs_pending").length})` },
          { k:"confirmed",      l:`Confirmed (${bookings.filter(b=>b.status==="confirmed").length})` },
          { k:"delivered",      l:`Delivered (${bookings.filter(b=>b.status==="delivered").length})` },
        ].map(f=>(
          <button key={f.k} style={{...pg.filterTab,...(filterStatus===f.k?pg.filterTabActive:{})}} onClick={()=>setFilterStatus(f.k)}>
            {f.l}
            {f.k==="docs_submitted"&&needsReview>0&&<span style={pg.filterDot}/>}
          </button>
        ))}
      </div>

      <div style={pg.layout}>
        {/* Booking list */}
        <div style={pg.listCol}>
          {loading ? (
            Array.from({length:4}).map((_,i)=><div key={i} style={pg.skRow}/>)
          ) : filtered.length === 0 ? (
            <div style={pg.empty}><div style={{fontSize:28,marginBottom:8}}>📋</div><div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>No bookings in this filter</div></div>
          ) : (
            ORDER.filter(s => groups[s]?.length > 0).map(status => (
              <div key={status}>
                <div style={pg.groupLabel}>
                  <div style={{...pg.statusDot,background:STATUS_META[status]?.color??""}}/>
                  {STATUS_META[status]?.label ?? status}
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginLeft:4}}>({groups[status].length})</span>
                  {status==="docs_submitted"&&<span style={{fontSize:10,padding:"1px 7px",borderRadius:9,background:"rgba(168,85,247,0.15)",color:"#a855f7",marginLeft:6,fontWeight:600}}>Action needed</span>}
                </div>
                {groups[status].map(b => {
                  const sm = STATUS_META[b.status] ?? STATUS_META.pending
                  const docCount = b.uploaded_documents?.length ?? 0
                  const isActive = activeId === b.id
                  const days = b.departure_date ? daysUntil(b.departure_date) : null
                  return (
                    <div
                      key={b.id}
                      style={{...pg.bookingCard,...(isActive?pg.bookingCardActive:{})}}
                      onClick={()=>setActiveId(isActive?null:b.id)}
                    >
                      <div style={pg.bookingTop}>
                        <div style={{...pg.statusPill,background:sm.bg,color:sm.color}}>{sm.label}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>{shortId(b.id)}</div>
                        {docCount>0&&<div style={pg.docPill}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>{docCount} doc{docCount!==1?"s":""}</div>}
                      </div>
                      <div style={pg.bookingRoute}>{(b.origin??"").split(",")[0]} → {(b.destination??"").split(",")[0]}</div>
                      <div style={pg.bookingMeta}>
                        {b.cbm>0&&<span>{b.cbm} CBM</span>}
                        {b.weight_kg>0&&<span>{b.weight_kg.toLocaleString()} kg</span>}
                        {b.cargo_type&&<span>{b.cargo_type}</span>}
                        {days!==null&&<span style={{color:days<=3?"#ef4444":"rgba(255,255,255,0.35)"}}>Departs {days===0?"today":days===1?"tomorrow":`in ${days}d`}</span>}
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                        <div style={{fontSize:12,fontWeight:500,color:"#a855f7"}}>{b.total_price>0?fmt(b.total_price):"—"}</div>
                        {b.docs_submitted_at&&<div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>Docs: {new Date(b.docs_submitted_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Review panel */}
        <div style={pg.reviewCol}>
          {activeBooking
            ? <BookingReviewInline booking={activeBooking} onRefresh={loadBookings} onClose={()=>setActiveId(null)}/>
            : (
              <div style={pg.reviewPlaceholder}>
                <div style={{fontSize:32,marginBottom:12}}>🔍</div>
                <div style={{fontSize:14,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:6}}>Select a booking to review</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",lineHeight:1.6,maxWidth:260,textAlign:"center"}}>
                  Click any booking on the left to see trader details, review uploaded documents, and confirm or request revisions.
                </div>
                {needsReview>0&&(
                  <div style={{marginTop:16,padding:"10px 16px",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:9,textAlign:"center",maxWidth:260}}>
                    <div style={{fontSize:12,color:"#a855f7",fontWeight:500}}>{needsReview} booking{needsReview!==1?"s":""} ready for document review</div>
                    <button style={{marginTop:8,fontSize:11,color:"#a855f7",background:"none",border:"none",cursor:"pointer"}} onClick={()=>{ const b=bookings.find(bk=>bk.status==="docs_submitted"); if(b)setActiveId(b.id) }}>Open first one →</button>
                  </div>
                )}
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

// ─── Inline review panel ──────────────────────────────────────────────────────
function BookingReviewInline({ booking, onRefresh, onClose }: { booking:Booking; onRefresh:()=>void; onClose:()=>void }) {
  const { user } = useAuth()
  const [docReview, setDocReview] = useState<Record<string,{status:string;note:string}>>(booking.doc_review_status ?? {})
  const [overallNote, setOverallNote] = useState(booking.review_notes ?? "")
  const [revisionNote, setRevisionNote] = useState(booking.revision_note ?? "")
  const [loading, setLoading] = useState(false)
  const [signedUrls, setSignedUrls] = useState<Record<string,string>>({})
  const [showConfirmDlg, setShowConfirmDlg] = useState(false)
  const [showRevisionDlg, setShowRevisionDlg] = useState(false)

  const docs: any[] = booking.uploaded_documents ?? []
  const requiredDocs: any[] = [] // you can load from container if needed
  const allVerified = docs.length > 0 && docs.every(d => docReview[d.docId]?.status === "verified")
  const anyIssues   = docs.some(d => docReview[d.docId]?.status === "issues")
  const sm = STATUS_META[booking.status] ?? STATUS_META.pending

  const getSignedUrl = async (filePath:string) => {
    if (signedUrls[filePath]) return
    try {
      const { data } = await supabase.storage.from("booking-documents").createSignedUrl(filePath, 3600)
      if (data?.signedUrl) setSignedUrls(p => ({...p,[filePath]:data.signedUrl}))
    } catch {}
  }

  const setDocStatus = (docId:string, status:string, note="") => {
    setDocReview(p => ({...p,[docId]:{status,note:p[docId]?.note??note}}))
  }
  const setDocNote = (docId:string, note:string) => {
    setDocReview(p => ({...p,[docId]:{...p[docId],note}}))
  }

  const saveReview = async () => {
    await supabase.from("bookings").update({ doc_review_status: docReview, review_notes: overallNote, status: "docs_reviewing", reviewed_at: new Date().toISOString() }).eq("id", booking.id)
    onRefresh()
  }

  const confirmBooking = async () => {
    setLoading(true)
    try {
      await supabase.from("bookings").update({ status:"confirmed", doc_review_status: docReview, review_notes: overallNote, reviewed_at: new Date().toISOString() }).eq("id", booking.id)
      await supabase.from("notifications").insert({ user_id: booking.trader_id, type:"booking_confirmed", title:"Booking confirmed!", message:`${booking.origin?.split(",")[0]} → ${booking.destination?.split(",")[0]} · All documents verified.`, booking_id: booking.id }).catch(()=>{})
      onRefresh(); setShowConfirmDlg(false)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const requestRevision = async () => {
    if (!revisionNote.trim()) return
    setLoading(true)
    try {
      await supabase.from("bookings").update({ status:"revision_requested", revision_note: revisionNote, doc_review_status: docReview, reviewed_at: new Date().toISOString() }).eq("id", booking.id)
      await supabase.from("notifications").insert({ user_id: booking.trader_id, type:"revision_requested", title:"Document revision requested", message: revisionNote, booking_id: booking.id }).catch(()=>{})
      onRefresh(); setShowRevisionDlg(false)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const rejectBooking = async () => {
    if (!window.confirm("Cancel this booking? This cannot be undone.")) return
    await supabase.from("bookings").update({ status:"cancelled" }).eq("id", booking.id)
    await supabase.from("notifications").insert({ user_id: booking.trader_id, type:"booking_cancelled", title:"Booking cancelled", message:`Your booking for ${booking.origin?.split(",")[0]} → ${booking.destination?.split(",")[0]} has been cancelled.`, booking_id: booking.id }).catch(()=>{})
    onRefresh(); onClose()
  }

  return (
    <div style={rv.panel}>
      {/* Panel header */}
      <div style={rv.panelHeader}>
        <div>
          <div style={rv.panelTitle}>{(booking.origin??"").split(",")[0]} → {(booking.destination??"").split(",")[0]}</div>
          <div style={rv.panelSub}>#{shortId(booking.id)} · {new Date(booking.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:11,padding:"3px 9px",borderRadius:10,fontWeight:500,background:sm.bg,color:sm.color}}>{sm.label}</div>
          <button style={rv.closeBtn} onClick={onClose}>×</button>
        </div>
      </div>

      <div style={rv.panelBody}>

        {/* Booking details */}
        <div style={rv.section}>
          <div style={rv.sectionTitle}>Booking details</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              ["Cargo type",   booking.cargo_type],
              ["Volume",       `${booking.cbm} CBM`],
              ["Weight",       `${(booking.weight_kg??0).toLocaleString()} kg`],
              ["Incoterms",    booking.incoterms || "—"],
              ["Pickup",       booking.first_mile_type === "provider_pickup" ? "Provider pickup" : "Self drop-off"],
              ["Delivery",     booking.last_mile_type  === "provider_delivery" ? "Provider delivery" : "Self pickup"],
              ["Fragile",      booking.fragile ? "Yes" : "No"],
              ["DG goods",     booking.dangerous ? "⚠ Yes" : "No"],
            ].map(([l,v],i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:"rgba(255,255,255,0.03)",borderRadius:6}}>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{l}</span>
                <span style={{fontSize:11,color:v==="⚠ Yes"?"#ef4444":"rgba(255,255,255,0.7)",fontWeight:v==="⚠ Yes"?600:400}}>{v}</span>
              </div>
            ))}
          </div>
          {booking.cargo_description&&<div style={{fontSize:11,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.03)",borderRadius:7,padding:"8px 10px",marginTop:6,lineHeight:1.5}}>{booking.cargo_description}</div>}
          {booking.special_instructions&&(
            <div style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:7,padding:"8px 10px",marginTop:6}}>
              <div style={{fontSize:10,color:"#f59e0b",fontWeight:600,marginBottom:3}}>SPECIAL INSTRUCTIONS</div>
              <div style={{fontSize:11,color:"rgba(245,158,11,0.8)",lineHeight:1.5}}>{booking.special_instructions}</div>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:"rgba(168,85,247,0.07)",borderRadius:8,marginTop:6}}>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Total value</span>
            <span style={{fontSize:16,fontWeight:700,color:"#a855f7"}}>{fmt(booking.total_price)}</span>
          </div>
        </div>

        {/* Documents */}
        <div style={rv.section}>
          <div style={rv.sectionTitle}>
            Uploaded documents
            {docs.length>0&&<span style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:400,marginLeft:6}}>{docs.length} file{docs.length!==1?"s":""}</span>}
          </div>
          {docs.length === 0 ? (
            <div style={{fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"16px 0"}}>
              {booking.status==="pending"||booking.status==="docs_pending"
                ? "Waiting for trader to upload documents."
                : "No documents uploaded for this booking."
              }
            </div>
          ) : (
            docs.map((doc:any, i:number) => {
              const review = docReview[doc.docId] ?? { status:"pending", note:"" }
              const statusColor = review.status==="verified"?"#10b981":review.status==="issues"?"#ef4444":"rgba(255,255,255,0.3)"
              const statusLabel = review.status==="verified"?"✓ Verified":review.status==="issues"?"⚠ Issues":"○ Pending"
              return (
                <div key={i} style={{...rv.docCard,...(review.status==="verified"?rv.docVerified:review.status==="issues"?rv.docIssues:{})}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    {/* Doc icon */}
                    <div style={{width:36,height:36,borderRadius:8,background:"rgba(168,85,247,0.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#fff",marginBottom:2}}>{doc.docName}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{doc.fileName} · {doc.fileSize?(doc.fileSize/1024).toFixed(0)+"KB":"—"}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:1}}>Uploaded {doc.uploadedAt?new Date(doc.uploadedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—"}</div>
                    </div>
                    {/* Status badge */}
                    <div style={{fontSize:11,fontWeight:500,color:statusColor,flexShrink:0}}>{statusLabel}</div>
                  </div>

                  {/* Action buttons */}
                  <div style={{display:"flex",gap:6,marginTop:10,alignItems:"center"}}>
                    {doc.filePath&&(
                      <button style={rv.viewBtn} onClick={async()=>{ await getSignedUrl(doc.filePath); const url=signedUrls[doc.filePath]; if(url)window.open(url,"_blank") }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        View document
                      </button>
                    )}
                    <button style={{...rv.verifyBtn,...(review.status==="verified"?rv.verifyBtnActive:{})}} onClick={()=>setDocStatus(doc.docId,"verified")}>
                      ✓ Verify
                    </button>
                    <button style={{...rv.issuesBtn,...(review.status==="issues"?rv.issuesBtnActive:{})}} onClick={()=>setDocStatus(doc.docId,"issues")}>
                      ⚠ Flag issue
                    </button>
                  </div>

                  {/* Issue note */}
                  {review.status==="issues"&&(
                    <input
                      style={{...rv.noteInput,marginTop:8}}
                      placeholder="Describe the issue (trader will see this)…"
                      value={review.note}
                      onChange={e=>setDocNote(doc.docId,e.target.value)}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Overall review notes */}
        {docs.length>0&&(
          <div style={rv.section}>
            <div style={rv.sectionTitle}>Overall review notes</div>
            <textarea style={rv.noteTextarea} rows={2} value={overallNote} onChange={e=>setOverallNote(e.target.value)} placeholder="Internal notes about this booking (not shown to trader)…"/>
            <button style={rv.saveBtn} onClick={saveReview}>Save review progress</button>
          </div>
        )}

        {/* Action buttons */}
        <div style={rv.actionSection}>
          {/* Confirm booking */}
          {(booking.status==="docs_submitted"||booking.status==="docs_reviewing"||booking.status==="pending") && (
            <div>
              {!allVerified&&docs.length>0&&(
                <div style={{fontSize:11,color:"rgba(245,158,11,0.8)",marginBottom:8,display:"flex",gap:6,alignItems:"center"}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
                  {docs.filter(d=>docReview[d.docId]?.status!=="verified").length} document{docs.filter(d=>docReview[d.docId]?.status!=="verified").length!==1?"s":""} not yet verified. You can still confirm if you're satisfied.
                </div>
              )}
              {!showConfirmDlg ? (
                <button style={rv.confirmBtn} onClick={()=>setShowConfirmDlg(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Confirm booking
                </button>
              ) : (
                <div style={rv.confirmDlg}>
                  <div style={{fontSize:12,fontWeight:500,color:"#fff",marginBottom:6}}>Confirm this booking?</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:10}}>The trader will be notified and the booking will be active. This cannot be easily undone.</div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={rv.confirmYesBtn} onClick={confirmBooking} disabled={loading}>{loading?"Confirming…":"Yes, confirm booking"}</button>
                    <button style={rv.cancelDlgBtn} onClick={()=>setShowConfirmDlg(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Request revision */}
          {(booking.status==="docs_submitted"||booking.status==="docs_reviewing") && (
            <div>
              {!showRevisionDlg ? (
                <button style={rv.revisionBtn} onClick={()=>setShowRevisionDlg(true)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Request document revision
                </button>
              ) : (
                <div style={{...rv.confirmDlg,borderColor:"rgba(245,158,11,0.3)",background:"rgba(245,158,11,0.05)"}}>
                  <div style={{fontSize:12,fontWeight:500,color:"#fff",marginBottom:6}}>Tell the trader what needs to be fixed</div>
                  <textarea style={{...rv.noteTextarea,minHeight:70}} value={revisionNote} onChange={e=>setRevisionNote(e.target.value)} placeholder="e.g. Commercial invoice missing seller signature. Certificate of origin appears expired. Please re-upload valid versions."/>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <button style={rv.revisionYesBtn} onClick={requestRevision} disabled={loading||!revisionNote.trim()}>{loading?"Sending…":"Send revision request"}</button>
                    <button style={rv.cancelDlgBtn} onClick={()=>setShowRevisionDlg(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cancel booking */}
          {!["confirmed","delivered","cancelled"].includes(booking.status)&&(
            <button style={rv.rejectBtn} onClick={rejectBooking}>Cancel booking</button>
          )}

          {/* Already confirmed */}
          {booking.status==="confirmed"&&(
            <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:9,padding:"12px 16px",textAlign:"center"}}>
              <div style={{fontSize:14,color:"#10b981",fontWeight:500,marginBottom:3}}>✓ Booking confirmed</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Reviewed {booking.reviewed_at?new Date(booking.reviewed_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):""}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const pg: Record<string,React.CSSProperties> = {
  page:          { background:"#0a0a0f", minHeight:"100vh", color:"#fff", fontFamily:"system-ui,sans-serif", padding:"24px 26px", display:"flex", flexDirection:"column", gap:16 },
  pageHeader:    { display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 },
  pageTitle:     { fontSize:22, fontWeight:700, color:"#fff", marginBottom:3 },
  pageSub:       { fontSize:12, color:"rgba(255,255,255,0.35)" },
  alertBanner:   { display:"flex", alignItems:"center", gap:10, background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.2)", borderRadius:9, padding:"9px 14px", maxWidth:400 },
  alertDot:      { width:7, height:7, borderRadius:"50%", background:"#a855f7", flexShrink:0 },
  alertBtn:      { fontSize:11, color:"#a855f7", background:"none", border:"none", cursor:"pointer", fontWeight:500, whiteSpace:"nowrap" },
  filterRow:     { display:"flex", gap:6, flexWrap:"wrap" },
  filterTab:     { fontSize:11, padding:"5px 12px", borderRadius:20, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.4)", cursor:"pointer", display:"flex", alignItems:"center", gap:5 },
  filterTabActive:{ borderColor:"rgba(168,85,247,0.4)", background:"rgba(168,85,247,0.12)", color:"#c084fc" },
  filterDot:     { width:6, height:6, borderRadius:"50%", background:"#a855f7" },
  layout:        { display:"grid", gridTemplateColumns:"320px 1fr", gap:16, flex:1, alignItems:"flex-start" },
  listCol:       { display:"flex", flexDirection:"column", gap:4 },
  groupLabel:    { display:"flex", alignItems:"center", gap:6, fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:".08em", padding:"10px 0 4px" },
  statusDot:     { width:6, height:6, borderRadius:"50%", flexShrink:0 },
  bookingCard:   { background:"#13131e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"12px 14px", cursor:"pointer", transition:"all .12s" },
  bookingCardActive:{ borderColor:"rgba(168,85,247,0.4)", background:"rgba(168,85,247,0.07)" },
  bookingTop:    { display:"flex", alignItems:"center", gap:6, marginBottom:6 },
  statusPill:    { fontSize:10, padding:"2px 7px", borderRadius:9, fontWeight:500 },
  docPill:       { display:"flex", alignItems:"center", gap:3, fontSize:10, padding:"1px 6px", borderRadius:9, background:"rgba(59,130,246,0.12)", color:"#3b82f6", marginLeft:"auto" },
  bookingRoute:  { fontSize:13, fontWeight:500, color:"#fff", marginBottom:4 },
  bookingMeta:   { display:"flex", gap:8, fontSize:10, color:"rgba(255,255,255,0.35)", flexWrap:"wrap" },
  skRow:         { height:80, background:"rgba(255,255,255,0.04)", borderRadius:10, marginBottom:4 },
  empty:         { display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 0", textAlign:"center" },
  reviewCol:     { background:"#13131e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden", position:"sticky", top:16 },
  reviewPlaceholder:{ display:"flex", flexDirection:"column", alignItems:"center", padding:"60px 24px", textAlign:"center" },
}

const rv: Record<string,React.CSSProperties> = {
  panel:         { display:"flex", flexDirection:"column" },
  panelHeader:   { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.07)" },
  panelTitle:    { fontSize:15, fontWeight:600, color:"#fff", marginBottom:2 },
  panelSub:      { fontSize:11, color:"rgba(255,255,255,0.35)" },
  closeBtn:      { width:26, height:26, borderRadius:6, background:"rgba(255,255,255,0.06)", border:"none", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" },
  panelBody:     { padding:"0 20px 20px", overflowY:"auto", maxHeight:"calc(92vh - 120px)", display:"flex", flexDirection:"column", gap:16 },
  section:       { paddingTop:16 },
  sectionTitle:  { fontSize:11, fontWeight:700, color:"rgba(168,85,247,0.7)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:10, display:"flex", alignItems:"center", gap:6 },
  docCard:       { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:9, padding:"12px 14px", marginBottom:8 },
  docVerified:   { borderColor:"rgba(16,185,129,0.25)", background:"rgba(16,185,129,0.04)" },
  docIssues:     { borderColor:"rgba(239,68,68,0.25)", background:"rgba(239,68,68,0.04)" },
  viewBtn:       { display:"flex", alignItems:"center", gap:5, fontSize:11, padding:"5px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.5)", cursor:"pointer" },
  verifyBtn:     { fontSize:11, padding:"5px 10px", borderRadius:7, border:"1px solid rgba(16,185,129,0.2)", background:"rgba(16,185,129,0.08)", color:"rgba(16,185,129,0.6)", cursor:"pointer" },
  verifyBtnActive:{ borderColor:"rgba(16,185,129,0.5)", background:"rgba(16,185,129,0.2)", color:"#10b981", fontWeight:600 },
  issuesBtn:     { fontSize:11, padding:"5px 10px", borderRadius:7, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.07)", color:"rgba(239,68,68,0.6)", cursor:"pointer" },
  issuesBtnActive:{ borderColor:"rgba(239,68,68,0.5)", background:"rgba(239,68,68,0.15)", color:"#ef4444", fontWeight:600 },
  noteInput:     { width:"100%", height:34, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:7, padding:"0 10px", color:"#fff", fontSize:12, outline:"none" },
  noteTextarea:  { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, padding:"8px 10px", color:"#fff", fontSize:12, outline:"none", resize:"vertical", lineHeight:1.5, minHeight:60 },
  saveBtn:       { fontSize:11, color:"rgba(255,255,255,0.4)", background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, padding:"5px 12px", cursor:"pointer", marginTop:8 },
  actionSection: { display:"flex", flexDirection:"column", gap:10, paddingTop:4 },
  confirmBtn:    { width:"100%", height:44, background:"#10b981", border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 },
  revisionBtn:   { width:"100%", height:40, background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:9, color:"#f59e0b", fontSize:13, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 },
  rejectBtn:     { width:"100%", height:36, background:"none", border:"1px solid rgba(239,68,68,0.2)", borderRadius:9, color:"rgba(239,68,68,0.5)", fontSize:12, cursor:"pointer" },
  confirmDlg:    { background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:9, padding:"14px 16px" },
  confirmYesBtn: { height:36, padding:"0 16px", background:"#10b981", border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" },
  revisionYesBtn:{ height:36, padding:"0 16px", background:"#f59e0b", border:"none", borderRadius:7, color:"#000", fontSize:12, fontWeight:600, cursor:"pointer" },
  cancelDlgBtn:  { height:36, padding:"0 14px", background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, color:"rgba(255,255,255,0.4)", fontSize:12, cursor:"pointer" },
}
