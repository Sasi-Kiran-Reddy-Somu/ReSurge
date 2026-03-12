import { useState, useEffect } from "react";

const C = { bg:"#0D0F16", surface:"#0F1117", border:"#1F2937", accent:"#3B82F6", green:"#22C55E", amber:"#F59E0B", red:"#EF4444", muted:"#6B7280", dim:"#374151", text:"#F9FAFB", sub:"#9CA3AF" };
const btn = (bg=C.accent,fg="#fff",ex={}) => ({background:bg,color:fg,border:"none",borderRadius:7,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13,...ex});
const inp = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box"};
const statusColor = s => s==="posted"?C.green:s==="done"?C.dim:s==="opened"?C.accent:C.amber;
function timeAgo(ts){const d=(Date.now()-new Date(ts).getTime())/1000;if(d<60)return`${Math.round(d)}s ago`;if(d<3600)return`${Math.round(d/60)}m ago`;if(d<86400)return`${Math.round(d/3600)}h ago`;return`${Math.round(d/86400)}d ago`;}
const BASE="/api";
function getToken(){return localStorage.getItem("token");}
async function req(method,path,body){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const res=await fetch(`${BASE}${path}`,{method,signal:ctrl.signal,headers:{"Content-Type":"application/json",...(getToken()?{Authorization:`Bearer ${getToken()}`}:{})},body:body?JSON.stringify(body):undefined});
    clearTimeout(tid);
    if(!res.ok){const e=await res.json().catch(()=>({error:res.statusText}));throw new Error(e.error??"HTTP "+res.status);}
    return res.json();
  }catch(e){clearTimeout(tid);if(e.name==="AbortError")throw new Error("Request timed out");throw e;}
}

const ROLE_LABELS={main:"Main Admin",monitor:"Monitor",holder:"Holder"};
const ROLE_PORTS={main:3000,monitor:3003,holder:3002};
const ROLE_COLORS={main:"#FF4500",monitor:"#3B82F6",holder:"#22C55E"};
const ROLE_DESC={main:"Admin dashboard & tracker",monitor:"Oversee holder activity",holder:"Post notifications & comments"};
const THIS_ROLE="monitor";

