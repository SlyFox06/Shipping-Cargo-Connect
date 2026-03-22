import { useState, useRef, useEffect } from "react"

// ─── Port data ────────────────────────────────────────────────────────────────
export const PORTS = [
  // India
  { value: "Mumbai, India",    label: "Mumbai",    country: "India",        code: "INNSA", flag: "🇮🇳", region: "South Asia" },
  { value: "Chennai, India",   label: "Chennai",   country: "India",        code: "INMAA", flag: "🇮🇳", region: "South Asia" },
  { value: "Kolkata, India",   label: "Kolkata",   country: "India",        code: "INCCU", flag: "🇮🇳", region: "South Asia" },
  { value: "Mundra, India",    label: "Mundra",    country: "India",        code: "INMUN", flag: "🇮🇳", region: "South Asia" },
  { value: "Cochin, India",    label: "Cochin",    country: "India",        code: "INCOK", flag: "🇮🇳", region: "South Asia" },
  { value: "Nhava Sheva, India",label:"Nhava Sheva",country:"India",        code: "INNSA", flag: "🇮🇳", region: "South Asia" },
  // Middle East
  { value: "Dubai, UAE",       label: "Dubai",     country: "UAE",          code: "AEDXB", flag: "🇦🇪", region: "Middle East" },
  { value: "Abu Dhabi, UAE",   label: "Abu Dhabi", country: "UAE",          code: "AEAUH", flag: "🇦🇪", region: "Middle East" },
  { value: "Sharjah, UAE",     label: "Sharjah",   country: "UAE",          code: "AESHJ", flag: "🇦🇪", region: "Middle East" },
  { value: "Jebel Ali, UAE",   label: "Jebel Ali", country: "UAE",          code: "AEJEA", flag: "🇦🇪", region: "Middle East" },
  // South/East Asia
  { value: "Singapore",        label: "Singapore", country: "Singapore",    code: "SGSIN", flag: "🇸🇬", region: "Southeast Asia" },
  { value: "Shanghai, China",  label: "Shanghai",  country: "China",        code: "CNSHA", flag: "🇨🇳", region: "East Asia" },
  { value: "Shenzhen, China",  label: "Shenzhen",  country: "China",        code: "CNSZX", flag: "🇨🇳", region: "East Asia" },
  { value: "Ningbo, China",    label: "Ningbo",    country: "China",        code: "CNNGB", flag: "🇨🇳", region: "East Asia" },
  { value: "Hong Kong",        label: "Hong Kong", country: "Hong Kong",    code: "HKHKG", flag: "🇭🇰", region: "East Asia" },
  { value: "Busan, South Korea",label:"Busan",     country: "South Korea",  code: "KRPUS", flag: "🇰🇷", region: "East Asia" },
  { value: "Tokyo, Japan",     label: "Tokyo",     country: "Japan",        code: "JPTYO", flag: "🇯🇵", region: "East Asia" },
  { value: "Colombo, Sri Lanka",label:"Colombo",   country: "Sri Lanka",    code: "LKCMB", flag: "🇱🇰", region: "South Asia" },
  { value: "Bangkok, Thailand",label: "Bangkok",   country: "Thailand",     code: "THBKK", flag: "🇹🇭", region: "Southeast Asia" },
  { value: "Karachi, Pakistan",label: "Karachi",   country: "Pakistan",     code: "PKKHK", flag: "🇵🇰", region: "South Asia" },
  // Europe
  { value: "Rotterdam, Netherlands",label:"Rotterdam",country:"Netherlands",code: "NLRTM", flag: "🇳🇱", region: "Europe" },
  { value: "Hamburg, Germany", label: "Hamburg",   country: "Germany",      code: "DEHAM", flag: "🇩🇪", region: "Europe" },
  { value: "Antwerp, Belgium", label: "Antwerp",   country: "Belgium",      code: "BEANR", flag: "🇧🇪", region: "Europe" },
  { value: "Felixstowe, UK",   label: "Felixstowe",country: "UK",           code: "GBFXT", flag: "🇬🇧", region: "Europe" },
  { value: "Barcelona, Spain", label: "Barcelona", country: "Spain",        code: "ESBCN", flag: "🇪🇸", region: "Europe" },
  // Africa
  { value: "Durban, South Africa",label:"Durban",  country:"South Africa",  code: "ZADUR", flag: "🇿🇦", region: "Africa" },
  { value: "Mombasa, Kenya",   label: "Mombasa",   country: "Kenya",        code: "KEMBA", flag: "🇰🇪", region: "Africa" },
  { value: "Lagos, Nigeria",   label: "Lagos",     country: "Nigeria",      code: "NGLOS", flag: "🇳🇬", region: "Africa" },
  // Americas
  { value: "New York, USA",    label: "New York",  country: "USA",          code: "USNYC", flag: "🇺🇸", region: "Americas" },
  { value: "Los Angeles, USA", label: "Los Angeles",country:"USA",          code: "USLAX", flag: "🇺🇸", region: "Americas" },
  { value: "Houston, USA",     label: "Houston",   country: "USA",          code: "USHOU", flag: "🇺🇸", region: "Americas" },
]

