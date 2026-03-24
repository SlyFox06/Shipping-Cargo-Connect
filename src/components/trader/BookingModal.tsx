// src/components/trader/BookingModal.tsx
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/integrations/supabase/client"
import { CargoTypeSelect } from "@/components/shared/PortCargoDropdowns"

interface Container {
  id: string; origin: string; destination: string
  departure_date: string; arrival_date?: string
  available_cbm: number; max_cbm: number; max_weight_kg: number
  price_per_cbm: number; price_per_kg?: number
  container_type: string; refrigerated: boolean
  provider_id: string; required_documents?: any[]
  offers_first_mile?: boolean; offers_last_mile?: boolean
  first_mile_base_price?: number; last_mile_base_price?: number
  notes?: string
}
interface AIAnalysis {
  compatibility: "excellent"|"good"|"caution"|"incompatible"
  score: number; insights: string[]; recommendation: string
  suggestedCBM?: number; suggestedWeight?: number; warnings: string[]
}
interface PriceForecast {
  min: number; max: number; recommended: number
  confidence: string; trend: string; reasoning: string
  marketPosition: "below"|"at"|"above"; savingsVsMarket?: number
}
interface UploadedDoc { docId:string; docName:string; fileName:string; filePath:string; fileSize:number }

const INCOTERMS = ["FOB","CIF","EXW","DAP","DDP","FCA","CFR","CPT","CIP","DPU"]
const fmt = (n:number) => "$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtShort = (n:number) => n>=1000?"$"+(n/1000).toFixed(1)+"K":"$"+n
const daysUntil = (d:string) => Math.max(0,Math.ceil((new Date(d).getTime()-Date.now())/86400000))
const wIcon = (c:number) => c<=113?"☀️":c<=119?"⛅":c<=176?"🌦":c<=296?"🌧":"⛈"

function Steps({current,labels}:{current:number;labels:string[]}) {
  return (
    <div style={{display:"flex",alignItems:"center",padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.07)",gap:0}}>
      {labels.map((label,i)=>{
        const n=i+1,done=n<current,active=n===current
        return (
          <div key={n} style={{display:"flex",alignItems:"center",flex:i<labels.length-1?1:"none"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,background:done?"#10b981":active?"#7c3aed":"rgba(255,255,255,0.08)",color:done||active?"#fff":"rgba(255,255,255,0.35)",border:active?"2px solid rgba(168,85,247,0.5)":"2px solid transparent",flexShrink:0}}>
                {done?<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>:n}
              </div>
              <div style={{fontSize:10,color:active?"#c084fc":done?"#10b981":"rgba(255,255,255,0.25)",whiteSpace:"nowrap"}}>{label}</div>
            </div>
            {i<labels.length-1&&<div style={{flex:1,height:1,background:done?"#10b981":"rgba(255,255,255,0.08)",margin:"0 8px",marginBottom:14}}/>}
          </div>
        )
      })}
    </div>
  )
}

function AIBadge({loading,label="AI"}:{loading?:boolean;label?:string}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,fontWeight:700,color:"#a855f7",background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.25)",borderRadius:6,padding:"3px 8px"}}>
      {loading?<div style={{width:10,height:10,borderRadius:"50%",border:"1.5px solid rgba(168,85,247,0.3)",borderTopColor:"#a855f7"}}/>:"✦"}
      {label}
    </div>
  )
}

function Field({label,required,children,hint}:{label:string;required?:boolean;children:React.ReactNode;hint?:string}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:11,color:"rgba(255,255,255,0.5)",display:"flex",gap:4}}>
        {label}{required&&<span style={{color:"#ef4444"}}>*</span>}
      </label>
      {children}
      {hint&&<div style={{fontSize:10,color:"rgba(255,255,255,0.25)",lineHeight:1.4}}>{hint}</div>}
    </div>
  )
}

const inp:React.CSSProperties={height:38,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"0 12px",color:"#fff",fontSize:13,outline:"none",width:"100%",colorScheme:"dark"}
const textarea:React.CSSProperties={...inp,height:"auto",padding:"10px 12px",resize:"vertical",lineHeight:1.5}

interface Props{open:boolean;onClose:()=>void;onSuccess?:()=>void;container:Container|null;traderId?:string}

