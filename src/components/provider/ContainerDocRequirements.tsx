// src/components/provider/ContainerDocRequirements.tsx
//
// Drop-in section for AddContainerModal Step 2 (or Step 3).
// Lets providers specify exactly which documents traders must upload before booking is confirmed.
// Supports: preset document types + custom doc names + per-doc instructions + mandatory/optional toggle.
//
// USAGE inside AddContainerModal:
//   import { ContainerDocRequirements } from "@/components/provider/ContainerDocRequirements"
//
//   // In state:
//   const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([])
//
//   // In Step 2 or Step 3 body:
//   <ContainerDocRequirements value={requiredDocs} onChange={setRequiredDocs} cargoType={cargoType} hazmat={hazmat} />
//
//   // When saving to Supabase:
//   required_documents: requiredDocs  // saves as JSONB column

import { useState } from "react"

export interface RequiredDoc {
  id: string
  name: string
  description: string
  mandatory: boolean
  category: string
}

// Preset doc library grouped by category
const DOC_PRESETS: { category: string; docs: { name: string; desc: string }[] }[] = [
  {
    category: "Core shipping",
    docs: [
      { name: "Bill of Lading",        desc: "Issued by carrier after cargo loaded" },
      { name: "Commercial Invoice",     desc: "Invoice from seller to buyer" },
      { name: "Packing List",           desc: "Detailed list of all packages & contents" },
      { name: "Booking Confirmation",   desc: "Signed booking confirmation copy" },
    ],
  },
  {
    category: "Customs & compliance",
    docs: [
      { name: "Certificate of Origin",  desc: "Country of manufacture certification" },
      { name: "Import Licence",         desc: "Required for restricted goods" },
      { name: "Export Licence",         desc: "Required for controlled exports" },
      { name: "Customs Declaration",    desc: "HS codes and declared value" },
    ],
  },
  {
    category: "Cargo-specific",
    docs: [
      { name: "MSDS / SDS",             desc: "Material Safety Data Sheet for chemicals" },
      { name: "DG Declaration",         desc: "Dangerous goods declaration (IMDG)" },
      { name: "Phytosanitary Certificate", desc: "For plants, food, agricultural goods" },
      { name: "Temperature Log",        desc: "Pre-shipment cold chain proof" },
      { name: "Fumigation Certificate", desc: "Required for wooden packaging" },
    ],
  },
  {
    category: "Insurance & finance",
    docs: [
      { name: "Insurance Certificate",  desc: "Cargo insurance coverage proof" },
      { name: "Letter of Credit",       desc: "Bank payment guarantee" },
      { name: "Bank Guarantee",         desc: "Financial security document" },
    ],
  },
]

// Smart presets based on cargo type
function getSuggestedDocs(cargoType: string, hazmat: boolean): string[] {
  const base = ["Commercial Invoice", "Packing List", "Bill of Lading"]
  const byType: Record<string, string[]> = {
    fresh_produce:   ["Phytosanitary Certificate", "Temperature Log"],
    frozen_food:     ["Temperature Log", "Phytosanitary Certificate"],
    chemicals:       ["MSDS / SDS", "Certificate of Origin"],
    dg_chemicals:    ["MSDS / SDS", "DG Declaration", "Certificate of Origin"],
    pharmaceuticals: ["Temperature Log", "Certificate of Origin", "Insurance Certificate"],
    electronics:     ["Insurance Certificate", "Certificate of Origin"],
    textiles:        ["Certificate of Origin"],
    timber:          ["Fumigation Certificate", "Phytosanitary Certificate"],
    auto_parts:      ["Certificate of Origin"],
    machinery:       ["Insurance Certificate", "Certificate of Origin"],
  }
  const extra = hazmat ? ["MSDS / SDS", "DG Declaration"] : []
  return [...new Set([...base, ...(byType[cargoType] ?? []), ...extra])]
}

interface Props {
  value: RequiredDoc[]
  onChange: (docs: RequiredDoc[]) => void
  cargoType?: string
  hazmat?: boolean
}

