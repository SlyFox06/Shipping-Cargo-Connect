// src/components/trader/BookingModal.tsx
// 4-step booking modal — Step 2 is now Document Upload.
// Trader must upload all mandatory docs before submitting booking.

import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { CargoTypeSelect } from "@/components/shared/PortCargoDropdowns"
import { BookingDocUpload } from "@/components/trader/BookingDocUpload"
import type { UploadedDoc } from "@/components/trader/BookingDocUpload"

interface Container {
  id:string; origin:string; destination:string; departure_date:string; arrival_date?:string
  available_cbm:number; max_cbm:number; max_weight_kg:number
  price_per_cbm:number; price_per_kg?:number; container_type:string
  refrigerated:boolean; status:string; provider_id:string
  required_documents?: any[]
  offers_first_mile?:boolean; offers_last_mile?:boolean
  first_mile_base_price?:number; last_mile_base_price?:number
  notes?:string
}

interface Props {
  open:boolean; onClose:()=>void; onSuccess?:()=>void
  container:Container|null; traderId?:string
}

const INCOTERMS = ["EXW","FCA","CPT","CIP","DAP","DPU","DDP","FOB","CFR","CIF"]
const fmt       = (n:number) => "$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
const daysUntil = (d:string) => Math.max(0,Math.ceil((new Date(d).getTime()-Date.now())/86400000))