export const POPULAR_PAIRS = [
  { origin: "Mumbai, India",        destination: "Dubai, UAE",               label: "Mumbai → Dubai" },
  { origin: "Mumbai, India",        destination: "Singapore",                label: "Mumbai → Singapore" },
  { origin: "Shanghai, China",      destination: "Rotterdam, Netherlands",   label: "Shanghai → Rotterdam" },
  { origin: "Dubai, UAE",           destination: "Rotterdam, Netherlands",   label: "Dubai → Rotterdam" },
  { origin: "Chennai, India",       destination: "Dubai, UAE",               label: "Chennai → Dubai" },
  { origin: "Singapore",            destination: "Rotterdam, Netherlands",   label: "Singapore → Rotterdam" },
  { origin: "Mumbai, India",        destination: "Rotterdam, Netherlands",   label: "Mumbai → Rotterdam" },
  { origin: "Mundra, India",        destination: "Dubai, UAE",               label: "Mundra → Dubai" },
]

// ─── Cargo types ──────────────────────────────────────────────────────────────
export const CARGO_TYPES = [
  { value: "",                label: "All cargo types",       icon: "📋", category: "" },
  { value: "general",         label: "General cargo",         icon: "📦", category: "General" },
  { value: "textiles",        label: "Textiles & apparel",    icon: "👕", category: "General" },
  { value: "furniture",       label: "Furniture & fixtures",  icon: "🪑", category: "General" },
  { value: "paper",           label: "Paper & packaging",     icon: "📄", category: "General" },
  { value: "electronics",     label: "Electronics",           icon: "💻", category: "Electronics" },
  { value: "auto_parts",      label: "Auto parts",            icon: "🚗", category: "Electronics" },
  { value: "machinery",       label: "Machinery & equipment", icon: "⚙️", category: "Machinery" },
  { value: "fresh_produce",   label: "Fresh produce",         icon: "🥦", category: "Perishables", cold: true },
  { value: "frozen_food",     label: "Frozen food",           icon: "🧊", category: "Perishables", cold: true },
  { value: "pharmaceuticals", label: "Pharmaceuticals",       icon: "💊", category: "Perishables", cold: true },
  { value: "beverages",       label: "Beverages",             icon: "🍶", category: "Perishables" },
  { value: "chemicals",       label: "Chemicals (non-DG)",    icon: "🧪", category: "Hazardous" },
  { value: "dg_chemicals",    label: "Dangerous goods (DG)",  icon: "⚠️", category: "Hazardous", dg: true },
  { value: "flammables",      label: "Flammables",            icon: "🔥", category: "Hazardous", dg: true },
  { value: "metals",          label: "Metals & steel",        icon: "🔩", category: "Raw Materials" },
  { value: "timber",          label: "Timber & wood",         icon: "🪵", category: "Raw Materials" },
  { value: "construction",    label: "Construction materials", icon: "🧱", category: "Raw Materials" },
]

// ─── PortSelect ───────────────────────────────────────────────────────────────
interface PortSelectProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  excludeValue?: string
  label?: string
}

