import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { PortSelect, CargoTypeSelect, PopularRoutePills } from "@/components/shared/PortCargoDropdowns"

interface CargoItem {
  id: string; name: string; type: string
  weightKg: number | ""; cbm: number | ""
  fragile: boolean; dangerous: boolean; perishable: boolean
}

const newItem = (): CargoItem => ({
  id: Date.now().toString(), name: "", type: "general",
  weightKg: "", cbm: "", fragile: false, dangerous: false, perishable: false,
})

export function AICargoOptimizerSection() {
  const [items,       setItems]       = useState<CargoItem[]>([newItem()])
  const [origin,      setOrigin]      = useState("")
  const [destination, setDestination] = useState("")
  const [deadline,    setDeadline]    = useState("")
  const [claudeMode,  setClaudeMode]  = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<any>(null)
  const [error,       setError]       = useState("")
  const [collapsed,   setCollapsed]   = useState(false)

  const totalWeight = items.reduce((s, i) => s + (Number(i.weightKg) || 0), 0)
  const totalCBM    = items.reduce((s, i) => s + (Number(i.cbm) || 0), 0)

  const addItem    = () => setItems(p => [...p, newItem()])
  const removeItem = (id: string) => setItems(p => p.filter(i => i.id !== id))
  const update     = (id: string, f: string, v: any) => setItems(p => p.map(i => i.id === id ? { ...i, [f]: v } : i))

  const run = async () => {
    if (!origin || !destination) { setError("Please select both origin and destination ports."); return }
    const valid = items.filter(i => i.name.trim() || Number(i.weightKg) > 0)
    if (!valid.length) { setError("Add at least one cargo item."); return }
    setError(""); setLoading(true); setResult(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("cargo-split", {
        body: {
          cargoItems: valid.map(i => ({ name: i.name || `Item (${i.type})`, type: i.type, weightKg: Number(i.weightKg)||0, cbm: Number(i.cbm)||0, fragile: i.fragile, dangerous: i.dangerous })),
          origin, destination,
          requiredArrivalDate: deadline || new Date(Date.now()+30*86400000).toISOString().split("T")[0],
        },
      })
      if (fnErr) throw fnErr
      setResult(data)
    } catch (e: any) {
      setError(e?.message ?? "Optimizer failed. Check your cargo-split edge function.")
    } finally { setLoading(false) }
  }

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <div>
            <div style={s.title}>AI Cargo Optimizer</div>
            <div style={s.sub}>Smart split across available containers on the same route &amp; arrival date</div>
          </div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <div style={s.aiBadge}>✦ AI Powered</div>
          <button style={s.collapseBtn} onClick={()=>setCollapsed(p=>!p)}>{collapsed?"▾ Expand":"▴ Collapse"}</button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Cargo items */}
          <div style={s.sectionHdr}>
            <span style={s.sectionLabel}>Cargo items</span>
            <span style={s.sectionMeta}>{totalWeight||0}kg · {(totalCBM||0).toFixed(2)} CBM</span>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:10 }}>
            {items.map(item => (
              <div key={item.id} style={s.itemRow}>
                {/* Name */}
                <input style={{ ...s.inp, flex:2 }} placeholder="Item name" value={item.name} onChange={e=>update(item.id,"name",e.target.value)}/>

                {/* Cargo type — using proper dropdown */}
                <CargoTypeSelect
                  value={item.type}
                  onChange={v => update(item.id,"type",v||"general")}
                  showAllOption={false}
                />

                {/* Weight */}
                <div style={s.unitWrap}>
                  <input style={{ ...s.inp, borderRight:"none", borderRadius:"6px 0 0 6px" }} type="number" min="0" placeholder="0" value={item.weightKg} onChange={e=>update(item.id,"weightKg",e.target.value===""?"":parseFloat(e.target.value))}/>
                  <span style={s.unit}>kg</span>
                </div>

                {/* CBM */}
                <div style={s.unitWrap}>
                  <input style={{ ...s.inp, borderRight:"none", borderRadius:"6px 0 0 6px" }} type="number" min="0" step="0.1" placeholder="0" value={item.cbm} onChange={e=>update(item.id,"cbm",e.target.value===""?"":parseFloat(e.target.value))}/>
                  <span style={s.unit}>CBM</span>
                </div>

                {/* Flags */}
                <label style={s.chk}><input type="checkbox" checked={item.fragile} onChange={e=>update(item.id,"fragile",e.target.checked)} style={{accentColor:"#a855f7"}}/><span>Fragile</span></label>
                <label style={s.chk}><input type="checkbox" checked={item.dangerous} onChange={e=>update(item.id,"dangerous",e.target.checked)} style={{accentColor:"#ef4444"}}/><span style={{color:item.dangerous?"#ef4444":undefined}}>DG</span></label>
                <label style={s.chk}><input type="checkbox" checked={item.perishable} onChange={e=>update(item.id,"perishable",e.target.checked)} style={{accentColor:"#10b981"}}/><span>Perishable</span></label>

                {items.length>1&&<button style={s.removeBtn} onClick={()=>removeItem(item.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>}
              </div>
            ))}
          </div>
          <button style={s.addItemBtn} onClick={addItem}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add cargo item
          </button>

          {/* Route config */}
          <div style={s.routeCard}>
            <div style={s.routeCardHeader}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20A14.5 14.5 0 0 0 12 2"/><path d="M2 12h20"/></svg>
              <span style={s.routeCardTitle}>Route configuration</span>
            </div>

            {/* Popular route pills */}
            <div style={{ marginBottom: 14 }}>
              <PopularRoutePills
                onSelect={(o, d) => { setOrigin(o); setDestination(d) }}
                activeOrigin={origin}
                activeDestination={destination}
              />
            </div>

            {/* Port dropdowns */}
            <div style={s.routeFields}>
              <PortSelect
                label="Origin port"
                value={origin}
                onChange={setOrigin}
                placeholder="Select origin port…"
                excludeValue={destination}
              />
              <div style={s.routeArrow}>→</div>
              <PortSelect
                label="Destination port"
                value={destination}
                onChange={setDestination}
                placeholder="Select destination port…"
                excludeValue={origin}
              />
              <div style={{ minWidth: 200 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 5, display:"flex",alignItems:"center",gap:4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Delivery deadline
                </div>
                <input type="date" style={{ ...s.inp, height:40, width:"100%", borderRadius:8, colorScheme:"dark" }} value={deadline} min={new Date().toISOString().split("T")[0]} onChange={e=>setDeadline(e.target.value)}/>
              </div>
            </div>
          </div>

          {/* Claude mode */}
          <div style={s.claudeRow}>
            <div style={s.claudeIcon}>✦</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:500,color:"#fff" }}>Claude mode (advanced AI)</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2 }}>Deep logistics reasoning — groups fragile away from heavy cargo, flags DG conflicts, suggests optimal container order</div>
            </div>
            <button style={{ ...s.toggle, background:claudeMode?"#7c3aed":"rgba(255,255,255,0.08)" }} onClick={()=>setClaudeMode(p=>!p)}>
              <span style={{ ...s.toggleThumb, transform:claudeMode?"translateX(18px)":"translateX(2px)" }}/>
            </button>
          </div>

          {error && (
            <div style={s.errorBox}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button style={{ ...s.runBtn, opacity:loading?0.7:1 }} onClick={run} disabled={loading}>
            {loading ? (
              <><div style={s.spinner}/>Optimizing cargo split…</>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>Run AI cargo optimizer</>
            )}
          </button>

          {/* Result */}
          {result && (
            <div style={s.resultBox}>
              <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span style={{ fontSize:12,fontWeight:600,color:"#10b981" }}>Optimization complete</span>
              </div>
              <p style={{ fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:10,lineHeight:1.5 }}>{result.recommendation}</p>
              {result.splits?.map((split:any,i:number) => (
                <div key={i} style={s.splitCard}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5 }}>
                    <div style={{ fontSize:12,fontWeight:600,color:"#fff" }}>Container {i+1}</div>
                    <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                      <div style={{ fontSize:10,padding:"2px 8px",borderRadius:10,fontWeight:600,background:split.utilizationPercent>=80?"rgba(16,185,129,0.15)":split.utilizationPercent>=50?"rgba(245,158,11,0.15)":"rgba(239,68,68,0.12)",color:split.utilizationPercent>=80?"#10b981":split.utilizationPercent>=50?"#f59e0b":"#ef4444" }}>{split.utilizationPercent}% utilized</div>
                      {split.priceForSpace>0&&<div style={{ fontSize:12,fontWeight:600,color:"#a855f7" }}>${split.priceForSpace?.toFixed(2)}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:6 }}>{split.items?.join(", ")}</div>
                  <div style={{ display:"flex",gap:14,fontSize:10,color:"rgba(255,255,255,0.35)",flexWrap:"wrap" }}>
                    <span>⚖️ {split.totalWeightKg}kg</span>
                    <span>📦 {split.totalCBM?.toFixed(2)} CBM</span>
                    {split.departureDate&&<span>🗓 Departs {split.departureDate}</span>}
                    {split.arrivalDate&&<span>🏁 Arrives {split.arrivalDate}</span>}
                  </div>
                  {split.warnings?.map((w:string,j:number)=><div key={j} style={{ fontSize:10,color:"#f59e0b",marginTop:4 }}>⚠ {w}</div>)}
                </div>
              ))}
              {result.unallocated?.length>0&&(
                <div style={{ background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,padding:"10px 12px",marginBottom:8 }}>
                  <div style={{ fontSize:11,fontWeight:500,color:"#f59e0b",marginBottom:3 }}>⚠ Could not allocate:</div>
                  <div style={{ fontSize:11,color:"rgba(245,158,11,0.8)" }}>{result.unallocated.join(", ")}</div>
                </div>
              )}
              <div style={{ display:"flex",gap:20,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.07)",marginTop:8 }}>
                <div><div style={{ fontSize:10,color:"rgba(255,255,255,0.35)" }}>Containers used</div><div style={{ fontSize:13,fontWeight:500,color:"#fff",marginTop:1 }}>{result.containersUsed??result.splits?.length}</div></div>
                {result.totalCost>0&&<div><div style={{ fontSize:10,color:"rgba(255,255,255,0.35)" }}>Total cost</div><div style={{ fontSize:13,fontWeight:500,color:"#fff",marginTop:1 }}>${result.totalCost?.toFixed(2)}</div></div>}
                {result.savingsVsSingleContainer>0&&<div><div style={{ fontSize:10,color:"rgba(255,255,255,0.35)" }}>You save</div><div style={{ fontSize:13,fontWeight:600,color:"#10b981",marginTop:1 }}>${result.savingsVsSingleContainer?.toFixed(2)}</div></div>}
              </div>
              <button style={{ marginTop:12,fontSize:12,color:"rgba(255,255,255,0.35)",background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"6px 14px",cursor:"pointer",width:"100%" }} onClick={()=>{setResult(null);setError("")}}>Run another optimization</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s:Record<string,any>={
  card:        {background:"#13131e",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:20},
  header:      {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,paddingBottom:16,borderBottom:"1px solid rgba(255,255,255,0.07)"},
  headerLeft:  {display:"flex",alignItems:"center",gap:12},
  headerIcon:  {width:44,height:44,borderRadius:11,background:"rgba(168,85,247,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  title:       {fontSize:14,fontWeight:600,color:"#fff",marginBottom:2},
  sub:         {fontSize:11,color:"rgba(255,255,255,0.35)"},
  aiBadge:     {fontSize:10,fontWeight:700,color:"#a855f7",background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.25)",borderRadius:6,padding:"4px 10px",whiteSpace:"nowrap"},
  collapseBtn: {fontSize:11,color:"rgba(255,255,255,0.35)",background:"none",border:"none",cursor:"pointer",padding:"4px 8px"},
  sectionHdr:  {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8},
  sectionLabel:{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.5)"},
  sectionMeta: {fontSize:11,color:"rgba(255,255,255,0.3)"},
  itemRow:     {display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"8px 10px",flexWrap:"wrap"},
  inp:         {height:32,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:6,padding:"0 9px",color:"#fff",fontSize:12,outline:"none",minWidth:0,flex:1},
  unitWrap:    {display:"flex",alignItems:"center",flex:1,minWidth:70},
  unit:        {height:32,padding:"0 8px",background:"rgba(168,85,247,0.1)",border:"1px solid rgba(255,255,255,0.09)",borderLeft:"none",borderRadius:"0 6px 6px 0",fontSize:11,color:"rgba(168,85,247,0.7)",display:"flex",alignItems:"center",whiteSpace:"nowrap",flexShrink:0},
  chk:         {display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"rgba(255,255,255,0.45)",fontSize:11,flexShrink:0,whiteSpace:"nowrap"},
  removeBtn:   {background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center",flexShrink:0},
  addItemBtn:  {display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",height:34,fontSize:12,color:"rgba(168,85,247,0.7)",background:"none",border:"1px dashed rgba(168,85,247,0.3)",borderRadius:7,cursor:"pointer",marginBottom:14},
  routeCard:   {background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"14px 16px",marginBottom:12},
  routeCardHeader:{display:"flex",alignItems:"center",gap:6,marginBottom:10},
  routeCardTitle:{fontSize:10,fontWeight:700,color:"rgba(168,85,247,0.7)",textTransform:"uppercase",letterSpacing:".08em"},
  routeFields: {display:"flex",alignItems:"flex-end",gap:10,flexWrap:"wrap"},
  routeArrow:  {fontSize:18,color:"rgba(168,85,247,0.5)",paddingBottom:6,flexShrink:0},
  claudeRow:   {display:"flex",alignItems:"center",gap:12,background:"rgba(168,85,247,0.05)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:9,padding:"12px 14px",marginBottom:14},
  claudeIcon:  {width:30,height:30,borderRadius:8,background:"rgba(168,85,247,0.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"#a855f7",fontSize:15,flexShrink:0},
  toggle:      {width:40,height:22,borderRadius:11,border:"none",cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.2s",padding:0},
  toggleThumb: {position:"absolute",top:2,left:0,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"transform 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"},
  errorBox:    {display:"flex",alignItems:"center",gap:7,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:12,color:"#ef4444"},
  runBtn:      {width:"100%",height:48,background:"#7c3aed",border:"none",borderRadius:9,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"opacity 0.15s"},
  spinner:     {width:16,height:16,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.25)",borderTopColor:"#fff",animation:"spin 0.7s linear infinite"},
  resultBox:   {marginTop:16,padding:16,background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:10},
  splitCard:   {background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 14px",marginBottom:8},
}
