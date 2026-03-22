import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProviderLayout from "@/components/layout/ProviderLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalContainers: 0,
    activeBookings: 0,
    totalRevenue: 0,
    pendingRequests: 0,
  });
  const [isVerified, setIsVerified] = useState(false);
  const [containers, setContainers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      const { role } = await getUserRole(session.user.id);
      if (role !== 'provider') {
        navigate('/dashboard');
        return;
      }

      // Fetch provider stats
      const { data: provider } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (provider) {
        setIsVerified(provider.verified || false);
        fetchData(provider.id);

        // Set up real-time subscriptions
        const containerChannel = supabase
          .channel('provider-containers')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'containers',
              filter: `provider_id=eq.${provider.id}`
            },
            () => fetchData(provider.id)
          )
          .subscribe();

        const bookingChannel = supabase
          .channel('provider-bookings-dash')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bookings',
              filter: `provider_id=eq.${provider.id}`
            },
            () => fetchData(provider.id)
          )
          .subscribe();

        const verificationChannel = supabase
          .channel('provider-verification')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'providers',
              filter: `user_id=eq.${session.user.id}`
            },
            (payload) => {
              setIsVerified(payload.new.verified || false);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(containerChannel);
          supabase.removeChannel(bookingChannel);
          supabase.removeChannel(verificationChannel);
        };
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const fetchData = async (providerId: string) => {
    try {
      // Fetch containers
      const { data: containersData } = await supabase
        .from('containers')
        .select('*')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
        .limit(5);

      setContainers(containersData || []);

      // Fetch recent bookings
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, containers(*), profiles!bookings_trader_id_fkey(*)')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
        .limit(5);

      setBookings(bookingsData || []);

      // Fetch stats
      const { count: containerCount } = await supabase
        .from('containers')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId);

      const { count: bookingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId)
        .eq('status', 'confirmed');

      const { count: pendingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId)
        .eq('status', 'pending');

      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'succeeded')
        .in('booking_id', 
          (await supabase
            .from('bookings')
            .select('id')
            .eq('provider_id', providerId)).data?.map(b => b.id) || []
        );

      const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        totalContainers: containerCount || 0,
        activeBookings: bookingCount || 0,
        totalRevenue,
        pendingRequests: pendingCount || 0,
      });
    } catch (error) {
      console.error('Error fetching provider data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div style={s.shell}>
      <div style={s.sidebar}>
        <div style={s.logoWrap}>
          <div style={s.logoIcon}><NavIcon type="box" col="#a855f7"/></div>
          <div><div style={s.logoText}>CargoHub</div><div style={s.logoSub}>Provider</div></div>
        </div>
        <div style={s.navSection}>PROVIDER PANEL</div>
        <nav style={s.nav}>
          {NAV.map(item => {
            const active = location.pathname===item.path
            return (
              <div key={item.path} style={{...s.navItem,...(active?s.navActive:{})}} onClick={()=>navigate(item.path)}>
                <NavIcon type={item.icon} col={active?"#a855f7":"rgba(255,255,255,0.4)"}/>
                <span style={{...s.navLabel,color:active?"#a855f7":"rgba(255,255,255,0.55)"}}>{item.label}</span>
                {item.label==="My bookings"&&pendingB>0&&<span style={s.navBadge}>{pendingB}</span>}
              </div>
            )
          })}
        </nav>
        <div style={s.sidebarFooter}>
          <div style={s.userRow}>
            <div style={s.avatar}>{(user?.email??"P").substring(0,2).toUpperCase()}</div>
            <div style={s.userInfo}>
              <div style={s.userName}>{user?.email?.split("@")[0]??"Provider"}</div>
              <div style={s.userEmail}>{(user?.email??"").substring(0,22)}{(user?.email??"").length>22?"…":""}</div>
            </div>
          </div>
          <button style={{width:"100%", marginTop:8, padding:"8px", background:"rgba(239, 68, 68, 0.08)", border:"1px solid rgba(239, 68, 68, 0.2)", borderRadius:7, color:"#ef4444", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all 0.15s"}} onClick={async () => { await supabase.auth.signOut(); navigate("/") }}>
            <NavIcon type="signout" col="#ef4444"/>
            Log out
          </button>
        </div>
      </div>

      <div style={s.main}>
        <div style={s.topbar}>
          <div>
            <div style={s.pt}>Provider Dashboard</div>
            <div style={s.ps}>{today} · {containers.length} container{containers.length!==1?"s":""} active</div>
          </div>
          <div style={s.tr}>
            <div style={s.notifBtn}>
              <NavIcon type="bell"/>
              {pendingB>0&&<div style={s.notifDot}/>}
            </div>
            <button style={s.addBtn} onClick={()=>navigate("/dashboard/provider/containers")}>
              <span style={{fontSize: 16, lineHeight: 0.5}}>+</span> Add container
            </button>
          </div>
        </div>

        <div style={s.content}>
          {fillAlerts.map(c=>(
            <div key={c.id} style={s.alertStrip}>
              <div style={s.alertDot}/>
              <div style={s.alertText}><strong>{c.origin.split(",")[0]} → {c.destination.split(",")[0]}</strong> departs in {daysUntil(c.departure_date)} days at only <strong>{fillRate(c)}%</strong> fill rate.</div>
              <button style={s.alertBtn} onClick={()=>navigate(`/dashboard/provider/containers/${c.id}`)}>Review pricing →</button>
            </div>
          ))}

          <div style={s.stats4}>
            {[
              {label:"Total containers", val:String(containers.length),    sub:upcoming.length>0?`${upcoming.length} departing soon`:"None scheduled",       accent:"#a855f7", bg:"rgba(168,85,247,0.12)"},
              {label:"Active bookings",  val:String(activeB),              sub:pendingB>0?`${pendingB} need approval`:"All up to date",                      accent:"#10b981", bg:"rgba(16,185,129,0.12)"},
              {label:"Total revenue",    val:fmt(totalRev),                sub:bookings.length===0?"No bookings yet":`${bookings.filter(b=>b.status!=="cancelled").length} paid bookings`, accent:"#f59e0b", bg:"rgba(245,158,11,0.12)"},
              {label:"Avg fill rate",    val:containers.length===0?"—":avgFill+"%", sub:containers.length===0?"Add containers first":avgFill>=75?"Excellent":avgFill>=50?"Good":"Needs attention", accent:containers.length===0?"rgba(255,255,255,0.3)":fillColor(avgFill), bg:`${containers.length===0?"rgba(255,255,255,0.06)":fillColor(avgFill)+"22"}`},
            ].map(st=>(
              <div key={st.label} style={s.statCard}>
                <div style={{...s.statAccent,background:st.bg,border:`1px solid ${st.accent}44`}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:st.accent}}/>
                </div>
                <div>
                  <div style={s.statLabel}>{st.label}</div>
                  {loading?<div style={s.sk}/>:<div style={s.statVal}>{st.val}</div>}
                  <div style={{fontSize:11,color:st.accent,marginTop:2}}>{st.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={s.twoCol}>
            <div style={s.card}>
              <div style={s.cardH}><div style={s.cardT}>My containers</div><button style={s.va} onClick={()=>navigate("/dashboard/provider/containers")}>View all →</button></div>
              {loading?<Sk n={3}/>:containers.length===0?(
                <div style={s.emptyCard}>
                  <div style={{fontSize:28,marginBottom:10}}>📦</div>
                  <div style={s.emptyTitle}>No containers yet</div>
                  <div style={s.emptyDesc}>Add your first container to start receiving bookings from traders.</div>
                  <button style={s.emptyBtn} onClick={()=>navigate("/dashboard/provider/containers")}>Add container</button>
                </div>
              ):containers.slice(0,4).map(c=>{const fill=fillRate(c),fc=fillColor(fill),d=daysUntil(c.departure_date);return(
                <div key={c.id} style={s.contRow} onClick={()=>navigate(`/dashboard/provider/containers/${c.id}`)}>
                  <div style={{...s.dot,background:fc}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={s.routeLabel}>{c.origin.split(",")[0]} → {c.destination.split(",")[0]}</div>
                    <div style={s.routeSub}>{c.refrigerated?"Reefer":"Std"} · Departs in {d}d</div>
                    <div style={s.fillBg}><div style={{...s.fillFg,width:fill+"%",background:fc}}/></div>
                    <div style={{fontSize:10,color:fc,marginTop:2}}>{fill}% filled · {(c.available_cbm??0).toFixed(1)} CBM left</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:"#a855f7"}}>${(c.price_per_cbm??0).toFixed(0)}/CBM</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{c.status}</div>
                  </div>
                </div>
              )})}
            </div>
            <div style={s.card}>
              <div style={s.cardH}><div style={s.cardT}>Recent bookings</div><button style={s.va} onClick={()=>navigate("/dashboard/provider/bookings")}>View all →</button></div>
              {loading?<Sk n={4}/>:bookings.length===0?(
                <div style={s.emptyCard}>
                  <div style={{fontSize:28,marginBottom:10}}>📋</div>
                  <div style={s.emptyTitle}>No bookings yet</div>
                  <div style={s.emptyDesc}>Bookings appear here once traders book space on your containers.</div>
                </div>
              ):bookings.slice(0,5).map(b=>{const st=stStyle(b.status);return(
                <div key={b.id} style={s.bkRow} onClick={()=>navigate(`/dashboard/provider/bookings/${b.id}`)}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={s.bkId}>{shortId(b.id)}</div>
                    <div style={s.bkMeta}>{(b.origin??"").split(",")[0]} → {(b.destination??"").split(",")[0]}{b.weight_kg?` · ${b.weight_kg}kg`:""}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {b.total_price>0&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{fmt(b.total_price)}</div>}
                    <div style={{fontSize:10,padding:"2px 8px",borderRadius:14,fontWeight:500,...st}}>{b.status}</div>
                  </div>
                </div>
              )})}
            </div>
          </div>

          <div style={s.threeCol}>
            <div style={s.card}>
              <div style={s.cardH}>
                <div><div style={s.cardT}>Revenue overview</div><div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:1}}>Last {revMonths.length} months</div></div>
                <div style={{fontSize:18,fontWeight:700,color:"#fff"}}>{fmt(totalRev)}</div>
              </div>
              {revMonths.length===0?(
                <div style={{fontSize:12,color:"rgba(255,255,255,0.18)",textAlign:"center",padding:"22px 0"}}>Revenue chart appears once you receive bookings</div>
              ):(
                <div style={{display:"flex",alignItems:"flex-end",gap:5,height:60,margin:"10px 0 4px"}}>
                  {revMonths.map((m,i)=>{const pct=Math.round(m.total/revMax*100);const last=i===revMonths.length-1;return(
                    <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%"}}>
                      <div style={{width:"100%",borderRadius:"3px 3px 0 0",minHeight:3,background:last?"#a855f7":"rgba(168,85,247,0.28)",height:Math.max(pct,4)+"%"}}/>
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginTop:3}}>{m.month}</div>
                    </div>
                  )})}
                </div>
              )}
              <div style={{display:"flex",gap:20,marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>This month</div><div style={{fontSize:13,fontWeight:500,color:"#fff",marginTop:1}}>{fmt(thisMonthRev)}</div></div>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Bookings</div><div style={{fontSize:13,fontWeight:500,color:"#fff",marginTop:1}}>{bookings.filter(b=>b.status!=="cancelled").length}</div></div>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Avg/booking</div><div style={{fontSize:13,fontWeight:500,color:"#fff",marginTop:1}}>{bookings.filter(b=>b.status!=="cancelled").length>0?fmt(Math.round(totalRev/bookings.filter(b=>b.status!=="cancelled").length)):"—"}</div></div>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.cardH}><div style={s.cardT}>Upcoming departures</div></div>
              {loading?<Sk n={3}/>:upcoming.length===0?(
                <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",textAlign:"center",padding:"20px 0",lineHeight:1.6}}>No upcoming departures.<br/>Add containers to see departures here.</div>
              ):upcoming.slice(0,4).map(c=>{const fill=fillRate(c),fc=fillColor(fill),d=daysUntil(c.departure_date);return(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}} onClick={()=>navigate(`/dashboard/provider/containers/${c.id}`)}>
                  <div style={{width:36,height:36,borderRadius:8,background:"rgba(168,85,247,0.12)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#a855f7",lineHeight:1}}>{d}</div>
                    <div style={{fontSize:8,color:"rgba(168,85,247,0.5)"}}>days</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{c.origin.split(",")[0]} → {c.destination.split(",")[0]}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{new Date(c.departure_date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,fontWeight:500,color:fc}}>{fill}%</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.25)"}}>filled</div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>

          {/* AI SECTION */}
          <div style={s.aiSectionHeader}>
            <div style={s.aiSectionTitle}>
              <div style={s.aiSectionDot}/>
              AI Market Intelligence
            </div>
            <div style={s.aiSectionSub}>
              {containers.length===0
                ? "Platform-wide data — your personalised AI insights unlock when you add a container"
                : "Personalised to your active routes"}
            </div>
          </div>

          <div style={s.twoCol}>
            <div style={s.aiCard}>
              <div style={s.aiBadge}>AI</div>
              <div style={s.aiT}>Route demand forecast</div>
              <div style={s.aiS}>
                {containers.length===0
                  ? "Platform-wide trader search activity — next 30 days"
                  : "Trader search activity for your routes — next 30 days"}
              </div>
              {aiLoading?<Sk n={6}/>:aiDemand.slice(0,6).map((r:any,i:number)=>{
                const score = r.demandScore??0
                const sc = demandColor(score)
                const dl = demandLabel(score, r.bookingTrend??"stable")
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <div style={{fontSize:12,color:"#fff",flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {(r.origin?.split("(")[0]?.trim()?.split(",")[0]??"")} → {(r.destination?.split("(")[0]?.trim()?.split(",")[0]??"")}
                    </div>
                    <div style={{width:80,height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,flexShrink:0}}>
                      <div style={{height:"100%",borderRadius:2,width:score+"%",background:sc}}/>
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:sc,minWidth:24,textAlign:"right"}}>{score}</div>
                    <div style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:500,background:dl.bg,color:dl.c,flexShrink:0}}>{dl.label}</div>
                  </div>
                )
              })}
              {!aiLoading && aiDemand.length===0 && <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",textAlign:"center",padding:"16px 0"}}>Loading demand data…</div>}
              {!aiLoading && containers.length===0 && (
                <div style={{...s.insightBox,marginTop:10,borderColor:"rgba(168,85,247,0.25)",background:"rgba(168,85,247,0.06)"}}>
                  <div style={s.insightI}>✦</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>
                    <strong style={{color:"#c084fc"}}>Mumbai → Dubai</strong> and <strong style={{color:"#c084fc"}}>Singapore → Rotterdam</strong> have the highest trader demand right now. List a container on these routes to start earning.
                  </div>
                </div>
              )}
            </div>

            <div style={s.aiCard}>
              <div style={{...s.aiBadge,background:"rgba(59,130,246,0.2)",color:"#60a5fa"}}>LIVE</div>
              <div style={s.aiT}>Route weather & risk</div>
              <div style={s.aiS}>Current conditions on popular shipping routes</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {POPULAR_ROUTES.slice(0,6).map((r,i)=>(
                  <button key={i} style={{fontSize:10,padding:"4px 10px",borderRadius:20,border:"1px solid",cursor:"pointer",transition:"all .15s",borderColor:i===weatherRoute?"rgba(168,85,247,0.5)":"rgba(255,255,255,0.08)",background:i===weatherRoute?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.03)",color:i===weatherRoute?"#c084fc":"rgba(255,255,255,0.4)"}} onClick={()=>setWeatherRoute(i)}>
                    {r.label}
                  </button>
                ))}
              </div>
              {aiLoading?(
                <div style={{display:"flex",gap:8,marginBottom:12}}>{[0,1,2].map(i=><div key={i} style={{...s.sk,flex:1,height:90,borderRadius:9}}/>)}</div>
              ):(
                <div>
                  {aiWeather[weatherRoute] ? (
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:14,marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{POPULAR_ROUTES[weatherRoute].label}</div>
                        <div style={{fontSize:9,padding:"2px 8px",borderRadius:10,fontWeight:600,background:aiWeather[weatherRoute].risk==="high"?"rgba(239,68,68,0.15)":aiWeather[weatherRoute].risk==="medium"?"rgba(245,158,11,0.15)":"rgba(16,185,129,0.15)",color:aiWeather[weatherRoute].risk==="high"?"#ef4444":aiWeather[weatherRoute].risk==="medium"?"#f59e0b":"#10b981"}}>
                          {aiWeather[weatherRoute].risk==="low"?"Good conditions":"Moderate risk"}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:16}}>
                        <div style={{fontSize:36}}>{aiWeather[weatherRoute].icon}</div>
                        <div>
                          <div style={{fontSize:24,fontWeight:700,color:"#fff"}}>{aiWeather[weatherRoute].temp}°C</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>💨 {aiWeather[weatherRoute].wind}km/h at port</div>
                        </div>
                      </div>
                    </div>
                  ):(
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:14,marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#fff",marginBottom:6}}>{POPULAR_ROUTES[weatherRoute].label}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Loading weather data…</div>
                    </div>
                  )}
                </div>
              )}
              <div style={s.insightBox}>
                <div style={s.insightI}>i</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>
                  {containers.length===0
                    ? "Select any route above to see live weather conditions. Weather alerts affect delay risk."
                    : aiWeather[0]?.risk==="high" ? `High wind warning at ${POPULAR_ROUTES[0].destination}. Notify traders.` : "Conditions look manageable this week."
                  }
                </div>
              </div>
            </div>
          </div>

          <div style={s.twoCol}>
            <div style={s.aiCard}>
              <div style={s.aiBadge}>AI</div>
              <div style={s.aiT}>Revenue predictions</div>
              <div style={s.aiS}>
                {containers.length===0
                  ? "Estimated earnings potential based on platform market rates"
                  : "30 and 90-day revenue forecast for your containers"}
              </div>
              {containers.length===0 ? (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {label:"Mumbai → Dubai (20ft std)",   low:"$1,400", high:"$1,800", note:"High demand · avg 85% fill rate"},
                    {label:"Mumbai → Dubai (40ft reefer)", low:"$2,800", high:"$3,600", note:"Premium route · refrigerated commands +40%"},
                    {label:"Mumbai → Singapore (20ft)",   low:"$900",   high:"$1,200", note:"Growing demand · 12-day transit"},
                  ].map((r,i)=>(
                    <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                        <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>{r.label}</div>
                        <div style={{fontSize:12,fontWeight:600,color:"#10b981"}}>{r.low} – {r.high}</div>
                      </div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{r.note}</div>
                    </div>
                  ))}
                  <div style={{...s.insightBox,borderColor:"rgba(16,185,129,0.25)",background:"rgba(16,185,129,0.06)"}}>
                    <div style={{...s.insightI,background:"rgba(16,185,129,0.25)",color:"#10b981"}}>$</div>
                    <div style={{fontSize:11,color:"rgba(16,185,129,0.85)",lineHeight:1.5}}>Providers with 1–2 containers on high-demand routes earn <strong>$3,200–$6,800/month</strong>. Add a container to start.</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                    {[
                      {l:"This month",    v:fmt(thisMonthRev),                  c:"#fff"},
                      {l:"30-day est.",   v:fmt(Math.round(thisMonthRev*1.15)), c:"#10b981"},
                      {l:"90-day est.",   v:fmt(Math.round(thisMonthRev*3.2)),  c:"#a855f7"},
                    ].map(st=>(
                      <div key={st.l} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3}}>{st.l}</div>
                        <div style={{fontSize:15,fontWeight:600,color:st.c}}>{st.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={s.insightBox}>
                    <div style={s.insightI}>i</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>Projections based on your booking rate. Actual results depend on fill rates.</div>
                  </div>
                </div>
              )}
            </div>

            <div style={s.aiCard}>
              <div style={s.aiBadge}>AI</div>
              <div style={s.aiT}>Fill-rate alerts & tips</div>
              <div style={s.aiS}>
                {containers.length===0
                  ? "Platform insights to maximise container fill rates"
                  : "Personalised alerts for your containers"}
              </div>
              {aiLoading ? <Sk n={3}/> : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {revAlerts.map((alert:any,i:number)=>(
                    <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",borderRadius:9,border:"1px solid",borderColor:alert.type==="risk"?"rgba(239,68,68,0.25)":alert.type==="opportunity"?"rgba(168,85,247,0.25)":"rgba(245,158,11,0.2)",background:alert.type==="risk"?"rgba(239,68,68,0.06)":alert.type==="opportunity"?"rgba(168,85,247,0.06)":"rgba(245,158,11,0.06)"}}>
                      <div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:alert.type==="risk"?"rgba(239,68,68,0.25)":alert.type==="opportunity"?"rgba(168,85,247,0.25)":"rgba(245,158,11,0.2)",color:alert.type==="risk"?"#ef4444":alert.type==="opportunity"?"#a855f7":"#f59e0b",marginTop:1}}>
                        {alert.type==="risk"?"!":alert.type==="opportunity"?"✦":"→"}
                      </div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.6}}>{alert.message}</div>
                    </div>
                  ))}
                  {revAlerts.length===0&&(
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",textAlign:"center",padding:"16px 0"}}>No alerts right now. All looking good.</div>
                  )}
                </div>
              )}
              {containers.length===0&&(
                <div style={{marginTop:12}}>
                  <button style={{width:"100%",height:38,background:"#7c3aed",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}} onClick={()=>navigate("/dashboard/provider/containers")}>
                    + Add a container to start earning
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Sk({n}:{n:number}){return<div style={{display:"flex",flexDirection:"column",gap:8}}>{Array.from({length:n}).map((_,i)=><div key={i} style={{height:34,background:"rgba(255,255,255,0.04)",borderRadius:7}}/>)}</div>}

const s:Record<string,React.CSSProperties>={
  shell:          {display:"flex",minHeight:"100vh",background:"#0a0a0f",color:"#fff",fontFamily:"system-ui,sans-serif"},
  sidebar:        {width:210,minWidth:210,background:"#0f0f18",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",flexShrink:0},
  logoWrap:       {display:"flex",alignItems:"center",gap:10,padding:"18px 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  logoIcon:       {width:28,height:28,background:"rgba(168,85,247,0.15)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  logoText:       {fontSize:13,fontWeight:700,color:"#a855f7",lineHeight:1.1},
  logoSub:        {fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1},
  navSection:     {fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.18)",letterSpacing:".12em",padding:"14px 16px 6px"},
  nav:            {flex:1,padding:"4px 8px",display:"flex",flexDirection:"column",gap:1,overflowY:"auto"},
  navItem:        {display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,cursor:"pointer",transition:"all 0.12s"},
  navActive:      {background:"rgba(168,85,247,0.12)",borderLeft:"2px solid #a855f7",paddingLeft:8},
  navLabel:       {fontSize:12},
  navBadge:       {marginLeft:"auto",fontSize:9,background:"#a855f7",color:"#fff",borderRadius:9,padding:"1px 5px",fontWeight:700},
  sidebarFooter:  {padding:"10px 8px",borderTop:"1px solid rgba(255,255,255,0.06)"},
  userRow:        {display:"flex",alignItems:"center",gap:8,padding:"8px",borderRadius:8,background:"rgba(255,255,255,0.03)"},
  avatar:         {width:28,height:28,borderRadius:"50%",background:"rgba(168,85,247,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#a855f7",flexShrink:0},
  userInfo:       {flex:1,minWidth:0},
  userName:       {fontSize:11,color:"#fff",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  userEmail:      {fontSize:9,color:"rgba(255,255,255,0.25)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  main:           {flex:1,minWidth:0,overflow:"auto",display:"flex",flexDirection:"column"},
  topbar:         {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"#0a0a0f",position:"sticky",top:0,zIndex:10},
  pt:             {fontSize:17,fontWeight:700,color:"#fff"},
  ps:             {fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:2},
  tr:             {display:"flex",alignItems:"center",gap:10},
  notifBtn:       {position:"relative",width:34,height:34,borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"},
  notifDot:       {position:"absolute",top:7,right:7,width:7,height:7,background:"#a855f7",borderRadius:"50%",border:"2px solid #0a0a0f"},
  addBtn:         {display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#7c3aed",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:500,cursor:"pointer"},
  content:        {padding:"20px 22px",display:"flex",flexDirection:"column",gap:14,flex:1},
  alertStrip:     {background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:10},
  alertDot:       {width:6,height:6,borderRadius:"50%",background:"#f59e0b",flexShrink:0},
  alertText:      {fontSize:12,color:"rgba(245,158,11,0.85)",flex:1,lineHeight:1.5},
  alertBtn:       {fontSize:11,color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap"},
  stats4:         {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10},
  statCard:       {background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:14},
  statAccent:     {width:36,height:36,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  statLabel:      {fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:3},
  statVal:        {fontSize:22,fontWeight:700,color:"#fff"},
  sk:             {height:16,background:"rgba(255,255,255,0.05)",borderRadius:4,marginTop:2},
  twoCol:         {display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  threeCol:       {display:"grid",gridTemplateColumns:"2fr 1fr",gap:14},
  card:           {background:"#13131e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:18},
  cardH:          {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14},
  cardT:          {fontSize:13,fontWeight:600,color:"#fff"},
  va:             {fontSize:11,color:"#a855f7",background:"none",border:"none",cursor:"pointer",padding:0},
  contRow:        {display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"},
  dot:            {width:7,height:7,borderRadius:"50%",flexShrink:0,marginTop:4},
  routeLabel:     {fontSize:12,fontWeight:500,color:"#fff"},
  routeSub:       {fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1},
  fillBg:         {height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,marginTop:5,overflow:"hidden"},
  fillFg:         {height:"100%",borderRadius:2},
  bkRow:          {display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"},
  bkId:           {fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:"monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  bkMeta:         {fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:1},
  emptyCard:      {display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 16px",textAlign:"center"},
  emptyTitle:     {fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.45)",marginBottom:6},
  emptyDesc:      {fontSize:12,color:"rgba(255,255,255,0.25)",lineHeight:1.5,marginBottom:12},
  emptyBtn:       {fontSize:12,padding:"7px 16px",background:"rgba(168,85,247,0.15)",border:"1px solid rgba(168,85,247,0.3)",borderRadius:8,color:"#a855f7",cursor:"pointer"},
  aiSectionHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0"},
  aiSectionTitle: {display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600,color:"#fff"},
  aiSectionDot:   {width:8,height:8,borderRadius:"50%",background:"#a855f7",flexShrink:0},
  aiSectionSub:   {fontSize:11,color:"rgba(255,255,255,0.3)"},
  aiCard:         {background:"#13131e",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:18,position:"relative"},
  aiBadge:        {position:"absolute",top:14,right:16,fontSize:9,fontWeight:700,color:"#a855f7",background:"rgba(168,85,247,0.15)",borderRadius:4,padding:"2px 7px",letterSpacing:".05em"},
  aiT:            {fontSize:13,fontWeight:600,color:"#fff",marginBottom:2},
  aiS:            {fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:14},
  insightBox:     {display:"flex",gap:8,alignItems:"flex-start",background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:8,padding:"9px 12px",marginTop:10},
  insightI:       {width:16,height:16,borderRadius:"50%",background:"rgba(168,85,247,0.25)",color:"#a855f7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0,marginTop:1},
}