export function PortSelect({ value, onChange, placeholder = "Select port…", excludeValue, label }: PortSelectProps) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  const filtered = PORTS.filter(p =>
    p.value !== excludeValue && (
      !query ||
      p.label.toLowerCase().includes(query.toLowerCase()) ||
      p.country.toLowerCase().includes(query.toLowerCase()) ||
      p.code.toLowerCase().includes(query.toLowerCase()) ||
      p.value.toLowerCase().includes(query.toLowerCase())
    )
  )

  const grouped = filtered.reduce((acc: Record<string, typeof PORTS>, p) => {
    if (!acc[p.region]) acc[p.region] = []
    acc[p.region].push(p)
    return acc
  }, {})

  const selected = PORTS.find(p => p.value === value)

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      {label && <div style={ds.label}>{label}</div>}
      <div
        style={{ ...ds.trigger, borderColor: open ? "rgba(168,85,247,0.6)" : "rgba(255,255,255,0.1)" }}
        onClick={() => { setOpen(o => !o); setQuery("") }}
      >
        {selected ? (
          <div style={ds.selectedWrap}>
            <span style={{ fontSize: 16 }}>{selected.flag}</span>
            <div>
              <div style={ds.selectedLabel}>{selected.label}</div>
              <div style={ds.selectedSub}>{selected.country} · {selected.code}</div>
            </div>
          </div>
        ) : (
          <span style={ds.placeholder}>{placeholder}</span>
        )}
        {selected && (
          <button style={ds.clearBtn} onClick={e => { e.stopPropagation(); onChange(""); setQuery("") }}>×</button>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ marginLeft: 4, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {open && (
        <div style={ds.dropdown}>
          <div style={ds.searchWrap}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              autoFocus
              style={ds.searchInput}
              placeholder="Search port, country, or code…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          {/* Popular routes quick-pick (only when no search query) */}
          {!query && !excludeValue && (
            <div style={ds.popularSection}>
              <div style={ds.sectionLabel}>Popular origins</div>
              {[...new Set(POPULAR_PAIRS.map(p => p.origin))].map(o => {
                const port = PORTS.find(p => p.value === o)
                if (!port) return null
                return (
                  <div key={o} style={ds.item} onClick={() => { onChange(o); setOpen(false); setQuery("") }}>
                    <span style={{ fontSize: 14 }}>{port.flag}</span>
                    <span style={ds.itemLabel}>{port.label}</span>
                    <span style={ds.itemSub}>{port.country}</span>
                  </div>
                )
              })}
            </div>
          )}

          <div style={ds.list}>
            {Object.keys(grouped).length === 0 && (
              <div style={ds.empty}>No ports found</div>
            )}
            {Object.entries(grouped).map(([region, ports]) => (
              <div key={region}>
                <div style={ds.sectionLabel}>{region}</div>
                {ports.map(p => (
                  <div
                    key={p.value}
                    style={{ ...ds.item, background: value === p.value ? "rgba(168,85,247,0.12)" : undefined }}
                    onClick={() => { onChange(p.value); setOpen(false); setQuery("") }}
                  >
                    <span style={{ fontSize: 14 }}>{p.flag}</span>
                    <span style={ds.itemLabel}>{p.label}</span>
                    <span style={ds.itemSub}>{p.country}</span>
                    <span style={ds.itemCode}>{p.code}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CargoTypeSelect ──────────────────────────────────────────────────────────
interface CargoTypeSelectProps {
  value: string
  onChange: (v: string) => void
  label?: string
  showAllOption?: boolean
}

export function CargoTypeSelect({ value, onChange, label, showAllOption = true }: CargoTypeSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  const types = showAllOption ? CARGO_TYPES : CARGO_TYPES.filter(c => c.value !== "")
  const selected = types.find(c => c.value === value) ?? types[0]

  const grouped = types.filter(c => c.category).reduce((acc: Record<string, typeof CARGO_TYPES>, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push(c)
    return acc
  }, {})

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      {label && <div style={ds.label}>{label}</div>}
      <div
        style={{ ...ds.trigger, borderColor: open ? "rgba(168,85,247,0.6)" : "rgba(255,255,255,0.1)" }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: 16 }}>{selected?.icon ?? "📋"}</span>
        <span style={{ fontSize: 12, color: value ? "#fff" : "rgba(255,255,255,0.35)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? "All cargo types"}
        </span>
        {(selected as any)?.dg && <span style={ds.dgTag}>DG</span>}
        {(selected as any)?.cold && <span style={ds.coldTag}>❄</span>}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ marginLeft: 4, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {open && (
        <div style={{ ...ds.dropdown, minWidth: 260 }}>
          <div style={ds.list}>
            {showAllOption && (
              <div style={{ ...ds.item, background: !value ? "rgba(168,85,247,0.12)" : undefined }} onClick={() => { onChange(""); setOpen(false) }}>
                <span style={{ fontSize: 14 }}>📋</span>
                <span style={ds.itemLabel}>All cargo types</span>
              </div>
            )}
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div style={ds.sectionLabel}>{cat}</div>
                {items.map(c => (
                  <div
                    key={c.value}
                    style={{ ...ds.item, background: value === c.value ? "rgba(168,85,247,0.12)" : undefined }}
                    onClick={() => { onChange(c.value); setOpen(false) }}
                  >
                    <span style={{ fontSize: 14 }}>{c.icon}</span>
                    <span style={ds.itemLabel}>{c.label}</span>
                    {(c as any).dg   && <span style={ds.dgTag}>DG</span>}
                    {(c as any).cold && <span style={ds.coldTag}>❄</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PopularRoutePills ────────────────────────────────────────────────────────
// Quick-select buttons for popular routes
interface PopularRoutePillsProps {
  onSelect: (origin: string, destination: string) => void
  activeOrigin?: string
  activeDestination?: string
}

export function PopularRoutePills({ onSelect, activeOrigin, activeDestination }: PopularRoutePillsProps) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0, marginRight: 2 }}>Popular:</span>
      {POPULAR_PAIRS.map(pair => {
        const active = activeOrigin === pair.origin && activeDestination === pair.destination
        return (
          <button
            key={pair.label}
            style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 20,
              border: `1px solid ${active ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.08)"}`,
              background: active ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
              color: active ? "#c084fc" : "rgba(255,255,255,0.45)",
              cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap",
            }}
            onClick={() => onSelect(pair.origin, pair.destination)}
          >
            {pair.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Dropdown styles ──────────────────────────────────────────────────────────
const ds: Record<string, React.CSSProperties> = {
  label:        { fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 5 },
  trigger:      { display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 10px 0 12px", background: "rgba(255,255,255,0.05)", border: "1px solid", borderRadius: 8, cursor: "pointer", transition: "border-color 0.15s", overflow: "hidden" },
  selectedWrap: { display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  selectedLabel:{ fontSize: 13, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  selectedSub:  { fontSize: 10, color: "rgba(255,255,255,0.35)" },
  placeholder:  { fontSize: 12, color: "rgba(255,255,255,0.3)", flex: 1 },
  clearBtn:     { background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1, flexShrink: 0 },
  dropdown:     { position: "absolute", top: "calc(100% + 5px)", left: 0, width: "100%", minWidth: 220, background: "#1a1a28", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 10, zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", overflow: "hidden" },
  searchWrap:   { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  searchInput:  { flex: 1, background: "none", border: "none", color: "#fff", fontSize: 13, outline: "none" },
  popularSection:{ borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 6 },
  list:         { maxHeight: 280, overflowY: "auto" },
  sectionLabel: { fontSize: 10, fontWeight: 700, color: "rgba(168,85,247,0.6)", letterSpacing: ".08em", textTransform: "uppercase", padding: "8px 12px 3px" },
  item:         { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", transition: "background 0.1s" },
  itemLabel:    { fontSize: 13, color: "#fff", flex: 1 },
  itemSub:      { fontSize: 11, color: "rgba(255,255,255,0.35)" },
  itemCode:     { fontSize: 10, color: "rgba(168,85,247,0.6)", fontFamily: "monospace" },
  empty:        { padding: "16px 12px", fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center" },
  dgTag:        { fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(239,68,68,0.2)", color: "#ef4444", fontWeight: 600 },
  coldTag:      { fontSize: 12, color: "#60a5fa" },
}
