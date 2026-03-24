import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"

interface Auction {
  id: string
  origin: string
  destination: string
  container_type: string
  cbm: number
  refrigerated: boolean
  start_price: number
  current_bid: number | null
  current_bidder_id: string | null
  reserve_price: number | null
  ends_at: string
  status: string
  my_max_bid?: number
  my_bid_count?: number
}

interface Props {
  traderId?: string
  onNavigate?: () => void
}

// Demo auctions shown if Supabase table doesn't exist yet
const DEMO_AUCTIONS: Auction[] = [
  { id:"demo-1", origin:"Mumbai, India", destination:"Dubai, UAE", container_type:"40ft_standard", cbm:67, refrigerated:false, start_price:1200, current_bid:1650, current_bidder_id:"other", reserve_price:2000, ends_at:new Date(Date.now()+2*3600*1000+14*60*1000).toISOString(), status:"active" },
  { id:"demo-2", origin:"Shanghai, China", destination:"Rotterdam, Netherlands", container_type:"40ft_high_cube", cbm:76, refrigerated:false, start_price:2000, current_bid:2450, current_bidder_id:"me", reserve_price:3000, ends_at:new Date(Date.now()+18*3600*1000+32*60*1000).toISOString(), status:"active" },
  { id:"demo-3", origin:"Mumbai, India", destination:"Singapore", container_type:"20ft_reefer", cbm:28, refrigerated:true, start_price:900, current_bid:null, current_bidder_id:null, reserve_price:1400, ends_at:new Date(Date.now()+47*3600*1000).toISOString(), status:"active" },
  { id:"demo-4", origin:"Dubai, UAE", destination:"Rotterdam, Netherlands", container_type:"40ft_standard", cbm:67, refrigerated:false, start_price:1800, current_bid:2100, current_bidder_id:"other", reserve_price:2500, ends_at:new Date(Date.now()+4*60*1000+30*1000).toISOString(), status:"active" },
]

function formatCountdown(endsAt: string): { display: string; urgent: boolean; critical: boolean; ended: boolean } {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return { display: "Ended", urgent: false, critical: false, ended: true }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const critical = diff < 5 * 60 * 1000    // under 5 min
  const urgent   = diff < 60 * 60 * 1000   // under 1 hour
  if (h > 0) return { display: `${h}h ${m}m`, urgent, critical, ended: false }
  if (m > 0) return { display: `${m}m ${s}s`, urgent, critical, ended: false }
  return { display: `${s}s`, urgent, critical, ended: false }
}

const fmt = (n: number) => "$" + n.toLocaleString()
const shortRoute = (o: string, d: string) => `${o.split(",")[0]} → ${d.split(",")[0]}`