function AuthScreen({onAuth}){
  const [step,setStep]=useState("pick");
  const [action,setAction]=useState("");
  const [role,setRole]=useState("");
  const [form,setForm]=useState({email:"",password:"",name:"",phone:""});
  const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const [showPass,setShowPass]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  function pick(action,role){setAction(action);setRole(role);setStep("form");setErr("");}

  async function submit(e){
    e.preventDefault();setErr("");setBusy(true);
    try{
      let res;
      if(action==="signup"){
        res=await req("POST","/auth/signup",{...form,role});
      } else {
        res=await req("POST","/auth/login",{email:form.email,password:form.password,loginAs:role});
      }
      if(role===THIS_ROLE){
        localStorage.setItem("token",res.token);onAuth(res.user);
      } else {
        window.location.href=`http://localhost:${ROLE_PORTS[role]}?token=${encodeURIComponent(res.token)}&role=${role}`;
      }
    }catch(e){setErr(e.message);}finally{setBusy(false);}
  }

  if(step==="pick") return(
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:580}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{width:44,height:44,background:"#FF4500",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",margin:"0 auto 14px"}}>r/</div>
          <div style={{fontSize:26,fontWeight:800,color:C.text,fontFamily:"'IBM Plex Sans',sans-serif"}}>ReSurge</div>
          <div style={{color:C.muted,fontSize:13,marginTop:6}}>Choose how you want to continue</div>
        </div>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:10,color:C.dim,letterSpacing:"1px",marginBottom:12,textAlign:"center"}}>SIGN IN AS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {["main","monitor","holder"].map(r=>(
              <div key={r} onClick={()=>pick("signin",r)} style={{background:C.surface,border:`1px solid ${ROLE_COLORS[r]}30`,borderRadius:12,padding:"20px 16px",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${ROLE_COLORS[r]}`;e.currentTarget.style.background=`${ROLE_COLORS[r]}08`;}}
                onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${ROLE_COLORS[r]}30`;e.currentTarget.style.background=C.surface;}}>
                <div style={{width:36,height:36,borderRadius:9,background:`${ROLE_COLORS[r]}18`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:ROLE_COLORS[r]}}/>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{ROLE_LABELS[r]}</div>
                <div style={{fontSize:11,color:C.muted}}>{ROLE_DESC[r]}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:C.dim,letterSpacing:"1px",marginBottom:12,textAlign:"center"}}>SIGN UP AS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {["monitor","holder"].map(r=>(
              <div key={r} onClick={()=>pick("signup",r)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${ROLE_COLORS[r]}`;}}
                onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${C.border}`;}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:ROLE_COLORS[r],flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.sub}}>Create {ROLE_LABELS[r]} account</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{ROLE_DESC[r]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:420}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:ROLE_COLORS[role]}}/>
          <span style={{fontSize:14,fontWeight:700,color:ROLE_COLORS[role]}}>{action==="signin"?"Sign in as":"Create"} {ROLE_LABELS[role]} account</span>
        </div>
        <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:16}}>
          {action==="signup"&&(
            <>
              <div><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>Full Name</label><input style={inp} value={form.name} onChange={f("name")} required/></div>
              <div><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>Phone (optional)</label><input style={inp} value={form.phone} onChange={f("phone")}/></div>
            </>
          )}
          <div><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>Email Address</label><input style={inp} type="email" value={form.email} onChange={f("email")} required/></div>
          <div><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>Password</label><div style={{position:"relative"}}><input style={{...inp,paddingRight:38}} type={showPass?"text":"password"} value={form.password} onChange={f("password")} required/><button type="button" onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:15,lineHeight:1,padding:0}}>{showPass?"🙈":"👁"}</button></div></div>
          {err&&<div style={{color:C.red,fontSize:13}}>{err}</div>}
          <button type="submit" style={{...btn(ROLE_COLORS[role],"#fff"),padding:"13px",fontSize:14}} disabled={busy}>
            {busy?"Please wait...":`${action==="signin"?"Sign in":"Create account"} →`}
          </button>
        </form>
        <div onClick={()=>{setStep("pick");setErr("");}} style={{textAlign:"center",marginTop:16,fontSize:12,color:C.dim,cursor:"pointer"}}>← Back to options</div>
      </div>
    </div>
  );
}

