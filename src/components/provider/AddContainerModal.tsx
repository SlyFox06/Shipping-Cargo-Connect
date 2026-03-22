import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { PortSelect, CargoTypeSelect, PopularRoutePills } from "@/components/shared/PortCargoDropdowns"
import { ContainerDocRequirements } from "@/components/provider/ContainerDocRequirements"
import type { RequiredDoc } from "@/components/provider/ContainerDocRequirements"

const CONTAINER_TYPES = [
  { value:"20ft_standard",  label:"20ft Standard",  icon:"📦", cbm:33,  maxKg:28000, desc:"General use" },
  { value:"40ft_standard",  label:"40ft Standard",  icon:"🚢", cbm:67,  maxKg:30480, desc:"Most common" },
  { value:"40ft_high_cube", label:"40ft High Cube",  icon:"⬆️", cbm:76,  maxKg:30480, desc:"Extra height" },
  { value:"20ft_reefer",    label:"20ft Reefer",     icon:"❄️", cbm:28,  maxKg:27700, desc:"Temperature controlled" },
  { value:"40ft_reefer",    label:"40ft Reefer",     icon:"🧊", cbm:60,  maxKg:27700, desc:"Large cold chain" },
  { value:"flat_rack",      label:"Flat Rack",       icon:"🏗️", cbm:40,  maxKg:40000, desc:"Oversized cargo" },
  { value:"open_top",       label:"Open Top",        icon:"🔓", cbm:66,  maxKg:30480, desc:"Crane loading" },
  { value:"tank",           label:"Tank Container",  icon:"🛢️", cbm:0,   maxKg:0,     desc:"Liquids/gas" },
]
const TRANSPORT_MODES = [
  { value:"sea", label:"Sea freight", icon:"🚢" }, { value:"air", label:"Air freight", icon:"✈️" },
  { value:"rail", label:"Rail freight", icon:"🚂" }, { value:"road", label:"Road freight", icon:"🚛" },
]

// Steps: 1=Route, 2=Container, 3=Documents, 4=Pricing, 5=Review
const STEPS = ["Route","Container","Documents","Pricing","Review"]

interface Props {
  open: boolean; onClose: () => void; onSuccess?: () => void
  providerId?: string; isProviderVerified?: boolean
}