export function BookingModal({ open, onClose, onSuccess, container, traderId }: Props) {
  const [step, setStep] = useState(1)

  // Step 1 — Cargo
  const [cargoType,    setCargoType]    = useState("general")
  const [cargoDesc,    setCargoDesc]    = useState("")
  const [weightKg,     setWeightKg]     = useState("")
  const [cbm,          setCbm]          = useState("")
  const [pieces,       setPieces]       = useState("")
  const [fragile,      setFragile]      = useState(false)
  const [dangerous,    setDangerous]    = useState(false)
  const [requiresTemp, setRequiresTemp] = useState(false)
  const [tempMin,      setTempMin]      = useState("")
  const [tempMax,      setTempMax]      = useState("")

  // Step 2 — Documents
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [draftBookingId, setDraftBookingId] = useState<string|null>(null)

  // Step 3 — Logistics
  const [incoterms,    setIncoterms]    = useState("FOB")
  const [pickupAddr,   setPickupAddr]   = useState("")
  const [deliveryAddr, setDeliveryAddr] = useState("")
  const [firstMile,    setFirstMile]    = useState(false)
  const [lastMile,     setLastMile]     = useState(false)
  const [specialInstr, setSpecialInstr] = useState("")

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const [booked,  setBooked]  = useState(false)

  useEffect(() => {
    if (!open) setTimeout(() => {
      setStep(1); setCargoType("general"); setCargoDesc(""); setWeightKg(""); setCbm(""); setPieces("")
      setFragile(false); setDangerous(false); setRequiresTemp(false)
      setIncoterms("FOB"); setPickupAddr(""); setDeliveryAddr(""); setFirstMile(false); setLastMile(false)
      setSpecialInstr(""); setUploadedDocs([]); setDraftBookingId(null)
      setError(""); setBooked(false)
    }, 200)
  }, [open])

  if (!open || !container) return null

  const requiredDocs = container.required_documents ?? []
  const mandatoryDocs = requiredDocs.filter((d:any) => d.mandatory)
  const uploadedMandatoryIds = uploadedDocs.map(u => u.docId)
  const allMandatoryUploaded = mandatoryDocs.every((d:any) => uploadedMandatoryIds.includes(d.id))
  const docsRequired = mandatoryDocs.length > 0

  // Price calc
  const cbmNum    = parseFloat(cbm)    || 0
  const weightNum = parseFloat(weightKg) || 0
  const cbmCost   = cbmNum * (container.price_per_cbm ?? 0)
  const kgCost    = weightNum * (container.price_per_kg ?? 0)
  const fmCost    = firstMile && container.offers_first_mile ? (container.first_mile_base_price ?? 0) : 0
  const lmCost    = lastMile  && container.offers_last_mile  ? (container.last_mile_base_price  ?? 0) : 0
  const total     = cbmCost + kgCost + fmCost + lmCost
  const exceedsCBM    = cbmNum > container.available_cbm
  const exceedsWeight = weightNum > container.max_weight_kg
  const step1Valid    = cbmNum > 0 && !exceedsCBM && !exceedsWeight

  // Create a draft booking to attach docs to
  const ensureDraftBooking = async (): Promise<string|null> => {
    if (draftBookingId) return draftBookingId
    if (!traderId) return null
    try {
      const { data, error: e } = await supabase.from("bookings").insert({
        trader_id: traderId, provider_id: container.provider_id,
        container_id: container.id, origin: container.origin, destination: container.destination,
        departure_date: container.departure_date, cargo_type: cargoType,
        weight_kg: weightNum, cbm: cbmNum, total_price: total,
        status: "docs_pending",
      }).select("id").single()
      if (e) throw e
      setDraftBookingId(data.id)
      return data.id
    } catch(e:any) { setError(e?.message ?? "Could not create booking draft."); return null }
  }

  const handleAdvanceToDocuments = async () => {
    if (!step1Valid) return
    const id = await ensureDraftBooking()
    if (id) setStep(2)
  }

  const handleSubmit = async () => {
    if (!draftBookingId) { setError("Draft booking not found."); return }
    setLoading(true); setError("")
    try {
      // Update draft booking with full details + uploaded docs
      const { error: dbErr } = await supabase.from("bookings").update({
        cargo_type: cargoType, cargo_description: cargoDesc || null,
        weight_kg: weightNum, cbm: cbmNum,
        pieces: parseInt(pieces) || null,
        fragile, dangerous, requires_temp_control: requiresTemp,
        temp_min: requiresTemp ? parseFloat(tempMin) : null,
        temp_max: requiresTemp ? parseFloat(tempMax) : null,
        incoterms, pickup_address: firstMile ? pickupAddr : null,
        delivery_address: lastMile ? deliveryAddr : null,
        first_mile_type: firstMile ? "provider_pickup" : "self_dropoff",
        last_mile_type:  lastMile  ? "provider_delivery" : "self_pickup",
        first_mile_price: fmCost, last_mile_price: lmCost,
        special_instructions: specialInstr || null,
        uploaded_documents: uploadedDocs,
        docs_submitted_at: new Date().toISOString(),
        total_price: total,
        // If no docs required → go straight to pending (provider just reviews manually)
        // If docs uploaded → docs_submitted (provider reviews docs then confirms)
        status: docsRequired ? "docs_submitted" : "pending",
      }).eq("id", draftBookingId)
      if (dbErr) throw dbErr

      // Update available CBM
      await supabase.from("containers").update({ available_cbm: Math.max(0, container.available_cbm - cbmNum) }).eq("id", container.id)

      // Notify provider
      await supabase.from("notifications").insert({
        user_id: container.provider_id,
        type: docsRequired ? "docs_submitted" : "booking_pending",
        title: docsRequired ? "Documents submitted for review" : "New booking request",
        message: `${container.origin?.split(",")[0]} → ${container.destination?.split(",")[0]} · ${cbmNum} CBM`,
        booking_id: draftBookingId,
      }).catch(() => {}) // non-fatal

      setBooked(true)
    } catch(e:any) { setError(e?.message ?? "Booking submission failed.") }
    finally { setLoading(false) }
  }

  const days = daysUntil(container.departure_date)

  // ── Success screen ──
  if (booked) {
    return (
      <div style={b.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
        <div style={{...b.modal, maxWidth:480}}>
          <div style={{padding:40,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(16,185,129,0.15)",border:"2px solid rgba(16,185,129,0.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div style={{fontSize:20,fontWeight:700,color:"#fff"}}>Booking submitted!</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",lineHeight:1.6,maxWidth:340}}>
              {docsRequired
                ? `Your documents have been sent to the provider for review. You'll be notified once they verify your docs and confirm the booking.`
                : `Your booking request is pending provider approval. You'll be notified once confirmed.`
              }
            </div>
            {docsRequired && (
              <div style={{background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:9,padding:"10px 16px",width:"100%"}}>
                <div style={{fontSize:12,fontWeight:500,color:"#a855f7",marginBottom:6}}>Documents submitted</div>
                {uploadedDocs.map((d,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{d.docName}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"12px 20px",width:"100%"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Route</span><span style={{fontSize:12,color:"#fff"}}>{container.origin?.split(",")[0]} → {container.destination?.split(",")[0]}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Cargo</span><span style={{fontSize:12,color:"#fff"}}>{cbm} CBM · {weightKg} kg</span></div>
              <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid rgba(255,255,255,0.07)",marginTop:8,paddingTop:8}}><span style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.6)"}}>Total</span><span style={{fontSize:16,fontWeight:700,color:"#a855f7"}}>{fmt(total)}</span></div>
            </div>
            <button style={{width:"100%",height:42,background:"#7c3aed",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}} onClick={()=>{onSuccess?.();onClose()}}>View my bookings →</button>
          </div>
        </div>
      </div>
    )
  }

  const STEP_LABELS = docsRequired
    ? ["Cargo details","Upload documents","Logistics","Confirm"]
    : ["Cargo details","Logistics","Confirm"]
  const effectiveStep = docsRequired ? step : step >= 2 ? step - 1 : step

  return (
    <div style={b.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={b.modal}>

        {/* Header */}
        <div style={b.header}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={b.headerIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
            <div>
              <div style={b.headerTitle}>{container.origin?.split(",")[0]} → {container.destination?.split(",")[0]}</div>
              <div style={b.headerSub}>{container.container_type?.replace(/_/g," ")} · ${container.price_per_cbm}/CBM · {days===0?"Today":days===1?"Tomorrow":`${days} days`}</div>
            </div>
          </div>
          <button style={b.closeBtn} onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        {/* Step tabs */}
        <div style={b.stepTabs}>
          {STEP_LABELS.map((label,i)=>{
            const n=i+1
            return(
              <div key={n} style={{...b.stepTab,...(step===n||(!docsRequired&&step===n+1-1)?b.stepTabActive:{})}} onClick={()=>{if(n<step)setStep(n)}}>
                <div style={{...b.stepNum,background:step>n?"#10b981":step===n?"#7c3aed":"rgba(255,255,255,0.08)"}}>
                  {step>n?<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>:<span style={{fontSize:10,fontWeight:600,color:step>=n?"#fff":"rgba(255,255,255,0.3)"}}>{n}</span>}
                </div>
                <span style={{color:step===n?"#fff":"rgba(255,255,255,0.35)",fontSize:12}}>{label}</span>
              </div>
            )
          })}
        </div>

        {/* Container info strip */}
        <div style={b.strip}>
          {[
            {l:"Available",v:`${container.available_cbm?.toFixed(1)} CBM`},
            {l:"Max weight",v:`${(container.max_weight_kg/1000).toFixed(0)}t`},
            {l:"Departs",v:new Date(container.departure_date).toLocaleDateString("en-GB",{day:"numeric",month:"short"}),c:days<=3?"#ef4444":days<=7?"#f59e0b":"#fff"},
            {l:"Rate",v:`$${container.price_per_cbm}/CBM`,c:"#a855f7"},
          ].map((it,i)=>(
            <div key={i} style={b.stripItem}>
              {i>0&&<div style={b.stripDiv}/>}
              <div style={b.stripInner}>
                <div style={b.stripLabel}>{it.l}</div>
                <div style={{...b.stripVal,color:it.c??"#fff"}}>{it.v}</div>
              </div>
            </div>
          ))}
          {container.refrigerated&&<div style={b.stripItem}><div style={b.stripDiv}/><div style={b.stripInner}><div style={{fontSize:12,color:"#60a5fa"}}>❄ Reefer</div></div></div>}
        </div>

        <div style={b.body}>

          {/* ── STEP 1: Cargo details ── */}
          {step === 1 && (
            <div style={b.stepBody}>
              <div style={b.sLabel}>Cargo type</div>
              <CargoTypeSelect value={cargoType} onChange={setCargoType} showAllOption={false}/>
              <BField label="Cargo description (optional)"><input style={b.input} placeholder="e.g. Cotton fabric rolls, 200 bales" value={cargoDesc} onChange={e=>setCargoDesc(e.target.value)}/></BField>
              <div style={{display:"flex",gap:10}}>
                <BField label="Volume (CBM) *">
                  <div style={b.iWrap}><input style={{...b.input,...(exceedsCBM?{borderColor:"rgba(239,68,68,0.5)"}:{})}} type="number" min="0.1" step="0.1" placeholder="e.g. 5.0" value={cbm} onChange={e=>setCbm(e.target.value)}/><span style={b.unit}>CBM</span></div>
                  {exceedsCBM&&<div style={{fontSize:10,color:"#ef4444",marginTop:2}}>Exceeds available space ({container.available_cbm} CBM)</div>}
                  {cbmNum>0&&!exceedsCBM&&<div style={{fontSize:10,color:"#10b981",marginTop:2}}>✓ {((cbmNum/container.available_cbm)*100).toFixed(0)}% of available</div>}
                </BField>
                <BField label="Weight (kg) *">
                  <div style={b.iWrap}><input style={{...b.input,...(exceedsWeight?{borderColor:"rgba(239,68,68,0.5)"}:{})}} type="number" min="1" placeholder="e.g. 3500" value={weightKg} onChange={e=>setWeightKg(e.target.value)}/><span style={b.unit}>kg</span></div>
                  {exceedsWeight&&<div style={{fontSize:10,color:"#ef4444",marginTop:2}}>Exceeds max ({container.max_weight_kg.toLocaleString()} kg)</div>}
                </BField>
                <BField label="Pieces"><input style={b.input} type="number" min="1" placeholder="e.g. 45" value={pieces} onChange={e=>setPieces(e.target.value)}/></BField>
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {[{l:"Fragile",c:"#a855f7",v:fragile,s:setFragile},{l:"Dangerous (DG)",c:"#ef4444",v:dangerous,s:setDangerous},{l:"Temp. controlled",c:"#60a5fa",v:requiresTemp,s:setRequiresTemp}].map(f=>(
                  <label key={f.l} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:12,color:f.v?f.c:"rgba(255,255,255,0.5)"}}><input type="checkbox" checked={f.v} onChange={e=>f.s(e.target.checked)} style={{accentColor:f.c}}/>{f.l}</label>
                ))}
              </div>
              {requiresTemp&&(
                <div style={{display:"flex",gap:10}}>
                  <BField label="Min temp (°C)"><input style={b.input} type="number" placeholder="-18" value={tempMin} onChange={e=>setTempMin(e.target.value)}/></BField>
                  <BField label="Max temp (°C)"><input style={b.input} type="number" placeholder="4"   value={tempMax} onChange={e=>setTempMax(e.target.value)}/></BField>
                </div>
              )}
              {dangerous&&<div style={{display:"flex",gap:8,alignItems:"flex-start",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:8,padding:"9px 12px",fontSize:11,color:"rgba(245,158,11,0.85)"}}><span>⚠</span><span>DG cargo requires MSDS and UN packing documentation. Ensure the container is DG certified.</span></div>}
              {docsRequired&&(
                <div style={{background:"rgba(168,85,247,0.07)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:9,padding:"10px 14px"}}>
                  <div style={{fontSize:12,fontWeight:500,color:"#a855f7",marginBottom:4}}>📎 {mandatoryDocs.length} document{mandatoryDocs.length!==1?"s":""} required for this container</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.5}}>The next step will ask you to upload: {mandatoryDocs.slice(0,3).map((d:any)=>d.name).join(", ")}{mandatoryDocs.length>3?` and ${mandatoryDocs.length-3} more`:""}</div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Document Upload (only if docs required) ── */}
          {step === 2 && docsRequired && (
            <div style={b.stepBody}>
              <div style={{background:"rgba(168,85,247,0.07)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:600,color:"#fff",marginBottom:3}}>Upload required documents</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.6}}>
                  The provider requires these documents before confirming your booking.
                  Upload all <strong style={{color:"#ef4444"}}>mandatory</strong> documents to proceed.
                  {uploadedDocs.length>0&&` You've uploaded ${uploadedDocs.length} so far.`}
                </div>
              </div>
              <BookingDocUpload
                requiredDocs={requiredDocs}
                bookingId={draftBookingId ?? "draft"}
                traderId={traderId ?? ""}
                onComplete={setUploadedDocs}
              />
              {allMandatoryUploaded && (
                <div style={{display:"flex",gap:8,alignItems:"center",background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:8,padding:"10px 14px",marginTop:4}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span style={{fontSize:12,color:"#10b981",fontWeight:500}}>All mandatory documents uploaded — you can proceed to the next step.</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3 (or 2 if no docs): Logistics ── */}
          {((step === 3 && docsRequired) || (step === 2 && !docsRequired)) && (
            <div style={b.stepBody}>
              <BField label="Incoterms">
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {INCOTERMS.map(t=><button key={t} style={{...b.incoBtn,...(incoterms===t?b.incoBtnActive:{})}} onClick={()=>setIncoterms(t)}>{t}</button>)}
                </div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:5}}>{incoterms==="FOB"?"Seller delivers at port of loading. You cover freight and insurance.":incoterms==="DDP"?"Seller delivers to your door, all duties paid.":incoterms==="EXW"?"You collect from seller's premises.":"Standard trade term for this shipment."}</div>
              </BField>
              {[{avail:container.offers_first_mile,label:"🚛 Pickup service",price:container.first_mile_base_price,enabled:firstMile,setEnabled:setFirstMile,addr:pickupAddr,setAddr:setPickupAddr,addrLabel:"Pickup address"},{avail:container.offers_last_mile,label:"🏭 Delivery service",price:container.last_mile_base_price,enabled:lastMile,setEnabled:setLastMile,addr:deliveryAddr,setAddr:setDeliveryAddr,addrLabel:"Delivery address"}].map((ms,i)=>(
                ms.avail
                  ? <div key={i} style={{...b.mileCard,...(ms.enabled?b.mileCardActive:{})}} onClick={()=>ms.setEnabled((p:boolean)=>!p)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ms.enabled?10:0}}>
                        <div><div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{ms.label}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>${ms.price} base</div></div>
                        <div style={{width:28,height:15,borderRadius:8,background:ms.enabled?"#7c3aed":"rgba(255,255,255,0.08)"}}/>
                      </div>
                      {ms.enabled&&<div onClick={e=>e.stopPropagation()}><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4}}>{ms.addrLabel}</div><input style={b.input} placeholder="Full address" value={ms.addr} onChange={e=>ms.setAddr(e.target.value)}/></div>}
                    </div>
                  : <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:9,padding:"10px 14px"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>{ms.label} not available on this container</div></div>
              ))}
              <BField label="Special instructions"><textarea style={b.textarea} rows={3} value={specialInstr} onChange={e=>setSpecialInstr(e.target.value)} placeholder="Stacking restrictions, handling, delivery time preferences…"/></BField>
            </div>
          )}

          {/* ── STEP 4 (or 3): Review & confirm ── */}
          {((step === 4 && docsRequired) || (step === 3 && !docsRequired)) && (
            <div style={b.stepBody}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <div style={b.summaryCard}>
                  <div style={b.summaryTitle}>Cargo</div>
                  {[["Type",cargoType],["Volume",`${cbm} CBM`],["Weight",`${parseInt(weightKg||"0").toLocaleString()} kg`],fragile?["Handling","Fragile"]:null,dangerous?["Class","Dangerous goods"]:null].filter(Boolean).map((r:any,i:number)=>(
                    <div key={i} style={b.sumRow}><span style={{color:"rgba(255,255,255,0.4)"}}>{r[0]}</span><span style={{color:r[0]==="Class"?"#ef4444":r[0]==="Handling"?"#a855f7":"rgba(255,255,255,0.7)"}}>{r[1]}</span></div>
                  ))}
                </div>
                <div style={b.summaryCard}>
                  <div style={b.summaryTitle}>Documents</div>
                  {uploadedDocs.length>0
                    ? uploadedDocs.map((d,i)=>(
                        <div key={i} style={{...b.sumRow}}>
                          <span style={{color:"rgba(255,255,255,0.4)",fontSize:11}}>{d.docName}</span>
                          <span style={{fontSize:11,color:"#10b981"}}>✓ Uploaded</span>
                        </div>
                      ))
                    : <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>No documents required</div>
                  }
                </div>
              </div>
              <div style={b.priceBreakdown}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(168,85,247,0.7)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Price breakdown</div>
                {[
                  [`Freight (${cbm} CBM × $${container.price_per_cbm})`, cbmCost],
                  kgCost>0?[`Weight (${weightKg}kg × $${container.price_per_kg})`, kgCost]:null,
                  fmCost>0?["Pickup service", fmCost]:null,
                  lmCost>0?["Delivery service", lmCost]:null,
                ].filter(Boolean).map((r:any,i:number)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:5}}><span>{r[0]}</span><span>{fmt(r[1])}</span></div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid rgba(168,85,247,0.2)",marginTop:8,paddingTop:10}}>
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>Total</span>
                  <span style={{fontSize:20,fontWeight:700,color:"#a855f7"}}>{fmt(total)}</span>
                </div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:5}}>
                  {docsRequired?"Provider will review your documents and confirm within 24h.":"Provider will review your booking and confirm within 24h."}
                </div>
              </div>
            </div>
          )}
        </div>

        {error&&<div style={{margin:"0 20px 12px",padding:"9px 12px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,fontSize:12,color:"#ef4444",display:"flex",gap:7,alignItems:"center"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>{error}</div>}

        <div style={b.footer}>
          <button style={b.cancelBtn} onClick={step===1?onClose:()=>setStep(s=>s-1)}>{step===1?"Cancel":"← Back"}</button>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {total>0&&step>1&&<div style={{fontSize:13,fontWeight:600,color:"#a855f7"}}>{fmt(total)}</div>}
            {(() => {
              const isLastStep = (docsRequired && step === 4) || (!docsRequired && step === 3)
              const isDocStep  = docsRequired && step === 2
              if (isLastStep) return(
                <button style={{...b.nextBtn,background:loading?"rgba(124,58,237,0.5)":"#7c3aed",minWidth:150}} onClick={handleSubmit} disabled={loading}>
                  {loading?<><div style={b.spin}/>Submitting…</>:<>✦ Submit booking</>}
                </button>
              )
              if (step===1) return(
                <button style={{...b.nextBtn,opacity:step1Valid?1:0.4}} disabled={!step1Valid} onClick={docsRequired?handleAdvanceToDocuments:()=>setStep(2)}>
                  {docsRequired?"Next: Upload docs →":"Next →"}
                </button>
              )
              if (isDocStep) return(
                <button style={{...b.nextBtn,opacity:allMandatoryUploaded?1:0.4,background:allMandatoryUploaded?"#7c3aed":"rgba(255,255,255,0.1)"}} disabled={!allMandatoryUploaded} onClick={()=>setStep(3)}>
                  {allMandatoryUploaded?"Next: Logistics →":"Upload mandatory docs first"}
                </button>
              )
              return <button style={b.nextBtn} onClick={()=>setStep(s=>s+1)}>Review booking →</button>
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

function BField({ label, children }: { label:string; children:React.ReactNode }) {
  return <div style={{display:"flex",flexDirection:"column",gap:5,flex:1}}><div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{label}</div>{children}</div>
}

const b: Record<string,React.CSSProperties> = {
  overlay:       { position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 },
  modal:         { background:"#13131e",border:"1px solid rgba(168,85,247,0.2)",borderRadius:14,width:"100%",maxWidth:700,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden" },
  header:        { display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)" },
  headerIcon:    { width:32,height:32,borderRadius:8,background:"rgba(168,85,247,0.15)",display:"flex",alignItems:"center",justifyContent:"center" },
  headerTitle:   { fontSize:15,fontWeight:700,color:"#fff" },
  headerSub:     { fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1 },
  closeBtn:      { width:28,height:28,borderRadius:7,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" },
  stepTabs:      { display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)" },
  stepTab:       { flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px 0",cursor:"pointer",transition:"background .12s" },
  stepTabActive: { background:"rgba(168,85,247,0.06)" },
  stepNum:       { width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 },
  strip:         { display:"flex",alignItems:"center",background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)" },
  stripItem:     { display:"flex",alignItems:"center",flex:1 },
  stripDiv:      { width:1,height:32,background:"rgba(255,255,255,0.07)",flexShrink:0 },
  stripInner:    { display:"flex",flexDirection:"column",gap:2,padding:"8px 14px",flex:1 },
  stripLabel:    { fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".06em" },
  stripVal:      { fontSize:12,fontWeight:500 },
  body:          { flex:1,overflowY:"auto",display:"flex",flexDirection:"column" },
  stepBody:      { padding:"16px 20px",display:"flex",flexDirection:"column",gap:12 },
  sLabel:        { fontSize:10,fontWeight:700,color:"rgba(168,85,247,0.7)",textTransform:"uppercase",letterSpacing:".08em" },
  input:         { height:36,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"0 10px",color:"#fff",fontSize:12,outline:"none",colorScheme:"dark",width:"100%" },
  iWrap:         { position:"relative",display:"flex",alignItems:"center" },
  unit:          { position:"absolute",right:10,fontSize:11,color:"rgba(168,85,247,0.6)",pointerEvents:"none" },
  textarea:      { background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"10px 12px",color:"#fff",fontSize:12,outline:"none",resize:"vertical",lineHeight:1.5,width:"100%" },
  incoBtn:       { fontSize:11,padding:"5px 10px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)",cursor:"pointer" },
  incoBtnActive: { borderColor:"rgba(168,85,247,0.4)",background:"rgba(168,85,247,0.12)",color:"#c084fc" },
  mileCard:      { background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"12px 14px",cursor:"pointer" },
  mileCardActive:{ borderColor:"rgba(168,85,247,0.35)",background:"rgba(168,85,247,0.07)" },
  summaryCard:   { background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 14px" },
  summaryTitle:  { fontSize:10,fontWeight:700,color:"rgba(168,85,247,0.7)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:8 },
  sumRow:        { display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:4 },
  priceBreakdown:{ background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:10,padding:"14px 16px" },
  footer:        { display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderTop:"1px solid rgba(255,255,255,0.07)" },
  cancelBtn:     { fontSize:13,color:"rgba(255,255,255,0.4)",background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 16px",cursor:"pointer" },
  nextBtn:       { fontSize:13,fontWeight:600,background:"#7c3aed",border:"none",borderRadius:8,padding:"9px 22px",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:7 },
  spin:          { width:13,height:13,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.25)",borderTopColor:"#fff" },
}