export function AuctionWatchlist({ traderId, onNavigate }: Props) {
  const [auctions,     setAuctions]     = useState<Auction[]>([])
  const [loading,      setLoading]      = useState(true)
  const [isDemo,       setIsDemo]       = useState(false)
  const [ticks,        setTicks]        = useState(0) // force re-render for countdown
  const [bidAmounts,   setBidAmounts]   = useState<Record<string, string>>({})
  const [bidLoading,   setBidLoading]   = useState<Record<string, boolean>>({})
  const [bidMsg,       setBidMsg]       = useState<Record<string, { ok: boolean; text: string }>>({})
  const [filter,       setFilter]       = useState<"all"|"winning"|"outbid"|"ending">("all")
  const [expanded,     setExpanded]     = useState<string|null>(null)

  // Countdown tick every second
  useEffect(() => {
    const t = setInterval(() => setTicks(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const loadAuctions = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select("*")
        .eq("status", "active")
        .order("ends_at", { ascending: true })
        .limit(8)

      if (error || !data) throw error

      // Attach personal bid info
      if (traderId && data.length > 0) {
        const { data: myBids } = await supabase
          .from("auction_bids")
          .select("auction_id, amount")
          .eq("bidder_id", traderId)

        const mapped = data.map(a => {
          const mine = myBids?.filter(b => b.auction_id === a.id) ?? []
          return {
            ...a,
            my_max_bid:   mine.length ? Math.max(...mine.map(b => b.amount)) : undefined,
            my_bid_count: mine.length,
          }
        })
        setAuctions(mapped)
      } else {
        setAuctions(data)
      }
      setIsDemo(false)
    } catch {
      // Table doesn't exist yet — show demo data
      setAuctions(DEMO_AUCTIONS.map(a => ({
        ...a,
        current_bidder_id: a.current_bidder_id === "me" ? (traderId ?? "me") : a.current_bidder_id,
        my_max_bid: a.current_bidder_id === "me" ? ((a.current_bid ?? 0) + 200) : undefined,
      })))
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }, [traderId])

  useEffect(() => { loadAuctions() }, [loadAuctions])

  // Real-time subscription
  useEffect(() => {
    if (isDemo) return
    const ch = supabase.channel("auction-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions" }, () => loadAuctions())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "auction_bids" }, () => loadAuctions())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [isDemo, loadAuctions])

  const placeBid = async (auctionId: string, currentBid: number | null) => {
    const amount = parseFloat(bidAmounts[auctionId] ?? "")
    const minBid = (currentBid ?? 0) + 50
    if (!amount || amount < minBid) {
      setBidMsg(p => ({ ...p, [auctionId]: { ok: false, text: `Min bid is ${fmt(minBid)}` } }))
      return
    }
    if (!traderId) { setBidMsg(p => ({ ...p, [auctionId]: { ok: false, text: "Sign in to bid" } })); return }
    if (isDemo) { setBidMsg(p => ({ ...p, [auctionId]: { ok: true, text: `Demo: bid ${fmt(amount)} placed!` } })); return }

    setBidLoading(p => ({ ...p, [auctionId]: true }))
    try {
      const { error: bErr } = await supabase.from("auction_bids").insert({ auction_id: auctionId, bidder_id: traderId, amount })
      if (bErr) throw bErr
      await supabase.from("auctions").update({ current_bid: amount, current_bidder_id: traderId }).eq("id", auctionId).lt("current_bid", amount)
      setBidMsg(p => ({ ...p, [auctionId]: { ok: true, text: `Bid ${fmt(amount)} placed!` } }))
      setBidAmounts(p => ({ ...p, [auctionId]: "" }))
      setTimeout(() => setBidMsg(p => { const n={...p}; delete n[auctionId]; return n }), 3000)
      loadAuctions()
    } catch (e: any) {
      setBidMsg(p => ({ ...p, [auctionId]: { ok: false, text: e?.message ?? "Bid failed" } }))
    } finally {
      setBidLoading(p => ({ ...p, [auctionId]: false }))
    }
  }

  const filtered = auctions.filter(a => {
    if (filter === "winning")   return a.current_bidder_id === traderId
    if (filter === "outbid")    return a.my_max_bid && a.current_bidder_id !== traderId
    if (filter === "ending")    return new Date(a.ends_at).getTime() - Date.now() < 3600000
    return true
  })

  const winningCount = auctions.filter(a => a.current_bidder_id === traderId).length
  const outbidCount  = auctions.filter(a => a.my_max_bid && a.current_bidder_id !== traderId).length
  const endingCount  = auctions.filter(a => new Date(a.ends_at).getTime() - Date.now() < 3600000).length

  return (
    <div style={cs.card}>
      {/* Header */}
      <div style={cs.header}>
        <div style={cs.headerLeft}>
          <div style={cs.headerIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <div>
            <div style={cs.headerTitle}>Auction Watchlist</div>
            <div style={cs.headerSub}>Live bids · real-time updates{isDemo ? " · demo mode" : ""}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {winningCount>0&&<div style={cs.winBadge}>✓ Winning {winningCount}</div>}
          {outbidCount>0&&<div style={cs.outbidBadge}>↑ Outbid {outbidCount}</div>}
          <button style={cs.viewAllBtn} onClick={onNavigate}>View all →</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={cs.filterRow}>
        {([
          { k:"all",     l:`All (${auctions.length})` },
          { k:"winning", l:`Winning (${winningCount})` },
          { k:"outbid",  l:`Outbid (${outbidCount})` },
          { k:"ending",  l:`Ending soon (${endingCount})` },
        ] as const).map(f=>(
          <button
            key={f.k}
            style={{ ...cs.filterTab, ...(filter===f.k ? cs.filterTabActive : {}) }}
            onClick={()=>setFilter(f.k as any)}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* Auction list */}
      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[1,2,3].map(i=><div key={i} style={cs.skRow}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={cs.empty}>
          <div style={{ fontSize:28, marginBottom:8 }}>🏷️</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>No auctions in this filter</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {filtered.map(a => {
            const cd       = formatCountdown(a.ends_at)
            const isWinning = a.current_bidder_id === traderId
            const isOutbid  = a.my_max_bid !== undefined && !isWinning
            const minNext   = (a.current_bid ?? a.start_price) + 50
            const bidInput  = bidAmounts[a.id] ?? ""
            const isOpen    = expanded === a.id
            const reserveMet = a.reserve_price ? (a.current_bid ?? 0) >= a.reserve_price : true
            const bidCount  = a.my_bid_count ?? 0

            return (
              <div key={a.id} style={{ ...cs.auctionCard, ...(isWinning?cs.auctionWinning:isOutbid?cs.auctionOutbid:{}), ...(cd.critical?cs.auctionCritical:{}) }}>
                {/* Main row */}
                <div style={cs.auctionMain} onClick={()=>setExpanded(isOpen?null:a.id)}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                      <span style={{ fontSize:12, fontWeight:500, color:"#fff" }}>{shortRoute(a.origin, a.destination)}</span>
                      {a.refrigerated && <span style={cs.reeferBadge}>❄</span>}
                      {isWinning && <span style={cs.winLabel}>Winning</span>}
                      {isOutbid  && <span style={cs.outbidLabel}>Outbid</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>
                        {a.container_type?.replace(/_/g," ")} · {a.cbm} CBM
                      </span>
                      {!reserveMet && <span style={{ fontSize:9, padding:"1px 5px", borderRadius:9, background:"rgba(245,158,11,0.15)", color:"#f59e0b" }}>Reserve not met</span>}
                    </div>
                  </div>

                  {/* Current bid */}
                  <div style={{ textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:2 }}>Current bid</div>
                    <div style={{ fontSize:15, fontWeight:600, color: isWinning?"#10b981":isOutbid?"#ef4444":"#a855f7" }}>
                      {a.current_bid ? fmt(a.current_bid) : fmt(a.start_price)}
                    </div>
                    {a.my_max_bid && (
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>
                        my max: {fmt(a.my_max_bid)}
                      </div>
                    )}
                  </div>

                  {/* Countdown */}
                  <div style={{ textAlign:"right", flexShrink:0, minWidth:72 }}>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:2 }}>Ends in</div>
                    <div style={{ fontSize:14, fontWeight:700, color: cd.critical?"#ef4444":cd.urgent?"#f59e0b":"rgba(255,255,255,0.7)", fontVariantNumeric:"tabular-nums" }}>
                      {cd.display}
                    </div>
                    {cd.critical && <div style={{ fontSize:9, color:"#ef4444", marginTop:1 }}>⚡ Hurry!</div>}
                  </div>

                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" style={{ flexShrink:0, transform:isOpen?"rotate(180deg)":"none", transition:"transform .15s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>

                {/* Expanded bid area */}
                {isOpen && (
                  <div style={cs.bidArea}>
                    <div style={cs.bidAreaDivider}/>

                    {/* Bid history visual */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>Start: {fmt(a.start_price)}</span>
                          {a.reserve_price&&<span style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>Reserve: {fmt(a.reserve_price)}</span>}
                        </div>
                        <div style={cs.bidBar}>
                          <div style={{ height:"100%", borderRadius:2, width: `${Math.min(((a.current_bid??a.start_price)-a.start_price)/((a.reserve_price??a.start_price*2)-a.start_price)*100,100)}%`, background: reserveMet?"#10b981":"#f59e0b", transition:"width .4s" }}/>
                          {a.reserve_price&&<div style={{ position:"absolute", left:`${((a.reserve_price-a.start_price)/((a.reserve_price*1.5)-a.start_price))*100}%`, top:-3, width:2, height:10, background:"rgba(245,158,11,0.7)", borderRadius:1 }}/>}
                        </div>
                      </div>
                      {bidCount>0&&<div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{bidCount} bid{bidCount!==1?"s":""} placed</div>}
                    </div>

                    {/* Place bid */}
                    {!cd.ended && (
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <div style={{ flex:1, position:"relative" }}>
                          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"rgba(255,255,255,0.4)", pointerEvents:"none" }}>$</span>
                          <input
                            style={cs.bidInput}
                            type="number"
                            min={minNext}
                            step={50}
                            placeholder={`Min ${fmt(minNext)}`}
                            value={bidInput}
                            onChange={e=>setBidAmounts(p=>({...p,[a.id]:e.target.value}))}
                            onClick={e=>e.stopPropagation()}
                          />
                        </div>
                        <button
                          style={{ ...cs.bidBtn, opacity: bidLoading[a.id] ? 0.6 : 1 }}
                          onClick={e=>{ e.stopPropagation(); placeBid(a.id, a.current_bid) }}
                          disabled={bidLoading[a.id]}
                        >
                          {bidLoading[a.id] ? "…" : isWinning ? "Raise bid" : "Place bid"}
                        </button>
                        {isWinning&&<div style={{ fontSize:11, color:"#10b981", flexShrink:0 }}>✓ You're leading</div>}
                      </div>
                    )}
                    {bidMsg[a.id] && (
                      <div style={{ fontSize:11, color: bidMsg[a.id].ok?"#10b981":"#ef4444", marginTop:6 }}>
                        {bidMsg[a.id].text}
                      </div>
                    )}
                    {cd.ended && <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", textAlign:"center", padding:"8px 0" }}>This auction has ended</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div style={cs.footer}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>
          {isDemo ? "⬡ Demo data — create auctions table to go live" : `${auctions.length} live auction${auctions.length!==1?"s":""} · updates in real-time`}
        </div>
        <button style={cs.viewAllBtn} onClick={onNavigate}>Browse all →</button>
      </div>
    </div>
  )
}

const cs: Record<string, React.CSSProperties> = {
  card:            { background:"#13131e", border:"1px solid rgba(168,85,247,0.2)", borderRadius:12, padding:18, display:"flex", flexDirection:"column", gap:12 },
  header:          { display:"flex", alignItems:"center", justifyContent:"space-between" },
  headerLeft:      { display:"flex", alignItems:"center", gap:12 },
  headerIcon:      { width:36, height:36, borderRadius:9, background:"rgba(168,85,247,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  headerTitle:     { fontSize:14, fontWeight:600, color:"#fff", marginBottom:1 },
  headerSub:       { fontSize:11, color:"rgba(255,255,255,0.35)" },
  winBadge:        { fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(16,185,129,0.15)", color:"#10b981", fontWeight:600 },
  outbidBadge:     { fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(239,68,68,0.12)", color:"#ef4444", fontWeight:600 },
  viewAllBtn:      { fontSize:11, color:"#a855f7", background:"none", border:"none", cursor:"pointer", padding:0 },
  filterRow:       { display:"flex", gap:5, flexWrap:"wrap" },
  filterTab:       { fontSize:11, padding:"4px 10px", borderRadius:20, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.4)", cursor:"pointer" },
  filterTabActive: { borderColor:"rgba(168,85,247,0.4)", background:"rgba(168,85,247,0.12)", color:"#c084fc" },
  skRow:           { height:56, background:"rgba(255,255,255,0.04)", borderRadius:8 },
  empty:           { display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 0" },
  auctionCard:     { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:9, overflow:"hidden", cursor:"pointer" },
  auctionWinning:  { borderColor:"rgba(16,185,129,0.3)", background:"rgba(16,185,129,0.04)" },
  auctionOutbid:   { borderColor:"rgba(239,68,68,0.25)", background:"rgba(239,68,68,0.04)" },
  auctionCritical: { borderColor:"rgba(239,68,68,0.4)", animation:"none" },
  auctionMain:     { display:"flex", alignItems:"center", gap:12, padding:"10px 14px" },
  reeferBadge:     { fontSize:11, color:"#60a5fa", flexShrink:0 },
  winLabel:        { fontSize:9, padding:"1px 6px", borderRadius:9, background:"rgba(16,185,129,0.15)", color:"#10b981", fontWeight:600 },
  outbidLabel:     { fontSize:9, padding:"1px 6px", borderRadius:9, background:"rgba(239,68,68,0.12)", color:"#ef4444", fontWeight:600 },
  bidArea:         { padding:"0 14px 12px" },
  bidAreaDivider:  { height:1, background:"rgba(255,255,255,0.06)", marginBottom:12 },
  bidBar:          { height:4, background:"rgba(255,255,255,0.07)", borderRadius:2, overflow:"hidden", position:"relative" },
  bidInput:        { height:34, width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, padding:"0 10px 0 22px", color:"#fff", fontSize:12, outline:"none" },
  bidBtn:          { height:34, padding:"0 16px", background:"#7c3aed", border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0, whiteSpace:"nowrap" },
  footer:          { display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.06)" },
}