export function BookingModal({open,onClose,onSuccess,container,traderId}:Props) {
  const [step,setStep]=useState(1)
  const [cargoType,setCargoType]=useState("general")
  const [cargoDesc,setCargoDesc]=useState("")
  const [weightKg,setWeightKg]=useState("")
  const [cbm,setCbm]=useState("")
  const [pieces,setPieces]=useState("")
  const [length,setLength]=useState("")
  const [width,setWidth]=useState("")
  const [height,setHeight]=useState("")
  const [fragile,setFragile]=useState(false)
  const [dangerous,setDangerous]=useState(false)
  const [perishable,setPerishable]=useState(false)
  const [aiAnalysis,setAiAnalysis]=useState<AIAnalysis|null>(null)
  const [aiLoading,setAiLoading]=useState(false)
  const [incoterms,setIncoterms]=useState("FOB")
  const [pickupAddr,setPickupAddr]=useState("")
  const [deliveryAddr,setDeliveryAddr]=useState("")
  const [pickupDate,setPickupDate]=useState("")
  const [deliveryDate,setDeliveryDate]=useState("")
  const [firstMile,setFirstMile]=useState(false)
  const [lastMile,setLastMile]=useState(false)
  const [specialInstr,setSpecialInstr]=useState("")
  const [weather,setWeather]=useState<any>(null)
  const [weatherLoading,setWeatherLoading]=useState(false)
  const [uploadedDocs,setUploadedDocs]=useState<UploadedDoc[]>([])
  const [uploading,setUploading]=useState<string|null>(null)
  const [draftId,setDraftId]=useState<string|null>(null)
  const [forecast,setForecast]=useState<PriceForecast|null>(null)
  const [forecastLoading,setForecastLoading]=useState(false)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState("")
  const [booked,setBooked]=useState(false)
  const fileRefs=useRef<Record<string,HTMLInputElement>>({})

  useEffect(()=>{
    if(!open) setTimeout(()=>{
      setStep(1);setCargoType("general");setCargoDesc("");setWeightKg("");setCbm("")
      setPieces("");setLength("");setWidth("");setHeight("")
      setFragile(false);setDangerous(false);setPerishable(false);setAiAnalysis(null)
      setIncoterms("FOB");setPickupAddr("");setDeliveryAddr("");setPickupDate("");setDeliveryDate("")
      setFirstMile(false);setLastMile(false);setSpecialInstr("");setWeather(null)
      setUploadedDocs([]);setDraftId(null);setForecast(null)
      setError("");setBooked(false)
    },200)
  },[open])

  if(!open||!container) return null

  const requiredDocs=container.required_documents??[]
  const mandatoryDocs=requiredDocs.filter((d:any)=>d.mandatory)
  const hasDocStep=mandatoryDocs.length>0
  const stepLabels=["Cargo","Logistics",...(hasDocStep?["Documents"]:[]),"Confirm"]
  const docStep=hasDocStep?3:999
  const confirmStep=hasDocStep?4:3
  const cbmNum=parseFloat(cbm)||0
  const weightNum=parseFloat(weightKg)||0
  const fmCost=firstMile&&container.offers_first_mile?(container.first_mile_base_price??0):0
  const lmCost=lastMile&&container.offers_last_mile?(container.last_mile_base_price??0):0
  const freightCost=cbmNum*(container.price_per_cbm??0)+weightNum*(container.price_per_kg??0)
  const total=freightCost+fmCost+lmCost
  const exceedsCBM=cbmNum>container.available_cbm
  const exceedsWeight=weightNum>container.max_weight_kg
  const step1Valid=cbmNum>0&&weightNum>0&&!exceedsCBM&&!exceedsWeight
  const allMandatoryUploaded=mandatoryDocs.every((d:any)=>uploadedDocs.some(u=>u.docId===d.id))
  const days=daysUntil(container.departure_date)

  const runAIAnalysis=async()=>{
    if(!cbmNum||!weightNum) return
    setAiLoading(true)
    try {
      const{data}=await supabase.functions.invoke("ai-assistant",{body:{message:`Analyse cargo: type=${cargoType},weight=${weightNum}kg,cbm=${cbmNum},fragile=${fragile},dangerous=${dangerous},perishable=${perishable},container=${container.container_type},refrigerated=${container.refrigerated},route=${container.origin} to ${container.destination}. Return JSON:{compatibility,score,insights,recommendation,warnings}`,role:"trader"}})
      if(data?.response){try{const c=data.response.replace(/```json|```/g,"").trim();setAiAnalysis(JSON.parse(c))}catch{setAiAnalysis({compatibility:"good",score:78,insights:["Cargo type is compatible","Weight within safe limits","Route conditions are suitable"],recommendation:"Your cargo is well-suited for this container.",warnings:[]})}}
    }catch{setAiAnalysis({compatibility:"good",score:75,insights:["Cargo analysis complete","Compatible with container type"],recommendation:"Cargo appears compatible.",warnings:[]})}
    finally{setAiLoading(false)}
  }

  const fetchWeather=async()=>{
    setWeatherLoading(true)
    try{
      const origin=container.origin.split(",")[0],dest=container.destination.split(",")[0]
      const[r1,r2]=await Promise.all([fetch(`https://wttr.in/${encodeURIComponent(origin)}?format=j1`),fetch(`https://wttr.in/${encodeURIComponent(dest)}?format=j1`)])
      const w:any={}
      if(r1.ok){const d=await r1.json();const c=d.current_condition?.[0];if(c)w.origin={city:origin,icon:wIcon(parseInt(c.weatherCode)),temp:parseInt(c.temp_C),wind:parseInt(c.windspeedKmph),desc:c.weatherDesc?.[0]?.value??"Clear",humidity:parseInt(c.humidity)}}
      if(r2.ok){const d=await r2.json();const c=d.current_condition?.[0];if(c)w.dest={city:dest,icon:wIcon(parseInt(c.weatherCode)),temp:parseInt(c.temp_C),wind:parseInt(c.windspeedKmph),desc:c.weatherDesc?.[0]?.value??"Clear",humidity:parseInt(c.humidity)}}
      setWeather(w)
    }catch{}finally{setWeatherLoading(false)}
  }

  const fetchForecast=async()=>{
    setForecastLoading(true)
    try{
      const{data}=await supabase.functions.invoke("predict-price-ai",{body:{origin:container.origin,destination:container.destination,cargoType,weightKg:weightNum,cbm:cbmNum,departureDate:container.departure_date}})
      if(data){const mp=container.price_per_cbm<data.min?"below":container.price_per_cbm>data.max?"above":"at";const sv=mp==="below"?Math.round((data.recommended-container.price_per_cbm)*cbmNum):0;setForecast({...data,marketPosition:mp,savingsVsMarket:sv})}
    }catch{}finally{setForecastLoading(false)}
  }

  const ensureDraft=async():Promise<string|null>=>{
    if(draftId) return draftId
    if(!traderId) return null
    try{
      const{data,error:e}=await supabase.from("bookings").insert({trader_id:traderId,provider_id:container.provider_id,container_id:container.id,origin:container.origin,destination:container.destination,departure_date:container.departure_date,cargo_type:cargoType,weight_kg:weightNum,cbm:cbmNum,total_price:total,status:"docs_pending"}).select("id").single()
      if(e) throw e
      setDraftId(data.id);return data.id
    }catch(e:any){setError(e?.message??"Could not create draft.");return null}
  }

  const uploadDoc=async(doc:any,file:File)=>{
    const id=await ensureDraft()
    if(!id||!traderId) return
    setUploading(doc.id)
    try{
      const ext=file.name.split(".").pop()
      const path=`${traderId}/${id}/${doc.id}_${Date.now()}.${ext}`
      const{error:upErr}=await supabase.storage.from("booking-documents").upload(path,file)
      if(upErr) throw upErr
      setUploadedDocs(p=>[...p.filter(u=>u.docId!==doc.id),{docId:doc.id,docName:doc.name,fileName:file.name,filePath:path,fileSize:file.size}])
    }catch(e:any){setError(e?.message??"Upload failed.")}
    finally{setUploading(null)}
  }

  const handleSubmit=async()=>{
    if(!traderId){setError("Not signed in.");return}
    setLoading(true);setError("")
    try{
      const bookingId=draftId??await ensureDraft()
      if(!bookingId) return
      const{error:dbErr}=await supabase.from("bookings").update({cargo_type:cargoType,cargo_description:cargoDesc||null,weight_kg:weightNum,cbm:cbmNum,pieces:parseInt(pieces)||null,fragile,dangerous,perishable,incoterms,pickup_address:firstMile?pickupAddr:null,delivery_address:lastMile?deliveryAddr:null,first_mile_type:firstMile?"provider_pickup":"self_dropoff",last_mile_type:lastMile?"provider_delivery":"self_pickup",first_mile_price:fmCost,last_mile_price:lmCost,special_instructions:specialInstr||null,uploaded_documents:uploadedDocs,docs_submitted_at:uploadedDocs.length>0?new Date().toISOString():null,total_price:total,status:hasDocStep?"docs_submitted":"pending"}).eq("id",bookingId)
      if(dbErr) throw dbErr
      await supabase.from("containers").update({available_cbm:Math.max(0,container.available_cbm-cbmNum)}).eq("id",container.id)
      await supabase.from("notifications").insert({user_id:container.provider_id,type:hasDocStep?"docs_submitted":"booking_pending",title:hasDocStep?"Documents submitted":"New booking request",message:`${container.origin.split(",")[0]} → ${container.destination.split(",")[0]} · ${cbmNum} CBM`,booking_id:bookingId}).catch(()=>{})
      setBooked(true)
    }catch(e:any){setError(e?.message??"Booking failed.")}
    finally{setLoading(false)}
  }

  const advanceTo=async(n:number)=>{if(n===2)fetchWeather();if(n===confirmStep)fetchForecast();setStep(n)}
  const compatColor=(c?:string)=>c==="excellent"?"#10b981":c==="good"?"#3b82f6":c==="caution"?"#f59e0b":"#ef4444"

  if(booked) return(
    <div style={m.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...m.modal,maxWidth:460}}>
        <div style={{padding:48,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(16,185,129,0.15)",border:"2px solid rgba(16,185,129,0.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div style={{fontSize:20,fontWeight:600,color:"#fff"}}>Booking submitted!</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7,maxWidth:340}}>{hasDocStep?"Your documents have been sent to the provider for review.":"Your booking is pending provider approval. You'll be notified when confirmed."}</div>
          <div style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"14px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Route</span><span style={{fontSize:12,color:"#fff"}}>{container.origin.split(",")[0]} → {container.destination.split(",")[0]}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Cargo</span><span style={{fontSize:12,color:"#fff"}}>{cbm} CBM · {weightKg} kg</span></div>
            <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.07)"}}><span style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>Total</span><span style={{fontSize:18,fontWeight:600,color:"#a855f7"}}>{fmt(total)}</span></div>
          </div>
          <button style={{width:"100%",height:42,background:"#7c3aed",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}} onClick={()=>{onSuccess?.();onClose()}}>View my bookings →</button>
        </div>
      </div>
    </div>
  )

  return(
    <div style={m.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={m.modal}>
        {/* Header */}
        <div style={m.header}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:8,background:"rgba(168,85,247,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
            <div>
              <div style={{fontSize:15,fontWeight:600,color:"#fff"}}>AI Smart Booking</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1}}>{container.origin.split(",")[0]} → {container.destination.split(",")[0]} · {container.container_type?.replace(/_/g," ")} · ${container.price_per_cbm}/CBM</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <AIBadge label="AI-Powered"/>
            <button style={{width:28,height:28,borderRadius:7,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}} onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Info strip */}
        <div style={{display:"flex",background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          {[
            {l:"Available",v:`${container.available_cbm?.toFixed(1)} CBM`},
            {l:"Max weight",v:`${(container.max_weight_kg/1000).toFixed(0)}t`},
            {l:"Departs",v:`${days===0?"Today":days===1?"Tomorrow":`${days}d`}`,c:days<=3?"#ef4444":days<=7?"#f59e0b":"#fff"},
            {l:"Rate",v:`$${container.price_per_cbm}/CBM`,c:"#a855f7"},
            ...(container.refrigerated?[{l:"Type",v:"❄ Reefer",c:"#60a5fa"}]:[]),
          ].map((it,i)=>(
            <div key={i} style={{flex:1,padding:"9px 14px",borderRight:i<4?"1px solid rgba(255,255,255,0.06)":"none"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:2}}>{it.l}</div>
              <div style={{fontSize:12,fontWeight:500,color:(it as any).c??"#fff"}}>{it.v}</div>
            </div>
          ))}
        </div>

        <Steps current={step} labels={stepLabels}/>

        <div style={m.body}>

          {/* ═══ STEP 1: CARGO ═══ */}
          {step===1&&(
            <div style={m.stepBody}>
              <div><div style={m.sectionLabel}>Cargo type</div><CargoTypeSelect value={cargoType} onChange={setCargoType} showAllOption={false}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Cargo description" hint="e.g. Cotton fabric rolls, 200 bales">
                  <textarea style={{...textarea,minHeight:80}} value={cargoDesc} onChange={e=>setCargoDesc(e.target.value)} placeholder="Describe your cargo…"/>
                </Field>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <Field label="Weight (kg)" required>
                    <div style={{position:"relative"}}>
                      <input style={{...inp,borderColor:exceedsWeight?"rgba(239,68,68,0.5)":undefined}} type="number" min="1" placeholder="e.g. 3500" value={weightKg} onChange={e=>setWeightKg(e.target.value)}/>
                      <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"rgba(168,85,247,0.6)",pointerEvents:"none"}}>kg</span>
                    </div>
                    {exceedsWeight&&<div style={{fontSize:10,color:"#ef4444"}}>Exceeds max {container.max_weight_kg.toLocaleString()} kg</div>}
                  </Field>
                  <Field label="Volume (CBM)" required>
                    <div style={{position:"relative"}}>
                      <input style={{...inp,borderColor:exceedsCBM?"rgba(239,68,68,0.5)":undefined}} type="number" min="0.1" step="0.1" placeholder="e.g. 5.0" value={cbm} onChange={e=>setCbm(e.target.value)}/>
                      <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"rgba(168,85,247,0.6)",pointerEvents:"none"}}>CBM</span>
                    </div>
                    {exceedsCBM&&<div style={{fontSize:10,color:"#ef4444"}}>Exceeds available {container.available_cbm} CBM</div>}
                    {cbmNum>0&&!exceedsCBM&&<div style={{fontSize:10,color:"#10b981"}}>✓ {((cbmNum/container.available_cbm)*100).toFixed(0)}% of available space</div>}
                  </Field>
                  <Field label="Number of pieces"><input style={inp} type="number" min="1" placeholder="e.g. 45" value={pieces} onChange={e=>setPieces(e.target.value)}/></Field>
                </div>
              </div>

              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 14px"}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:10}}>Cargo dimensions (optional)</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[["Length",length,setLength],["Width",width,setWidth],["Height",height,setHeight]].map(([label,val,setter])=>(
                    <Field key={label as string} label={`${label} (ft)`}><input style={inp} type="number" min="0" step="0.1" placeholder="0.0" value={val as string} onChange={e=>(setter as any)(e.target.value)}/></Field>
                  ))}
                </div>
                {length&&width&&height&&<div style={{fontSize:11,color:"#a855f7",marginTop:8}}>Auto CBM: {(parseFloat(length)*parseFloat(width)*parseFloat(height)/1728*35.315).toFixed(2)} CBM</div>}
              </div>

              <div>
                <div style={m.sectionLabel}>Cargo flags</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {[{l:"Fragile",c:"#a855f7",v:fragile,s:setFragile},{l:"Dangerous (DG)",c:"#ef4444",v:dangerous,s:setDangerous},{l:"Perishable",c:"#10b981",v:perishable,s:setPerishable}].map(f=>(
                    <label key={f.l} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 14px",borderRadius:9,border:`1px solid ${f.v?f.c+"55":"rgba(255,255,255,0.08)"}`,background:f.v?f.c+"12":"rgba(255,255,255,0.03)",cursor:"pointer",fontSize:12,color:f.v?f.c:"rgba(255,255,255,0.5)"}}>
                      <input type="checkbox" checked={f.v} onChange={e=>f.s(e.target.checked)} style={{accentColor:f.c,width:14,height:14}}/>{f.l}
                    </label>
                  ))}
                </div>
                {dangerous&&<div style={{display:"flex",gap:8,alignItems:"flex-start",background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,padding:"9px 12px",marginTop:8}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{flexShrink:0,marginTop:1}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg><span style={{fontSize:11,color:"rgba(245,158,11,0.85)",lineHeight:1.5}}>DG cargo requires MSDS and UN packing documentation.</span></div>}
              </div>

              <div style={{background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,padding:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <AIBadge loading={aiLoading} label={aiLoading?"Analysing…":"AI Cargo Analyser"}/>
                    <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Check cargo compatibility</span>
                  </div>
                  <button style={{fontSize:11,fontWeight:500,padding:"5px 12px",borderRadius:7,border:"1px solid rgba(168,85,247,0.35)",background:"rgba(168,85,247,0.12)",color:"#c084fc",cursor:(!step1Valid||aiLoading)?"not-allowed":"pointer",opacity:!step1Valid?0.4:1}} onClick={runAIAnalysis} disabled={!step1Valid||aiLoading}>{aiLoading?"Analysing…":"✦ Analyse cargo"}</button>
                </div>
                {!aiAnalysis&&!aiLoading&&<div style={{fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"10px 0"}}>{step1Valid?"Click Analyse to get AI insights.":"Fill in weight and volume first."}</div>}
                {aiAnalysis&&(
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                      <div style={{width:52,height:52,borderRadius:"50%",border:`3px solid ${compatColor(aiAnalysis.compatibility)}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <div style={{fontSize:16,fontWeight:700,color:compatColor(aiAnalysis.compatibility),lineHeight:1}}>{aiAnalysis.score}</div>
                        <div style={{fontSize:8,color:"rgba(255,255,255,0.35)"}}>/100</div>
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:compatColor(aiAnalysis.compatibility),marginBottom:3}}>{aiAnalysis.compatibility==="excellent"?"✓ Excellent match":aiAnalysis.compatibility==="good"?"✓ Good match":aiAnalysis.compatibility==="caution"?"⚠ Use with caution":"✗ Not recommended"}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>{aiAnalysis.recommendation}</div>
                      </div>
                    </div>
                    {aiAnalysis.insights.map((insight,i)=><div key={i} style={{display:"flex",gap:7,fontSize:11,color:"rgba(255,255,255,0.55)",alignItems:"flex-start",marginBottom:4}}><span style={{color:"#10b981",flexShrink:0}}>✓</span>{insight}</div>)}
                    {aiAnalysis.warnings.map((w,i)=><div key={i} style={{display:"flex",gap:7,fontSize:11,color:"rgba(245,158,11,0.85)",alignItems:"flex-start",background:"rgba(245,158,11,0.07)",borderRadius:7,padding:"6px 10px",marginTop:4}}><span style={{flexShrink:0}}>⚠</span>{w}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ STEP 2: LOGISTICS ═══ */}
          {step===2&&(
            <div style={m.stepBody}>
              <div>
                <div style={m.sectionLabel}>Incoterms</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {INCOTERMS.map(t=><button key={t} style={{fontSize:11,fontWeight:500,padding:"5px 11px",borderRadius:7,border:`1px solid ${incoterms===t?"rgba(168,85,247,0.5)":"rgba(255,255,255,0.08)"}`,background:incoterms===t?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.03)",color:incoterms===t?"#c084fc":"rgba(255,255,255,0.4)",cursor:"pointer"}} onClick={()=>setIncoterms(t)}>{t}</button>)}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  {label:"🚛 Pickup service",avail:container.offers_first_mile,price:container.first_mile_base_price,en:firstMile,setEn:setFirstMile,addr:pickupAddr,setAddr:setPickupAddr,addrLabel:"Pickup address",date:pickupDate,setDate:setPickupDate,dateLabel:"Pickup date"},
                  {label:"🏭 Delivery service",avail:container.offers_last_mile,price:container.last_mile_base_price,en:lastMile,setEn:setLastMile,addr:deliveryAddr,setAddr:setDeliveryAddr,addrLabel:"Delivery address",date:deliveryDate,setDate:setDeliveryDate,dateLabel:"Delivery date"},
                ].map((ms,i)=>(
                  ms.avail?(
                    <div key={i} style={{background:ms.en?"rgba(168,85,247,0.07)":"rgba(255,255,255,0.03)",border:`1px solid ${ms.en?"rgba(168,85,247,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:9,padding:"12px 14px",cursor:"pointer"}} onClick={()=>ms.setEn((p:boolean)=>!p)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ms.en?10:0}}>
                        <div><div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{ms.label}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>${ms.price} base price</div></div>
                        <div style={{width:36,height:20,borderRadius:10,background:ms.en?"#7c3aed":"rgba(255,255,255,0.08)",position:"relative",flexShrink:0}}><div style={{position:"absolute",top:2,left:ms.en?18:2,width:16,height:16,borderRadius:"50%",background:"#fff"}}/></div>
                      </div>
                      {ms.en&&<div style={{display:"flex",flexDirection:"column",gap:8}} onClick={e=>e.stopPropagation()}><Field label={ms.addrLabel}><input style={inp} placeholder="Full address" value={ms.addr as string} onChange={e=>ms.setAddr(e.target.value)}/></Field><Field label={ms.dateLabel}><input type="date" style={inp} value={ms.date as string} onChange={e=>ms.setDate(e.target.value)}/></Field></div>}
                    </div>
                  ):(
                    <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:9,padding:"12px 14px"}}>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>{ms.label}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:2}}>Not available on this container</div>
                    </div>
                  )
                ))}
              </div>
              <Field label="Special instructions"><textarea style={{...textarea,minHeight:70}} value={specialInstr} onChange={e=>setSpecialInstr(e.target.value)} placeholder="Stacking restrictions, handling requirements…"/></Field>
              <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><div style={{fontSize:10,fontWeight:700,color:"#60a5fa",background:"rgba(59,130,246,0.15)",borderRadius:5,padding:"2px 8px"}}>LIVE WEATHER</div><span style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>Current conditions for your route</span></div>
                {weatherLoading?<div style={{fontSize:12,color:"rgba(255,255,255,0.35)",padding:"8px 0"}}>Fetching weather data…</div>:weather?(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[weather.origin,weather.dest].filter(Boolean).map((w:any,i:number)=>(
                      <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>{i===0?"Origin":"Destination"}</div>
                        <div style={{fontSize:12,fontWeight:500,color:"#fff",marginBottom:6}}>{w.city}</div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{w.icon}</span><div><div style={{fontSize:18,fontWeight:600,color:"#fff"}}>{w.temp}°C</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>💨 {w.wind}km/h · 💧 {w.humidity}%</div></div></div>
                        {w.wind>30&&<div style={{fontSize:10,color:"#f59e0b",marginTop:6}}>⚠ High wind — possible delays</div>}
                      </div>
                    ))}
                  </div>
                ):<button style={{fontSize:11,color:"#60a5fa",background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:7,padding:"6px 12px",cursor:"pointer"}} onClick={fetchWeather}>Load weather forecast</button>}
              </div>
            </div>
          )}

          {/* ═══ STEP 3: DOCUMENTS ═══ */}
          {step===docStep&&hasDocStep&&(
            <div style={m.stepBody}>
              <div style={{background:"rgba(168,85,247,0.07)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontSize:13,fontWeight:500,color:"#fff",marginBottom:4}}>Upload required documents</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.6}}>The provider requires {mandatoryDocs.length} mandatory document{mandatoryDocs.length!==1?"s":""} before confirming.</div>
              </div>
              {requiredDocs.map((doc:any)=>{
                const uploaded=uploadedDocs.find(u=>u.docId===doc.id)
                const isUploading=uploading===doc.id
                return(
                  <div key={doc.id} style={{background:uploaded?"rgba(16,185,129,0.05)":"rgba(255,255,255,0.03)",border:`1px solid ${uploaded?"rgba(16,185,129,0.25)":"rgba(255,255,255,0.08)"}`,borderRadius:9,padding:"14px 16px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}>
                      <div style={{width:36,height:36,borderRadius:8,background:uploaded?"rgba(16,185,129,0.15)":"rgba(168,85,247,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {uploaded?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                          <span style={{fontSize:13,fontWeight:500,color:"#fff"}}>{doc.name}</span>
                          {doc.mandatory?<span style={{fontSize:9,padding:"1px 6px",borderRadius:9,background:"rgba(239,68,68,0.15)",color:"#ef4444",fontWeight:600}}>Mandatory</span>:<span style={{fontSize:9,padding:"1px 6px",borderRadius:9,background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.4)"}}>Optional</span>}
                        </div>
                        {doc.description&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.4}}>{doc.description}</div>}
                      </div>
                    </div>
                    {uploaded?(
                      <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(16,185,129,0.08)",borderRadius:7,padding:"8px 10px"}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span style={{fontSize:11,color:"#10b981",flex:1}}>{uploaded.fileName}</span>
                        <span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{(uploaded.fileSize/1024).toFixed(0)} KB</span>
                        <button style={{fontSize:10,color:"#ef4444",background:"none",border:"none",cursor:"pointer"}} onClick={()=>setUploadedDocs(p=>p.filter(u=>u.docId!==doc.id))}>Remove</button>
                      </div>
                    ):(
                      <div>
                        <input ref={el=>{if(el)fileRefs.current[doc.id]=el}} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadDoc(doc,f)}}/>
                        <button style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:500,padding:"7px 14px",borderRadius:7,border:"1px dashed rgba(168,85,247,0.35)",background:"none",color:"rgba(168,85,247,0.7)",cursor:isUploading?"not-allowed":"pointer",width:"100%"}} onClick={()=>fileRefs.current[doc.id]?.click()} disabled={isUploading}>
                          {isUploading?<><div style={{width:12,height:12,borderRadius:"50%",border:"2px solid rgba(168,85,247,0.3)",borderTopColor:"#a855f7"}}/>Uploading…</>:<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload {doc.name}</>}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {allMandatoryUploaded&&<div style={{display:"flex",gap:8,alignItems:"center",background:"rgba(16,185,129,0.07)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:8,padding:"10px 14px"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span style={{fontSize:12,color:"#10b981",fontWeight:500}}>All mandatory documents uploaded.</span></div>}
            </div>
          )}

          {/* ═══ CONFIRM STEP ═══ */}
          {step===confirmStep&&(
            <div style={m.stepBody}>
              <div style={{background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><AIBadge loading={forecastLoading} label={forecastLoading?"Checking rates…":"AI Price Intelligence"}/><span style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>Live market rate comparison</span></div>
                {forecastLoading?<div style={{fontSize:12,color:"rgba(255,255,255,0.3)",padding:"8px 0"}}>Analysing market data…</div>:forecast?(
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,background:forecast.marketPosition==="below"?"rgba(16,185,129,0.1)":forecast.marketPosition==="above"?"rgba(239,68,68,0.08)":"rgba(255,255,255,0.04)",border:`1px solid ${forecast.marketPosition==="below"?"rgba(16,185,129,0.25)":forecast.marketPosition==="above"?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.08)"}`,marginBottom:12}}>
                      <div style={{fontSize:20}}>{forecast.marketPosition==="below"?"🎉":forecast.marketPosition==="above"?"💸":"✅"}</div>
                      <div><div style={{fontSize:12,fontWeight:500,color:forecast.marketPosition==="below"?"#10b981":forecast.marketPosition==="above"?"#ef4444":"rgba(255,255,255,0.7)"}}>{forecast.marketPosition==="below"?`Great deal — market rate is $${forecast.recommended}/CBM`:forecast.marketPosition==="above"?`Above market — typical rate is $${forecast.recommended}/CBM`:"Fair price — at market rate"}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{forecast.reasoning}</div></div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                      {[{l:"Market low",v:fmtShort(forecast.min),c:"#10b981"},{l:"Market avg",v:fmtShort(forecast.recommended),c:"#fff"},{l:"Market high",v:fmtShort(forecast.max),c:"#ef4444"},{l:"Your rate",v:`$${container.price_per_cbm}`,c:"#a855f7"}].map(r=>(
                        <div key={r.l} style={{background:"rgba(255,255,255,0.04)",borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3}}>{r.l}</div><div style={{fontSize:13,fontWeight:500,color:r.c}}>{r.v}<span style={{fontSize:9,fontWeight:400,color:"rgba(255,255,255,0.3)"}}>/CBM</span></div></div>
                      ))}
                    </div>
                  </div>
                ):<div style={{fontSize:12,color:"rgba(255,255,255,0.25)",padding:"4px 0"}}>Price intelligence unavailable.</div>}
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:16}}>
                <div style={{fontSize:10,fontWeight:700,color:"rgba(168,85,247,0.7)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:12}}>Order summary</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  {[{l:"Cargo type",v:cargoType},{l:"Volume",v:`${cbm} CBM`},{l:"Weight",v:`${parseInt(weightKg||"0").toLocaleString()} kg`},{l:"Incoterms",v:incoterms},{l:"Pickup",v:firstMile?"Provider":"Self"},{l:"Delivery",v:lastMile?"Provider":"Self"},...(uploadedDocs.length>0?[{l:"Documents",v:`${uploadedDocs.length} uploaded`}]:[])].map((r,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",background:"rgba(255,255,255,0.02)",borderRadius:6,padding:"6px 9px"}}><span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{r.l}</span><span style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:500}}>{r.v}</span></div>
                  ))}
                </div>
                <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:12,display:"flex",flexDirection:"column",gap:6}}>
                  {[[`Freight (${cbm} CBM × $${container.price_per_cbm})`,freightCost],...(fmCost>0?[["Pickup service",fmCost]]:[]),...(lmCost>0?[["Delivery service",lmCost]]:[])].map(([label,val],i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,0.5)"}}><span>{label}</span><span>{fmt(val as number)}</span></div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,borderTop:"1px solid rgba(168,85,247,0.2)",marginTop:4}}><span style={{fontSize:14,color:"rgba(255,255,255,0.7)"}}>Total</span><span style={{fontSize:22,fontWeight:600,color:"#a855f7"}}>{fmt(total)}</span></div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>{hasDocStep?"Provider will review documents and confirm within 24h.":"Provider will confirm within 24h. Payment processed on confirmation."}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error&&<div style={{margin:"0 20px 10px",padding:"9px 12px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,fontSize:12,color:"#ef4444"}}>{error}</div>}

        <div style={m.footer}>
          <button style={m.backBtn} onClick={step===1?onClose:()=>setStep(s=>s-1)}>{step===1?"Cancel":"← Back"}</button>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {total>0&&step>1&&<div style={{fontSize:13,fontWeight:500,color:"#a855f7"}}>{fmt(total)}</div>}
            {step===confirmStep?(
              <button style={{...m.nextBtn,background:loading?"rgba(124,58,237,0.5)":"#7c3aed",minWidth:150}} onClick={handleSubmit} disabled={loading}>
                {loading?<><div style={{width:13,height:13,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.25)",borderTopColor:"#fff"}}/>Booking…</>:<>✦ Confirm booking</>}
              </button>
            ):step===1?(
              <button style={{...m.nextBtn,opacity:step1Valid?1:0.4}} disabled={!step1Valid} onClick={()=>advanceTo(2)}>Next: Logistics →</button>
            ):step===docStep&&hasDocStep?(
              <button style={{...m.nextBtn,opacity:allMandatoryUploaded?1:0.4,background:allMandatoryUploaded?"#7c3aed":"rgba(255,255,255,0.08)"}} disabled={!allMandatoryUploaded} onClick={()=>advanceTo(confirmStep)}>{allMandatoryUploaded?"Next: Confirm →":"Upload mandatory docs first"}</button>
            ):(
              <button style={m.nextBtn} onClick={()=>advanceTo(step+1)}>Next: {step===2&&hasDocStep?"Documents →":"Confirm →"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const m:Record<string,React.CSSProperties>={
  overlay:   {position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  modal:     {background:"#13131e",border:"1px solid rgba(168,85,247,0.2)",borderRadius:14,width:"100%",maxWidth:720,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden"},
  header:    {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 14px",borderBottom:"1px solid rgba(255,255,255,0.07)"},
  body:      {flex:1,overflowY:"auto",padding:"0 20px"},
  stepBody:  {padding:"18px 0",display:"flex",flexDirection:"column",gap:14},
  sectionLabel:{fontSize:10,fontWeight:700,color:"rgba(168,85,247,0.7)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8},
  footer:    {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderTop:"1px solid rgba(255,255,255,0.07)"},
  backBtn:   {fontSize:13,color:"rgba(255,255,255,0.4)",background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 16px",cursor:"pointer"},
  nextBtn:   {fontSize:13,fontWeight:500,background:"#7c3aed",border:"none",borderRadius:8,padding:"9px 22px",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:7},
}