export function ContainerDocRequirements({ value, onChange, cargoType = "general", hazmat = false }: Props) {
  const [customDocName, setCustomDocName] = useState("")
  const [customDocDesc, setCustomDocDesc] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [showAllPresets, setShowAllPresets] = useState(false)

  const suggested = getSuggestedDocs(cargoType, hazmat)
  const allPresetNames = DOC_PRESETS.flatMap(g => g.docs.map(d => d.name))
  const addedNames = value.map(d => d.name)

  const addDoc = (name: string, desc: string, category: string, mandatory = true) => {
    if (addedNames.includes(name)) return
    onChange([...value, {
      id: Date.now().toString() + Math.random(),
      name, description: desc, mandatory, category,
    }])
  }

  const removeDoc = (id: string) => onChange(value.filter(d => d.id !== id))

  const toggleMandatory = (id: string) =>
    onChange(value.map(d => d.id === id ? { ...d, mandatory: !d.mandatory } : d))

  const addCustom = () => {
    if (!customDocName.trim()) return
    addDoc(customDocName.trim(), customDocDesc.trim(), "Custom", true)
    setCustomDocName("")
    setCustomDocDesc("")
    setShowCustomInput(false)
  }

  const applySuggested = () => {
    const toAdd: RequiredDoc[] = []
    for (const name of suggested) {
      if (addedNames.includes(name)) continue
      const preset = DOC_PRESETS.flatMap(g => g.docs).find(d => d.name === name)
      const cat = DOC_PRESETS.find(g => g.docs.some(d => d.name === name))?.category ?? "Core shipping"
      toAdd.push({ id: Date.now().toString() + Math.random(), name, description: preset?.desc ?? "", mandatory: true, category: cat })
    }
    onChange([...value, ...toAdd])
  }

  const unadded = suggested.filter(s => !addedNames.includes(s))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Section header */}
      <div style={ds.sectionHeader}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <div>
          <div style={ds.sectionTitle}>Required trader documents</div>
          <div style={ds.sectionSub}>Traders must upload all mandatory docs before you review their booking</div>
        </div>
      </div>

      {/* AI suggestion strip */}
      {unadded.length > 0 && (
        <div style={ds.suggestionStrip}>
          <div style={ds.suggestionLeft}>
            <span style={ds.aiTag}>✦ AI suggests</span>
            <span style={ds.suggestionText}>Based on <strong style={{ color: "#c084fc" }}>{cargoType}{hazmat ? " + DG" : ""}</strong> cargo: {unadded.slice(0, 3).join(", ")}{unadded.length > 3 ? ` +${unadded.length - 3} more` : ""}</span>
          </div>
          <button style={ds.applyBtn} onClick={applySuggested}>Apply all →</button>
        </div>
      )}

      {/* Added docs list */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {value.map(doc => (
            <div key={doc.id} style={ds.docRow}>
              <div style={ds.docIcon}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#fff" }}>{doc.name}</span>
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 9, fontWeight: 600, background: doc.mandatory ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)", color: doc.mandatory ? "#ef4444" : "rgba(255,255,255,0.4)" }}>
                    {doc.mandatory ? "Required" : "Optional"}
                  </span>
                  {doc.category !== "Custom" && (
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{doc.category}</span>
                  )}
                </div>
                {doc.description && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{doc.description}</div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  style={{ fontSize: 10, padding: "2px 8px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
                  onClick={() => toggleMandatory(doc.id)}
                >
                  Make {doc.mandatory ? "optional" : "required"}
                </button>
                <button style={ds.removeBtn} onClick={() => removeDoc(doc.id)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {value.length === 0 && (
        <div style={ds.emptyState}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>No documents added yet. Use presets below or apply AI suggestions above.</div>
        </div>
      )}

      {/* Preset picker */}
      <div style={ds.presetSection}>
        <div style={ds.presetTitle}>
          Add from library
          <button style={ds.togglePresetsBtn} onClick={() => setShowAllPresets(p => !p)}>
            {showAllPresets ? "Hide" : "Browse all"} →
          </button>
        </div>

        {showAllPresets ? (
          DOC_PRESETS.map(group => (
            <div key={group.category} style={{ marginBottom: 10 }}>
              <div style={ds.presetGroupLabel}>{group.category}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {group.docs.map(doc => {
                  const added = addedNames.includes(doc.name)
                  return (
                    <button
                      key={doc.name}
                      style={{ ...ds.presetChip, ...(added ? ds.presetChipAdded : {}) }}
                      onClick={() => !added && addDoc(doc.name, doc.desc, group.category)}
                      disabled={added}
                      title={doc.desc}
                    >
                      {added ? "✓ " : "+ "}{doc.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DOC_PRESETS[0].docs.map(doc => {
              const added = addedNames.includes(doc.name)
              return (
                <button key={doc.name} style={{ ...ds.presetChip, ...(added ? ds.presetChipAdded : {}) }} onClick={() => !added && addDoc(doc.name, doc.desc, "Core shipping")} disabled={added}>
                  {added ? "✓ " : "+ "}{doc.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Custom doc input */}
      {showCustomInput ? (
        <div style={ds.customInputWrap}>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={ds.customInput} placeholder="Document name *" value={customDocName} onChange={e => setCustomDocName(e.target.value)} autoFocus/>
            <input style={{ ...ds.customInput, flex: 2 }} placeholder="Instructions for trader (optional)" value={customDocDesc} onChange={e => setCustomDocDesc(e.target.value)}/>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={ds.addCustomBtn} onClick={addCustom} disabled={!customDocName.trim()}>Add document</button>
            <button style={ds.cancelCustomBtn} onClick={() => { setShowCustomInput(false); setCustomDocName(""); setCustomDocDesc("") }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button style={ds.addCustomTrigger} onClick={() => setShowCustomInput(true)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add custom document requirement
        </button>
      )}

      {/* Summary */}
      {value.length > 0 && (
        <div style={ds.summaryBar}>
          <div style={ds.summaryItem}>
            <span style={{ color: "#ef4444" }}>●</span>
            <span>{value.filter(d => d.mandatory).length} mandatory</span>
          </div>
          <div style={ds.summaryItem}>
            <span style={{ color: "#f59e0b" }}>●</span>
            <span>{value.filter(d => !d.mandatory).length} optional</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
            Traders must upload all mandatory docs to submit a booking
          </div>
        </div>
      )}
    </div>
  )
}

const ds: Record<string, React.CSSProperties> = {
  sectionHeader:     { display: "flex", alignItems: "flex-start", gap: 10 },
  sectionTitle:      { fontSize: 12, fontWeight: 600, color: "rgba(168,85,247,0.8)", textTransform: "uppercase", letterSpacing: ".07em" },
  sectionSub:        { fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 },
  suggestionStrip:   { display: "flex", alignItems: "center", gap: 10, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 9, padding: "9px 14px" },
  suggestionLeft:    { flex: 1, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  aiTag:             { fontSize: 10, fontWeight: 700, color: "#a855f7", background: "rgba(168,85,247,0.15)", borderRadius: 5, padding: "1px 7px", flexShrink: 0 },
  suggestionText:    { fontSize: 12, color: "rgba(255,255,255,0.55)" },
  applyBtn:          { fontSize: 11, fontWeight: 600, color: "#c084fc", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" },
  docRow:            { display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "9px 12px" },
  docIcon:           { width: 28, height: 28, borderRadius: 6, background: "rgba(168,85,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  removeBtn:         { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", flexShrink: 0 },
  emptyState:        { display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", textAlign: "center" },
  presetSection:     { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9, padding: "12px 14px" },
  presetTitle:       { fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" },
  presetGroupLabel:  { fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6, marginTop: 4 },
  presetChip:        { fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", cursor: "pointer", transition: "all .12s" },
  presetChipAdded:   { borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: "#10b981", cursor: "default" },
  togglePresetsBtn:  { fontSize: 11, color: "#a855f7", background: "none", border: "none", cursor: "pointer", padding: 0 },
  customInputWrap:   { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "12px 14px" },
  customInput:       { flex: 1, height: 34, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "0 10px", color: "#fff", fontSize: 12, outline: "none" },
  addCustomBtn:      { height: 32, padding: "0 14px", background: "#7c3aed", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  cancelCustomBtn:   { height: 32, padding: "0 12px", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" },
  addCustomTrigger:  { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 32, fontSize: 12, color: "rgba(168,85,247,0.6)", background: "none", border: "1px dashed rgba(168,85,247,0.25)", borderRadius: 7, cursor: "pointer", width: "100%" },
  summaryBar:        { display: "flex", alignItems: "center", gap: 14, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.5)" },
  summaryItem:       { display: "flex", alignItems: "center", gap: 5 },
}