function HolderDetail({holder,onBack}){
  const [detail,setDetail]=useState(null);
  const [loadErr,setLoadErr]=useState(null);
  const [accountId,setAccountId]=useState(null);
  const [timeFilter,setTimeFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [customFrom,setCustomFrom]=useState("");
  const [customTo,setCustomTo]=useState("");

  useEffect(()=>{
    setDetail(null); setLoadErr(null); setAccountId(null); setSearch(""); setTimeFilter("all"); setStatusFilter("all");
    req("GET",`/monitor/holders/${holder.id}`).then(d=>{
      setDetail(d);
      if(d.accounts&&d.accounts.length>0) setAccountId(d.accounts[0].id);
    }).catch(e=>setLoadErr(e.message||"Failed to load"));
  },[holder.id]);

  if(loadErr) return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,color:C.muted}}>
      <div style={{fontSize:32}}>⚠️</div>
      <div style={{fontSize:14,color:C.red}}>{loadErr}</div>
      <button onClick={()=>{setLoadErr(null);setDetail(null);req("GET",`/monitor/holders/${holder.id}`).then(d=>{setDetail(d);if(d.accounts?.length>0)setAccountId(d.accounts[0].id);}).catch(e=>setLoadErr(e.message||"Failed"));}} style={{...btn("#1F2937",C.sub),marginTop:4}}>Retry</button>
    </div>
  );

  if(!detail) return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:C.muted}}>
      <div style={{width:28,height:28,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{fontSize:13}}>Loading holder data…</span>
    </div>
  );

  const now=Date.now();
  function timeBounds(k){
    if(k==="today") return{from:now-86400000,to:now};
    if(k==="week")  return{from:now-7*86400000,to:now};
    if(k==="month") return{from:now-30*86400000,to:now};
    if(k==="custom"){const f=customFrom?new Date(customFrom).getTime():0;const t=customTo?new Date(customTo).getTime()+86399999:now;return{from:f,to:t};}
    return{from:0,to:Infinity};
  }
  const{from:tFrom,to:tTo}=timeBounds(timeFilter);

  const selAccount=detail.accounts.find(a=>a.id===accountId);
  const acctSubs=selAccount?.subreddits??[];

  // All notifs for selected account (or all if no account selected)
  const baseNotifs=accountId?detail.notifications.filter(n=>n.accountId===accountId):detail.notifications;
  // Time-filtered
  const timeNotifs=baseNotifs.filter(n=>{const ms=new Date(n.sentAt).getTime();return ms>=tFrom&&ms<=tTo;});
  // Status+search filtered for table
  let tableNotifs=[...timeNotifs].sort((a,b)=>new Date(b.sentAt)-new Date(a.sentAt));
  if(statusFilter==="viewed") tableNotifs=tableNotifs.filter(n=>n.status==="opened");
  else if(statusFilter!=="all") tableNotifs=tableNotifs.filter(n=>n.status===statusFilter);
  if(search){const q=search.toLowerCase();tableNotifs=tableNotifs.filter(n=>n.postTitle?.toLowerCase().includes(q)||n.subreddit?.toLowerCase().includes(q));}

  // Stats computed from time-filtered notifs
  const statsNotifs=timeNotifs;
  const statsPosted=statsNotifs.filter(n=>n.status==="posted").length;
  const statsViewed=statsNotifs.filter(n=>n.status==="opened"||n.status==="posted"||n.status==="done").length;
  const statsPending=statsNotifs.filter(n=>n.status==="sent").length;

  const pillStyle=(active)=>({padding:"8px 18px",borderRadius:24,border:`1px solid ${active?C.accent:C.border}`,background:active?"#1A2A40":"none",color:active?C.accent:C.sub,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:active?700:500,whiteSpace:"nowrap",transition:"all 0.15s"});

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:C.bg}}>

      {/* ── Header ── */}
      <div style={{padding:"20px 32px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:C.surface}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <button onClick={onBack} style={{background:"#1F2937",border:"none",borderRadius:8,padding:"8px 14px",color:C.sub,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>← Back</button>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:C.text,letterSpacing:"-0.01em"}}>{detail.name}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{detail.email}{detail.phone&&` · ${detail.phone}`}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:28,textAlign:"right"}}>
          {[{l:"Notifications",v:detail.notifications.length,c:C.text},{l:"Posted",v:detail.notifications.filter(n=>n.status==="posted").length,c:C.green},{l:"Accounts",v:detail.accounts.length,c:C.accent}].map(s=>(
            <div key={s.l}><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:C.dim,marginTop:2,letterSpacing:"0.05em"}}>{s.l.toUpperCase()}</div></div>
          ))}
        </div>
      </div>

      {/* ── Accounts row ── */}
      <div style={{padding:"16px 32px",borderBottom:`1px solid ${C.border}`,flexShrink:0,background:C.surface}}>
        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>ACCOUNTS</div>
        {detail.accounts.length===0
          ? <div style={{fontSize:13,color:C.dim}}>No accounts added by this holder.</div>
          : <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {detail.accounts.map(a=>{
                const label=a.redditUsername?`u/${a.redditUsername.replace(/^u\//,"")}`:(a.emailAddress||"Account");
                const acctNotifCount=detail.notifications.filter(n=>n.accountId===a.id).length;
                const acctPostedCount=detail.notifications.filter(n=>n.accountId===a.id&&n.status==="posted").length;
                const active=accountId===a.id;
                return(
                  <div key={a.id} onClick={()=>setAccountId(a.id)} style={pillStyle(active)}>
                    <span style={{fontWeight:active?700:500}}>{label}</span>
                    <span style={{marginLeft:8,opacity:0.65,fontSize:11}}>{acctNotifCount} notif{acctNotifCount!==1?"s":""} · {acctPostedCount} posted</span>
                  </div>
                );
              })}
            </div>
        }
      </div>

      {/* ── Scrollable content ── */}
      <div style={{flex:1,overflowY:"auto",padding:"24px 32px",display:"flex",flexDirection:"column",gap:24}}>

        {/* ── Stats cards ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
          {[
            {label:"Notifications",value:statsNotifs.length,color:C.text,icon:"📬"},
            {label:"Posted",value:statsPosted,color:C.green,icon:"✅"},
            {label:"Viewed",value:statsViewed,color:C.accent,icon:"👁"},
          ].map(s=>(
            <div key={s.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 20px"}}>
              <div style={{fontSize:11,color:C.dim,fontWeight:700,letterSpacing:"0.08em",marginBottom:10}}>{s.icon} {s.label.toUpperCase()}</div>
              <div style={{fontSize:28,fontWeight:800,color:s.color}}>{s.value}</div>
              {timeFilter!=="all"&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>{timeFilter==="today"?"today":timeFilter==="week"?"last 7d":timeFilter==="month"?"last 30d":"custom range"}</div>}
            </div>
          ))}
        </div>

        {/* ── Subreddits for selected account ── */}
        {accountId&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 22px"}}>
            <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:"0.1em",marginBottom:12}}>TRACKED SUBREDDITS · {acctSubs.length}</div>
            {acctSubs.length===0
              ? <div style={{fontSize:13,color:C.dim}}>No subreddits added for this account.</div>
              : <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {acctSubs.map(s=>(
                    <span key={s} style={{background:"#111827",border:`1px solid ${C.border}`,color:C.sub,padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500}}>r/{s}</span>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ── Notifications ── */}
        <div>
          {/* Filters bar */}
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <input style={{flex:"1 1 200px",minWidth:160,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 14px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}}
              placeholder="Search post title or subreddit…" value={search} onChange={e=>setSearch(e.target.value)}/>
            {/* Time filter */}
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[{k:"all",l:"All time"},{k:"today",l:"Today"},{k:"week",l:"7d"},{k:"month",l:"30d"},{k:"custom",l:"Custom"}].map(({k,l})=>(
                <button key={k} onClick={()=>setTimeFilter(k)} style={{background:timeFilter===k?"#1A2A40":"#111318",color:timeFilter===k?C.accent:C.muted,border:timeFilter===k?`1px solid ${C.accent}40`:`1px solid ${C.border}`,borderRadius:7,padding:"7px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:timeFilter===k?700:500}}>{l}</button>
              ))}
            </div>
            {timeFilter==="custom"&&(
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none",colorScheme:"dark"}}/>
                <span style={{fontSize:12,color:C.dim}}>–</span>
                <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none",colorScheme:"dark"}}/>
              </div>
            )}
          </div>
          {/* Status tabs */}
          <div style={{display:"flex",gap:2,marginBottom:14,borderBottom:`1px solid ${C.border}`,paddingBottom:0}}>
            {[{k:"all",l:"All",count:timeNotifs.length},{k:"sent",l:"Pending",count:timeNotifs.filter(n=>n.status==="sent").length},{k:"viewed",l:"Viewed",count:timeNotifs.filter(n=>n.status==="opened").length},{k:"posted",l:"Posted",count:timeNotifs.filter(n=>n.status==="posted").length},{k:"done",l:"Done",count:timeNotifs.filter(n=>n.status==="done").length}].map(({k,l,count})=>{
              const active=statusFilter===k;
              const tabColor=k==="posted"?C.green:k==="viewed"?C.accent:k==="sent"?C.amber:k==="done"?C.muted:C.text;
              return(
                <button key={k} onClick={()=>setStatusFilter(k)}
                  style={{background:"none",border:"none",borderBottom:active?`2px solid ${tabColor}`:"2px solid transparent",color:active?tabColor:C.dim,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:active?700:500,padding:"10px 16px",marginBottom:-1,display:"flex",alignItems:"center",gap:6}}>
                  {l}
                  <span style={{fontSize:11,background:active?tabColor+"22":C.surface,color:active?tabColor:C.dim,padding:"1px 7px",borderRadius:10}}>{count}</span>
                </button>
              );
            })}
          </div>
          {/* Table */}
          {tableNotifs.length===0
            ?<div style={{padding:"48px 0",textAlign:"center",color:C.dim,fontSize:14}}>No notifications match your filters.</div>
            :<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"150px 1fr 110px 80px",gap:16,padding:"11px 20px",borderBottom:`1px solid ${C.border}`}}>
                {["DATE","POST","STATUS","LINK"].map(h=><div key={h} style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:"0.08em"}}>{h}</div>)}
              </div>
              {tableNotifs.map(n=>{
                const sc=n.status==="posted"?C.green:n.status==="opened"?C.accent:n.status==="done"?C.muted:C.amber;
                const sl=n.status==="sent"?"pending":n.status==="opened"?"viewed":n.status;
                return(
                  <div key={n.id} style={{display:"grid",gridTemplateColumns:"150px 1fr 110px 80px",gap:16,padding:"14px 20px",borderBottom:`1px solid ${C.border}18`,alignItems:"center",transition:"background 0.1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#13161F"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div>
                      <div style={{fontSize:12,color:C.sub}}>{new Date(n.sentAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>
                      <div style={{fontSize:11,color:C.dim,marginTop:2}}>{new Date(n.sentAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:3}}>r/{n.subreddit}</div>
                      <div style={{fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{n.postTitle}</div>
                    </div>
                    <span style={{fontSize:11,color:sc,background:sc+"18",padding:"4px 12px",borderRadius:20,textAlign:"center",fontWeight:600,display:"inline-block"}}>{sl}</span>
                    <div>{n.postedLink?<a href={n.postedLink} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.green,fontWeight:600}}>↗ open</a>:<span style={{fontSize:11,color:C.dim}}>—</span>}</div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      </div>
    </div>
  );
}

function Dashboard({user,onLogout}){
  const [holders,setHolders]=useState([]);
  const [selected,setSelected]=useState(null);
  const [sideSearch,setSideSearch]=useState("");
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState({col:"name",dir:"asc"});

  useEffect(()=>{req("GET","/monitor/holders").then(setHolders).catch(()=>{});},[]);

  function toggleSort(col){setSort(s=>s.col===col?{col,dir:s.dir==="asc"?"desc":"asc"}:{col,dir:"asc"});}
  function sortIcon(col){if(sort.col!==col)return<span style={{opacity:0.2,fontSize:9}}> ⇅</span>;return<span style={{fontSize:9,color:C.accent}}> {sort.dir==="asc"?"↑":"↓"}</span>;}

  const sideFiltered=holders.filter(h=>h.name.toLowerCase().includes(sideSearch.toLowerCase())||h.email.toLowerCase().includes(sideSearch.toLowerCase()));

  const tableFiltered=[...holders]
    .filter(h=>h.name.toLowerCase().includes(search.toLowerCase())||h.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      const dir=sort.dir==="asc"?1:-1;
      if(sort.col==="name")return dir*a.name.localeCompare(b.name);
      if(sort.col==="email")return dir*a.email.localeCompare(b.email);
      if(sort.col==="subreddits")return dir*(a.subreddits.length-b.subreddits.length);
      if(sort.col==="notified")return dir*(a.totalNotifications-b.totalNotifications);
      if(sort.col==="posted")return dir*(a.converted-b.converted);
      return 0;
    });

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",overflow:"hidden"}}>
      {/* Sidebar */}
      <div style={{width:280,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"24px 20px 18px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:"0.1em",marginBottom:14}}>👁 MONITOR PORTAL</div>
          <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:3}}>{user.name}</div>
          <div style={{fontSize:12,color:C.muted}}>{user.email}</div>
        </div>
        {/* Sidebar search */}
        <div style={{padding:"10px 14px 4px",flexShrink:0}}>
          <input value={sideSearch} onChange={e=>setSideSearch(e.target.value)} placeholder="Search holders..."
            style={{background:"#111318",border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 12px",color:C.text,fontFamily:"inherit",fontSize:12,width:"100%",boxSizing:"border-box",outline:"none"}}/>
        </div>
        <div style={{padding:"8px 14px 10px",flex:1,overflowY:"auto"}}>
          <div style={{fontSize:10,color:C.dim,letterSpacing:"0.08em",marginBottom:8,paddingLeft:4}}>HOLDERS ({sideFiltered.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {sideFiltered.map(h=>(
              <div key={h.id} onClick={()=>setSelected(h)}
                style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",background:selected?.id===h.id?"#1E3A5F":"none",border:selected?.id===h.id?`1px solid ${C.accent}30`:"1px solid transparent",transition:"all 0.1s"}}
                onMouseEnter={e=>{if(selected?.id!==h.id)e.currentTarget.style.background="#111318";}}
                onMouseLeave={e=>{if(selected?.id!==h.id)e.currentTarget.style.background="none";}}>
                <div style={{fontSize:13,fontWeight:600,color:selected?.id===h.id?"#93C5FD":C.text,marginBottom:2}}>{h.name}</div>
                <div style={{fontSize:11,color:C.muted}}>{h.converted} posted · {h.totalNotifications} notified</div>
              </div>
            ))}
            {sideFiltered.length===0&&<div style={{fontSize:12,color:C.dim,padding:"8px 6px"}}>{holders.length===0?"No holders assigned.":"No results."}</div>}
          </div>
        </div>
        <div style={{padding:"16px 20px",borderTop:`1px solid ${C.border}`}}>
          <button onClick={onLogout} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>→ Logout</button>
        </div>
      </div>

      {/* Main */}
      {selected
        ? <HolderDetail key={selected?.id} holder={selected} onBack={()=>setSelected(null)}/>
        : <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            {/* Overview header: search left, count right */}
            <div style={{padding:"18px 32px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search holders by name or email..."
                style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 16px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}}/>
              <div style={{whiteSpace:"nowrap",fontSize:13,color:C.muted,fontWeight:600}}>
                {search?`${tableFiltered.length} of ${holders.length}`:holders.length} holder{holders.length!==1?"s":""}
              </div>
            </div>
            <div style={{flex:1,padding:"24px 32px",overflowY:"auto"}}>
              {/* Sortable holder table */}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"12px 24px",borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr",gap:16}}>
                  {[["name","Name"],["email","Email"],["subreddits","Subreddits"],["notified","Notified"],["posted","Posted"]].map(([col,label])=>(
                    <div key={col} onClick={()=>toggleSort(col)} style={{fontSize:11,color:sort.col===col?C.accent:C.dim,fontWeight:700,letterSpacing:"0.05em",cursor:"pointer",userSelect:"none"}}>
                      {label}{sortIcon(col)}
                    </div>
                  ))}
                </div>
                {tableFiltered.map(h=>(
                  <div key={h.id} onClick={()=>setSelected(h)} style={{padding:"14px 24px",borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr",gap:16,cursor:"pointer",transition:"background 0.1s",alignItems:"center"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#13161F"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{fontSize:14,fontWeight:600,color:C.text}}>{h.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>{h.email}</div>
                    <div style={{fontSize:13,color:C.sub}}>{h.subreddits.length}</div>
                    <div style={{fontSize:13,color:C.amber}}>{h.totalNotifications}</div>
                    <div style={{fontSize:14,fontWeight:700,color:C.green}}>{h.converted}</div>
                  </div>
                ))}
                {tableFiltered.length===0&&<div style={{padding:"40px 24px",textAlign:"center",color:C.dim,fontSize:13}}>{holders.length===0?"No holders assigned yet.":"No results match your search."}</div>}
              </div>
            </div>
          </div>
      }
    </div>
  );
}

export default function App(){
  const [user,setUser]=useState(null);const [checked,setChecked]=useState(false);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const urlToken=params.get("token");const urlRole=params.get("role");
    if(urlToken&&urlRole==="monitor"){localStorage.setItem("token",urlToken);window.history.replaceState({},"","/");}
    const t=localStorage.getItem("token");
    if(!t){setChecked(true);return;}
    try{const p=JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));if(p.exp*1000>Date.now()&&p.role==="monitor"){const stored=localStorage.getItem("user_data");if(stored){try{const u=JSON.parse(stored);if(u.role==="monitor"||u.roles?.includes("monitor")){setUser(u);setChecked(true);return;}}catch{}}req("POST","/auth/verify",{token:t}).then(d=>{if(d.user){localStorage.setItem("user_data",JSON.stringify(d.user));setUser(d.user);}else localStorage.removeItem("token");}).finally(()=>setChecked(true));}else{localStorage.removeItem("token");localStorage.removeItem("user_data");setChecked(true);}}catch{setChecked(true);}
  },[]);
  if(!checked)return<div style={{height:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:"'IBM Plex Sans',sans-serif"}}>Loading...</div>;
  function logout(){localStorage.removeItem("token");localStorage.removeItem("user_data");setUser(null);}
  if(!user)return<AuthScreen onAuth={setUser}/>;
  return<Dashboard user={user} onLogout={logout}/>;
}
