// src/components/trader/BookingDocUpload.tsx
//
// Document upload step for the trader's booking modal.
// Fetches the required_documents list from the container/provider,
// lets the trader upload each one to Supabase Storage,
// and blocks booking submission until all mandatory docs are uploaded.
//
// USAGE inside BookingModal step 2 or as a standalone step:
//   import { BookingDocUpload } from "@/components/trader/BookingDocUpload"
//
//   <BookingDocUpload
//     requiredDocs={container.required_documents ?? []}
//     bookingId={draftBookingId}
//     traderId={user.id}
//     onComplete={(uploads) => setUploadedDocs(uploads)}
//   />
//
// Supabase Storage bucket needed:
//   Name: booking-documents
//   Public: false (private, provider accesses via signed URLs)
//   RLS: allow insert for authenticated users where storage.foldername(name)[1] = auth.uid()

import { useState, useRef } from "react"
import { supabase } from "@/integrations/supabase/client"
import type { RequiredDoc } from "@/components/provider/ContainerDocRequirements"

export interface UploadedDoc {
  docId: string
  docName: string
  fileName: string
  filePath: string
  fileSize: number
  uploadedAt: string
  status: "uploaded" | "pending" | "rejected"
}

interface Props {
  requiredDocs: RequiredDoc[]
  bookingId?: string
  traderId?: string
  onComplete: (uploads: UploadedDoc[]) => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"

export function BookingDocUpload({ requiredDocs, bookingId, traderId, onComplete }: Props) {
  const [uploads,   setUploads]   = useState<Record<string, UploadedDoc>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [errors,    setErrors]    = useState<Record<string, string>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const mandatory = requiredDocs.filter(d => d.mandatory)
  const optional  = requiredDocs.filter(d => !d.mandatory)
  const mandatoryUploaded = mandatory.filter(d => uploads[d.id]).length
  const allMandatoryDone  = mandatoryUploaded === mandatory.length

  const uploadDoc = async (doc: RequiredDoc, file: File) => {
    if (!traderId) { setErrors(p => ({ ...p, [doc.id]: "Not authenticated" })); return }
    if (file.size > 20 * 1024 * 1024) { setErrors(p => ({ ...p, [doc.id]: "Max file size is 20MB" })); return }

    setUploading(p => ({ ...p, [doc.id]: true }))
    setErrors(p => { const n = { ...p }; delete n[doc.id]; return n })

    try {
      const ext = file.name.split(".").pop()
      const safeName = doc.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()
      const path = `${traderId}/${bookingId ?? "draft"}/${safeName}_${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from("booking-documents")
        .upload(path, file, { contentType: file.type, upsert: true })

      if (upErr) throw upErr

      const uploaded: UploadedDoc = {
        docId: doc.id, docName: doc.name,
        fileName: file.name, filePath: path,
        fileSize: file.size, uploadedAt: new Date().toISOString(),
        status: "uploaded",
      }

      const newUploads = { ...uploads, [doc.id]: uploaded }
      setUploads(newUploads)
      onComplete(Object.values(newUploads))
    } catch (e: any) {
      setErrors(p => ({ ...p, [doc.id]: e?.message ?? "Upload failed. Try again." }))
    } finally {
      setUploading(p => ({ ...p, [doc.id]: false }))
    }
  }

  const removeUpload = async (doc: RequiredDoc) => {
    const up = uploads[doc.id]
    if (up) {
      try { await supabase.storage.from("booking-documents").remove([up.filePath]) } catch {}
    }
    const newUploads = { ...uploads }
    delete newUploads[doc.id]
    setUploads(newUploads)
    onComplete(Object.values(newUploads))
  }

  const renderDocRow = (doc: RequiredDoc) => {
    const up       = uploads[doc.id]
    const isUping  = uploading[doc.id]
    const err      = errors[doc.id]

    return (
      <div key={doc.id} style={{ ...ds.docRow, ...(up ? ds.docRowDone : err ? ds.docRowErr : {}) }}>
        {/* Status icon */}
        <div style={ds.statusIcon}>
          {up ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ) : isUping ? (
            <div style={ds.spinner}/>
          ) : err ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          )}
        </div>

        {/* Doc info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: up ? "#10b981" : "#fff" }}>{doc.name}</span>
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 9, fontWeight: 600, background: doc.mandatory ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)", color: doc.mandatory ? "#ef4444" : "rgba(255,255,255,0.35)" }}>
              {doc.mandatory ? "Required" : "Optional"}
            </span>
          </div>
          {doc.description && !up && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{doc.description}</div>
          )}
          {up && (
            <div style={{ fontSize: 11, color: "rgba(16,185,129,0.7)", marginTop: 2 }}>
              {up.fileName} · {formatBytes(up.fileSize)}
            </div>
          )}
          {err && (
            <div style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>{err}</div>
          )}
        </div>

        {/* Action */}
        <div style={{ flexShrink: 0 }}>
          {up ? (
            <button style={ds.removeBtn} onClick={() => removeUpload(doc)} title="Remove and re-upload">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ) : isUping ? (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Uploading…</span>
          ) : (
            <>
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                style={{ display: "none" }}
                ref={el => { fileRefs.current[doc.id] = el }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(doc, f) }}
              />
              <button style={ds.uploadBtn} onClick={() => fileRefs.current[doc.id]?.click()}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                Upload
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (requiredDocs.length === 0) {
    return (
      <div style={ds.noDocs}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(16,185,129,0.5)" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>No documents required by provider</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>You can proceed directly to confirmation.</div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Progress header */}
      <div style={ds.progressHeader}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>Document upload</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
            Provider requires {mandatory.length} mandatory doc{mandatory.length !== 1 ? "s" : ""}
            {optional.length > 0 ? ` · ${optional.length} optional` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: allMandatoryDone ? "#10b981" : "#a855f7" }}>
            {mandatoryUploaded}/{mandatory.length}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>mandatory</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={ds.progressBar}>
        <div style={{ height: "100%", borderRadius: 2, width: `${mandatory.length ? (mandatoryUploaded / mandatory.length) * 100 : 100}%`, background: allMandatoryDone ? "#10b981" : "#a855f7", transition: "width .3s" }}/>
      </div>

      {/* All clear banner */}
      {allMandatoryDone && mandatory.length > 0 && (
        <div style={ds.allClearBanner}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          All required documents uploaded. You can confirm your booking.
        </div>
      )}

      {/* Mandatory docs */}
      {mandatory.length > 0 && (
        <div>
          <div style={ds.groupLabel}>
            <span style={{ color: "#ef4444" }}>●</span> Required documents
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {mandatory.map(renderDocRow)}
          </div>
        </div>
      )}

      {/* Optional docs */}
      {optional.length > 0 && (
        <div>
          <div style={ds.groupLabel}>
            <span style={{ color: "#f59e0b" }}>●</span> Optional documents
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {optional.map(renderDocRow)}
          </div>
        </div>
      )}

      {/* Accepted formats note */}
      <div style={ds.formatsNote}>
        Accepted: PDF, DOC, DOCX, JPG, PNG, XLSX · Max 20MB per file
      </div>
    </div>
  )
}

const ds: Record<string, React.CSSProperties> = {
  docRow:          { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, transition: "border-color .15s" },
  docRowDone:      { borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.04)" },
  docRowErr:       { borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.04)" },
  statusIcon:      { width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  spinner:         { width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(168,85,247,0.25)", borderTopColor: "#a855f7" },
  uploadBtn:       { display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", background: "#7c3aed", border: "none", borderRadius: 7, color: "#fff", fontSize: 11, fontWeight: 500, cursor: "pointer", flexShrink: 0 },
  removeBtn:       { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" },
  progressHeader:  { display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  progressBar:     { height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" },
  allClearBanner:  { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 9, fontSize: 12, color: "#10b981" },
  groupLabel:      { display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 },
  formatsNote:     { fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center", paddingTop: 4 },
  noDocs:          { display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0", textAlign: "center" },
}
