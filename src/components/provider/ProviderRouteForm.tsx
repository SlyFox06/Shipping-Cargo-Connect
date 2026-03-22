// src/components/provider/ProviderRouteForm.tsx
// Stub — prevents build errors from AddContainerModal and EditContainerModal

import { UseFormReturn } from "react-hook-form"

interface Props {
  form: UseFormReturn<any>
  onRouteChange?: (route: any) => void
}

export function ProviderRouteForm({ form, onRouteChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>Origin</label>
        <input
          style={{ width: "100%", height: 36, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0 10px", color: "#fff", fontSize: 13, outline: "none" }}
          placeholder="e.g. Mumbai, India"
          {...form.register("origin")}
        />
      </div>
      <div>
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>Destination</label>
        <input
          style={{ width: "100%", height: 36, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0 10px", color: "#fff", fontSize: 13, outline: "none" }}
          placeholder="e.g. Dubai, UAE"
          {...form.register("destination")}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>Departure date</label>
          <input
            type="date"
            style={{ width: "100%", height: 36, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark" }}
            {...form.register("departure_date")}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>Arrival date</label>
          <input
            type="date"
            style={{ width: "100%", height: 36, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark" }}
            {...form.register("arrival_date")}
          />
        </div>
      </div>
    </div>
  )
}