export function AddContainerModal({ open, onClose, onSuccess, providerId }: Props) {
  const [step, setStep] = useState(1)

  // Step 1
  const [origin, setOrigin]               = useState("")
  const [destination, setDestination]     = useState("")
  const [departureDate, setDepartureDate] = useState("")
  const [arrivalDate, setArrivalDate]     = useState("")
  const [transportMode, setTransportMode] = useState("sea")
  const [transitPort, setTransitPort]     = useState("")

  // Step 2
  const [containerType, setContainerType] = useState("40ft_standard")
  const [cargoType, setCargoType]         = useState("general")
  const [maxCBM, setMaxCBM]               = useState("")
  const [maxWeightKg, setMaxWeightKg]     = useState("")
  const [refrigerated, setRefrigerated]   = useState(false)
  const [hazmat, setHazmat]               = useState(false)
  const [acceptsPartial, setAcceptsPartial] = useState(true)
  const [minBookingCBM, setMinBookingCBM] = useState("1")

  // Step 3 — Document requirements
  const [requiredDocs, setRequiredDocs]   = useState<RequiredDoc[]>([])

  // Step 4
  const [pricePerCBM, setPricePerCBM]     = useState("")
  const [pricePerKg, setPricePerKg]       = useState("")
  const [aiPrice, setAiPrice]             = useState<any>(null)
  const [aiLoading, setAiLoading]         = useState(false)
  const [aiTransitLoading, setAiTransitLoading] = useState(false)
  const [notes, setNotes]                 = useState("")
  const [offersFirstMile, setOffersFirstMile] = useState(false)
  const [offersLastMile, setOffersLastMile]   = useState(false)
  const [firstMilePrice, setFirstMilePrice]   = useState("")
  const [lastMilePrice, setLastMilePrice]     = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  useEffect(() => {
    if (!open) setTimeout(() => { setStep(1); setOrigin(""); setDestination(""); setDepartureDate(""); setArrivalDate(""); setContainerType("40ft_standard"); setCargoType("general"); setMaxCBM(""); setMaxWeightKg(""); setRefrigerated(false); setHazmat(false); setPricePerCBM(""); setAiPrice(null); setNotes(""); setRequiredDocs([]); setError("") }, 200)
  }, [open])

  useEffect(() => {
    const ct = CONTAINER_TYPES.find(c => c.value === containerType)
    if (ct) { if (!maxCBM) setMaxCBM(String(ct.cbm)); if (!maxWeightKg) setMaxWeightKg(String(ct.maxKg)); if (ct.value.includes("reefer")) setRefrigerated(true) }
  }, [containerType])

  const fetchAIPrice = async () => {
    if (!origin || !destination || !departureDate) return
    setAiLoading(true)
    try {
      const { data } = await supabase.functions.invoke("predict-price-ai", { body: { origin, destination, cargoType, weightKg: parseFloat(maxWeightKg)||20000, cbm: parseFloat(maxCBM)||40, departureDate } })
      if (data) { setAiPrice(data); if (!pricePerCBM) setPricePerCBM(String(data.recommended ?? "")) }
    } catch(e) { console.error(e) } finally { setAiLoading(false) }
  }

  // Auto-calculate arrival date when route & date are selected
  useEffect(() => {
    let active = true
    if (origin && destination && departureDate && transportMode) {
      setAiTransitLoading(true)
      supabase.functions.invoke("predict-price-ai", { body: { origin, destination, cargoType: "general", weightKg: 20000, cbm: 40, departureDate, transportMode } })
        .then(({ data }) => {
          if (!active) return
          if (data?.estimatedDaysTransit) {
            const d = new Date(departureDate)
            d.setDate(d.getDate() + data.estimatedDaysTransit)
            setArrivalDate(d.toISOString().split("T")[0])
          }
          setAiTransitLoading(false)
        })
        .catch(() => { if (active) setAiTransitLoading(false) })
    }
    return () => { active = false }
  }, [origin, destination, departureDate, transportMode])

  const step1Valid = !!(origin && destination && departureDate)
  const step2Valid = !!(containerType && maxCBM && maxWeightKg)
  const step3Valid = true // docs are optional — provider may have no requirements
  const step4Valid = !!pricePerCBM
  const selectedCT = CONTAINER_TYPES.find(c => c.value === containerType)
  const mandatoryDocs = requiredDocs.filter(d => d.mandatory).length

  const handleSubmit = async () => {
    if (!providerId) { setError("Provider ID missing."); return }
    setLoading(true); setError("")
    try {
      const { error: dbErr } = await supabase.from("containers").insert({
        provider_id: providerId, origin, destination,
        departure_date: departureDate, arrival_date: arrivalDate || null,
        transport_mode: transportMode, transit_port: transitPort || null,
        container_type: containerType, cargo_type: cargoType,
        max_cbm: parseFloat(maxCBM), available_cbm: parseFloat(maxCBM),
        max_weight_kg: parseFloat(maxWeightKg),
        refrigerated, hazmat, accepts_partial_bookings: acceptsPartial,
        min_booking_cbm: parseFloat(minBookingCBM) || 1,
        price_per_cbm: parseFloat(pricePerCBM),
        price_per_kg: parseFloat(pricePerKg) || null,
        notes: notes || null, status: "active",
        required_documents: requiredDocs,
        offers_first_mile: offersFirstMile, offers_last_mile: offersLastMile,
        first_mile_base_price: parseFloat(firstMilePrice) || 0,
        last_mile_base_price: parseFloat(lastMilePrice) || 0,
      })
      if (dbErr) throw dbErr
      onSuccess?.(); onClose()
    } catch(e: any) { setError(e?.message ?? "Failed to add container.") }
    finally { setLoading(false) }
  }

  if (!open) return null

  const canNext = (s: number) => (s===1&&step1Valid)||(s===2&&step2Valid)||(s===3&&step3Valid)||(s===4&&step4Valid)||s===5
  const goNext  = () => setStep(s => s + 1)
  const goBack  = () => step === 1 ? onClose() : setStep(s => s - 1)

  return (
    <div style={m.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={m.modal}>

        {/* Header */}
        <div style={m.header}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={m.headerIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
            <div>
              <div style={m.headerTitle}>Add New Container</div>
              <div style={m.headerSub}>Step {step} of {STEPS.length} — {STEPS[step-1]}</div>
            </div>
          </div>
          <button style={m.closeBtn} onClick={onClose}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        {/* Step indicator */}
        <div style={m.stepRow}>
          {STEPS.map((label, i) => {
            const n = i + 1
            return (
              <div key={n} style={m.stepWrap} onClick={() => n < step && setStep(n)}>
                <div style={{ ...m.stepDot, background: n < step ? "#10b981" : n === step ? "#7c3aed" : "rgba(255,255,255,0.08)", cursor: n < step ? "pointer" : "default" }}>
                  {n < step
                    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : <span style={{ fontSize:10, color: n===step?"#fff":"rgba(255,255,255,0.3)", fontWeight:600 }}>{n}</span>
                  }
                </div>
                <div style={{ fontSize:10, color: n<=step?"rgba(168,85,247,0.8)":"rgba(255,255,255,0.2)", whiteSpace:"nowrap" }}>{label}</div>
                {i < STEPS.length-1 && <div style={{ ...m.stepLine, background: n < step ? "#10b981" : "rgba(255,255,255,0.07)" }}/>}
              </div>
            )
          })}
        </div>

        <div style={m.body}>

          {/* ── STEP 1: Route ── */}
          {step === 1 && (
            <div style={m.stepContent}>
              <Label icon="🌍">Route details</Label>
              <div style={{ marginBottom:14 }}>
                <PopularRoutePills onSelect={(o,d)=>{setOrigin(o);setDestination(d)}} activeOrigin={origin} activeDestination={destination}/>
              </div>
              <div style={m.fieldRow}>
                <PortSelect label="Origin port *" value={origin} onChange={setOrigin} placeholder="Select origin…" excludeValue={destination}/>
                <div style={m.swapBtn} onClick={()=>{const t=origin;setOrigin(destination);setDestination(t)}}>⇄</div>
                <PortSelect label="Destination port *" value={destination} onChange={setDestination} placeholder="Select destination…" excludeValue={origin}/>
              </div>
              <div style={m.fieldRow}>
                <Field label="Departure date *"><input type="date" style={m.input} value={departureDate} min={new Date().toISOString().split("T")[0]} onChange={e=>setDepartureDate(e.target.value)}/></Field>
                <Field label="Arrival date (est. auto via AI)">
                  <div style={{display:"flex",gap:6}}>
                    <input type="date" style={{...m.input,flex:1}} value={arrivalDate} min={departureDate} onChange={e=>setArrivalDate(e.target.value)}/>
                    {aiTransitLoading && <div style={{...m.spin, width:18, height:18, borderColor:"#c084fc", borderTopColor:"transparent", alignSelf:"center", marginRight:4}}/>}
                  </div>
                </Field>
              </div>
              <Field label="Transport mode">
                <div style={{ display:"flex", gap:8 }}>
                  {TRANSPORT_MODES.map(t=><button key={t.value} style={{...m.modeBtn,...(transportMode===t.value?m.modeBtnActive:{})}} onClick={()=>setTransportMode(t.value)}>{t.icon} {t.label}</button>)}
                </div>
              </Field>
              {transportMode==="sea"&&<Field label="Transit port (optional)"><input style={m.input} placeholder="e.g. Singapore, Colombo" value={transitPort} onChange={e=>setTransitPort(e.target.value)}/></Field>}
            </div>
          )}

          {/* ── STEP 2: Container & Cargo ── */}
          {step === 2 && (
            <div style={m.stepContent}>
              <Label icon="📦">Container type *</Label>
              <div style={m.containerGrid}>
                {CONTAINER_TYPES.map(ct=>(
                  <div key={ct.value} style={{...m.ctCard,...(containerType===ct.value?m.ctCardActive:{})}} onClick={()=>setContainerType(ct.value)}>
                    <div style={{fontSize:22,marginBottom:4}}>{ct.icon}</div>
                    <div style={{fontSize:11,fontWeight:600,color:containerType===ct.value?"#fff":"rgba(255,255,255,0.7)"}}>{ct.label}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>{ct.desc}</div>
                    {ct.cbm>0&&<div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>{ct.cbm} CBM</div>}
                  </div>
                ))}
              </div>
              <div style={m.fieldRow}>
                <Field label="Total CBM *">
                  <div style={m.inputWrap}><input style={m.input} type="number" value={maxCBM} onChange={e=>setMaxCBM(e.target.value)} placeholder={selectedCT?.cbm?"Auto: "+selectedCT.cbm:""}/><span style={m.unit}>CBM</span></div>
                </Field>
                <Field label="Max weight *">
                  <div style={m.inputWrap}><input style={m.input} type="number" value={maxWeightKg} onChange={e=>setMaxWeightKg(e.target.value)}/><span style={m.unit}>kg</span></div>
                </Field>
              </div>
              <Label icon="🏷️">Cargo type *</Label>
              <CargoTypeSelect value={cargoType} onChange={setCargoType} showAllOption={false} label=""/>
              <div style={m.flagRow}>
                <Chk label="❄ Refrigerated" checked={refrigerated} onChange={setRefrigerated} color="#60a5fa"/>
                <Chk label="⚠ Hazmat/DG certified" checked={hazmat} onChange={setHazmat} color="#ef4444"/>
                <Chk label="✓ Accept partial bookings" checked={acceptsPartial} onChange={setAcceptsPartial} color="#10b981"/>
              </div>
              {acceptsPartial && (
                <Field label="Minimum booking size">
                  <div style={m.inputWrap}><input style={m.input} type="number" min="0.5" step="0.5" value={minBookingCBM} onChange={e=>setMinBookingCBM(e.target.value)}/><span style={m.unit}>CBM</span></div>
                </Field>
              )}
            </div>
          )}

          {/* ── STEP 3: Document Requirements ── */}
          {step === 3 && (
            <div style={m.stepContent}>
              {/* Explanation banner */}
              <div style={m.docBanner}>
                <div style={m.docBannerIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#fff", marginBottom:3 }}>Set document requirements for traders</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", lineHeight:1.6 }}>
                    Traders must upload all <strong style={{color:"#ef4444"}}>mandatory</strong> documents before submitting a booking.
                    You'll review and verify each document before confirming. Optional docs are requested but don't block submission.
                  </div>
                </div>
              </div>

              <ContainerDocRequirements
                value={requiredDocs}
                onChange={setRequiredDocs}
                cargoType={cargoType}
                hazmat={hazmat}
              />

              {/* Skip note */}
              <div style={m.skipNote}>
                {requiredDocs.length === 0
                  ? "💡 You can skip this step — traders won't be required to upload any docs. You can still manually approve bookings."
                  : `✓ ${mandatoryDocs} mandatory · ${requiredDocs.length - mandatoryDocs} optional document${requiredDocs.length!==1?"s":""} required`
                }
              </div>
            </div>
          )}

          {/* ── STEP 4: Pricing ── */}
          {step === 4 && (
            <div style={m.stepContent}>
              <Label icon="💡">AI pricing suggestion</Label>
              <div style={m.aiPriceCard}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{origin?.split(",")[0]} → {destination?.split(",")[0]} · {cargoType}</div>
                  <button style={{...m.aiPriceBtn,opacity:aiLoading?0.6:1}} onClick={fetchAIPrice} disabled={aiLoading||!origin||!destination}>
                    {aiLoading ? <><div style={m.spin}/>Analysing…</> : <>✦ Get AI price</>}
                  </button>
                </div>
                {aiPrice ? (
                  <div>
                    <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                      {[{l:"Market low",v:"$"+aiPrice.min,c:"#10b981"},{l:"Recommended",v:"$"+aiPrice.recommended,c:"#a855f7"},{l:"Market high",v:"$"+aiPrice.max,c:"#ef4444"},{l:"Confidence",v:aiPrice.confidence,c:"rgba(255,255,255,0.5)"}].map(p=>(
                        <div key={p.l} style={{flex:1,background:"rgba(255,255,255,0.04)",borderRadius:7,padding:"8px 10px"}}>
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3}}>{p.l}</div>
                          <div style={{fontSize:13,fontWeight:600,color:p.c}}>{p.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={m.priceApplyBtn} onClick={()=>setPricePerCBM(String(aiPrice.min))}>Use ${aiPrice.min}</button>
                      <button style={{...m.priceApplyBtn,background:"rgba(168,85,247,0.18)",borderColor:"rgba(168,85,247,0.4)",color:"#c084fc"}} onClick={()=>setPricePerCBM(String(aiPrice.recommended))}>✦ Use ${aiPrice.recommended}</button>
                      <button style={m.priceApplyBtn} onClick={()=>setPricePerCBM(String(aiPrice.max))}>Use ${aiPrice.max}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",textAlign:"center",padding:"12px 0"}}>{!origin||!destination?"Complete Step 1 first.":"Click above for live market rate suggestions."}</div>
                )}
              </div>
              <div style={m.fieldRow}>
                <Field label="Price per CBM *">
                  <div style={m.inputWrap}><span style={m.prefix}>$</span><input style={{...m.input,paddingLeft:22}} type="number" value={pricePerCBM} onChange={e=>setPricePerCBM(e.target.value)} placeholder="e.g. 1600"/><span style={m.unit}>/CBM</span></div>
                </Field>
                <Field label="Price per kg (optional)">
                  <div style={m.inputWrap}><span style={m.prefix}>$</span><input style={{...m.input,paddingLeft:22}} type="number" value={pricePerKg} onChange={e=>setPricePerKg(e.target.value)} placeholder="e.g. 0.05"/><span style={m.unit}>/kg</span></div>
                </Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[{label:"🚛 Pickup service",offer:offersFirstMile,setOffer:setOffersFirstMile,price:firstMilePrice,setPrice:setFirstMilePrice},{label:"🏭 Delivery service",offer:offersLastMile,setOffer:setOffersLastMile,price:lastMilePrice,setPrice:setLastMilePrice}].map((ms,i)=>(
                  <div key={i} style={{...m.mileCard,...(ms.offer?m.mileCardActive:{})}} onClick={()=>ms.setOffer(p=>!p)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ms.offer?10:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{ms.label}</div>
                      <div style={{width:26,height:14,borderRadius:7,background:ms.offer?"#7c3aed":"rgba(255,255,255,0.08)"}}/>
                    </div>
                    {ms.offer&&<div onClick={e=>e.stopPropagation()}><div style={m.label}>Base price</div><div style={m.inputWrap}><span style={m.prefix}>$</span><input style={{...m.input,paddingLeft:22}} type="number" value={ms.price} onChange={e=>ms.setPrice(e.target.value)} placeholder="e.g. 150"/></div></div>}
                  </div>
                ))}
              </div>
              <Field label="Notes for traders"><textarea style={m.textarea} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions traders should know…"/></Field>
            </div>
          )}

          {/* ── STEP 5: Review ── */}
          {step === 5 && (
            <div style={m.stepContent}>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  { title:"Route", rows:[["Origin",origin?.split(",")[0]],["Destination",destination?.split(",")[0]],["Departure",departureDate?new Date(departureDate).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"-"],["Mode",transportMode]] },
                  { title:"Container", rows:[["Type",CONTAINER_TYPES.find(c=>c.value===containerType)?.label??containerType],["Capacity",`${maxCBM} CBM · ${parseInt(maxWeightKg||"0").toLocaleString()} kg`],["Cargo",cargoType],["Reefer",refrigerated?"Yes":"No"],["Partial",acceptsPartial?`Yes (min ${minBookingCBM} CBM)`:"No"]] },
                  { title:"Documents required", rows: requiredDocs.length===0 ? [["None set","Traders can book without uploading docs"]] : requiredDocs.map(d=>[d.name, d.mandatory?"Mandatory":"Optional"]) },
                  { title:"Pricing", rows:[["Per CBM",`$${pricePerCBM}/CBM`],["Per kg",pricePerKg?`$${pricePerKg}/kg`:"Not set"],["Pickup",offersFirstMile?`$${firstMilePrice||0} base`:"Not offered"],["Delivery",offersLastMile?`$${lastMilePrice||0} base`:"Not offered"]] },
                ].map(sec=>(
                  <div key={sec.title} style={m.reviewCard}>
                    <div style={m.reviewTitle}>{sec.title}</div>
                    {sec.rows.map(([label,val],i)=>(
                      <div key={i} style={m.reviewRow}>
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{label}</span>
                        <span style={{ fontSize:12, color: sec.title==="Pricing"&&i===0?"#a855f7":"rgba(255,255,255,0.7)" }}>{val}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ background:"rgba(16,185,129,0.07)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:9,padding:"12px 16px" }}>
                  <div style={{fontSize:12,fontWeight:500,color:"#10b981",marginBottom:3}}>✓ Ready to publish</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>
                    Container will be listed immediately on the {origin?.split(",")[0]} → {destination?.split(",")[0]} route.
                    {requiredDocs.length>0?` Traders must upload ${mandatoryDocs} mandatory document${mandatoryDocs!==1?"s":""} before booking is confirmed.`:" No documents required from traders."}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <div style={m.errorBox}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}

        <div style={m.footer}>
          <button style={m.cancelBtn} onClick={goBack}>{step===1?"Cancel":"← Back"}</button>
          {step < STEPS.length
            ? <button style={{...m.nextBtn,opacity:canNext(step)?1:0.4}} disabled={!canNext(step)} onClick={goNext}>Next →</button>
            : <button style={{...m.nextBtn,background:loading?"rgba(124,58,237,0.5)":"#7c3aed",minWidth:140}} onClick={handleSubmit} disabled={loading}>
                {loading?<><div style={m.spin}/>Publishing…</>:<>✦ Publish container</>}
              </button>
          }
        </div>
      </div>
    </div>
  )
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function Label({ icon, children }: { icon:string; children:React.ReactNode }) {
  return <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, fontWeight:700, color:"rgba(168,85,247,0.7)", textTransform:"uppercase", letterSpacing:".08em" }}>{icon} {children}</div>
}
function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return <div style={{ display:"flex", flexDirection:"column", gap:5, flex:1 }}><div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{label}</div>{children}</div>
}
function Chk({ label, checked, onChange, color }: { label:string; checked:boolean; onChange:(v:boolean)=>void; color:string }) {
  return <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:12, color: checked?color:"rgba(255,255,255,0.5)" }}><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{accentColor:color}}/>{label}</label>
}

const m: Record<string, React.CSSProperties> = {
  overlay:       { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  modal:         { background:"#13131e", border:"1px solid rgba(168,85,247,0.2)", borderRadius:14, width:"100%", maxWidth:740, maxHeight:"92vh", display:"flex", flexDirection:"column", overflow:"hidden" },
  header:        { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.07)" },
  headerIcon:    { width:36, height:36, borderRadius:9, background:"rgba(168,85,247,0.15)", display:"flex", alignItems:"center", justifyContent:"center" },
  headerTitle:   { fontSize:16, fontWeight:700, color:"#fff" },
  headerSub:     { fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:1 },
  closeBtn:      { width:30, height:30, borderRadius:7, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" },
  stepRow:       { display:"flex", alignItems:"center", padding:"12px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", gap:0 },
  stepWrap:      { display:"flex", alignItems:"center", gap:5, flex:1 },
  stepDot:       { width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  stepLine:      { flex:1, height:1 },
  body:          { flex:1, overflowY:"auto", padding:"0 20px" },
  stepContent:   { padding:"18px 0", display:"flex", flexDirection:"column", gap:14 },
  fieldRow:      { display:"flex", gap:12, alignItems:"flex-end" },
  label:         { fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:4 },
  input:         { height:38, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"0 10px", color:"#fff", fontSize:13, outline:"none", colorScheme:"dark", width:"100%" },
  inputWrap:     { position:"relative", display:"flex", alignItems:"center" },
  unit:          { position:"absolute", right:10, fontSize:11, color:"rgba(168,85,247,0.6)", pointerEvents:"none" },
  prefix:        { position:"absolute", left:10, fontSize:13, color:"rgba(255,255,255,0.4)", pointerEvents:"none" },
  textarea:      { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:"#fff", fontSize:12, outline:"none", resize:"vertical", lineHeight:1.5, width:"100%" },
  swapBtn:       { width:36, height:38, borderRadius:8, background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, color:"#a855f7", fontSize:16 },
  modeBtn:       { display:"flex", alignItems:"center", gap:5, fontSize:11, padding:"6px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.45)", cursor:"pointer" },
  modeBtnActive: { borderColor:"rgba(168,85,247,0.5)", background:"rgba(168,85,247,0.12)", color:"#c084fc" },
  containerGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 },
  ctCard:        { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"12px 8px", textAlign:"center", cursor:"pointer" },
  ctCardActive:  { borderColor:"rgba(168,85,247,0.5)", background:"rgba(168,85,247,0.1)" },
  flagRow:       { display:"flex", gap:16, flexWrap:"wrap" },
  docBanner:     { display:"flex", gap:14, background:"rgba(168,85,247,0.07)", border:"1px solid rgba(168,85,247,0.2)", borderRadius:10, padding:"14px 16px" },
  docBannerIcon: { width:42, height:42, borderRadius:10, background:"rgba(168,85,247,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  skipNote:      { fontSize:11, color:"rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.03)", borderRadius:7, padding:"8px 12px", lineHeight:1.5 },
  aiPriceCard:   { background:"rgba(168,85,247,0.05)", border:"1px solid rgba(168,85,247,0.2)", borderRadius:10, padding:16, marginBottom:4 },
  aiPriceBtn:    { display:"flex", alignItems:"center", gap:6, fontSize:11, padding:"6px 12px", background:"rgba(168,85,247,0.15)", border:"1px solid rgba(168,85,247,0.35)", borderRadius:7, color:"#c084fc", cursor:"pointer" },
  priceApplyBtn: { flex:1, height:30, fontSize:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, color:"rgba(255,255,255,0.5)", cursor:"pointer" },
  mileCard:      { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"12px 14px", cursor:"pointer" },
  mileCardActive:{ borderColor:"rgba(168,85,247,0.35)", background:"rgba(168,85,247,0.07)" },
  reviewCard:    { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:9, padding:"12px 14px" },
  reviewTitle:   { fontSize:10, fontWeight:700, color:"rgba(168,85,247,0.7)", textTransform:"uppercase", letterSpacing:".07em", marginBottom:8 },
  reviewRow:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0" },
  errorBox:      { margin:"0 20px 12px", padding:"9px 12px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:8, fontSize:12, color:"#ef4444", display:"flex", gap:7, alignItems:"center" },
  footer:        { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderTop:"1px solid rgba(255,255,255,0.07)" },
  cancelBtn:     { fontSize:13, color:"rgba(255,255,255,0.4)", background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"8px 16px", cursor:"pointer" },
  nextBtn:       { fontSize:13, fontWeight:600, background:"#7c3aed", border:"none", borderRadius:8, padding:"9px 22px", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", gap:7 },
  spin:          { width:13, height:13, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.25)", borderTopColor:"#fff" },
}
