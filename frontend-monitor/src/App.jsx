// v2
import { useState, useEffect, useRef } from "react";

const C = { bg:"#0D0F16", surface:"#0F1117", border:"#1F2937", accent:"#3B82F6", green:"#22C55E", amber:"#F59E0B", red:"#EF4444", muted:"#6B7280", dim:"#374151", text:"#F9FAFB", sub:"#9CA3AF", orange:"#FF4500" };
const btn = (bg=C.accent,fg="#fff",ex={}) => ({background:bg,color:fg,border:"none",borderRadius:7,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13,...ex});
const inp = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box",outline:"none"};
function timeAgo(ts){const d=(Date.now()-new Date(ts).getTime())/1000;if(d<60)return`${Math.round(d)}s ago`;if(d<3600)return`${Math.round(d/60)}m ago`;if(d<86400)return`${Math.round(d/3600)}h ago`;return`${Math.round(d/86400)}d ago`;}
const BASE="/api";
function getToken(){return localStorage.getItem("token");}
async function req(method,path,body){
  const ctrl=new AbortController(); const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const res=await fetch(`${BASE}${path}`,{method,signal:ctrl.signal,headers:{"Content-Type":"application/json",...(getToken()?{Authorization:`Bearer ${getToken()}`}:{})},body:body?JSON.stringify(body):undefined});
    clearTimeout(tid);
    if(!res.ok){const e=await res.json().catch(()=>({error:res.statusText}));throw new Error(e.error??"HTTP "+res.status);}
    return res.json();
  }catch(e){clearTimeout(tid);if(e.name==="AbortError")throw new Error("Request timed out");throw e;}
}

// ── Google Auth Screen ────────────────────────────────────────────────────────
function AuthScreen({onAuth}){
  const btnRef=useRef(null);
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if(!clientId){setErr("Google Client ID not configured");return;}

    function initGoogle(){
      window.google.accounts.id.initialize({client_id:clientId,callback:handleCredential,auto_select:false,cancel_on_tap_outside:true});
      if(btnRef.current){
        window.google.accounts.id.renderButton(btnRef.current,{theme:"filled_black",size:"large",text:"continue_with",shape:"rectangular",width:280});
      }
    }

    if(window.google?.accounts?.id){initGoogle();}
    else{
      const existing=document.querySelector('script[src*="accounts.google.com/gsi"]');
      if(existing){existing.addEventListener("load",initGoogle);}
      else{const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=s.defer=true;s.onload=initGoogle;document.head.appendChild(s);}
    }
  },[]);

  async function handleCredential(response){
    setBusy(true);setErr("");
    try{
      const res=await fetch("/api/auth/google",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:response.credential})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error??"Sign-in failed");
      if(!data.user.roles?.includes("monitor")&&data.user.role!=="monitor")throw new Error("This account doesn't have monitor access. Contact the admin.");
      localStorage.setItem("token",data.token);
      localStorage.setItem("user_data",JSON.stringify(data.user));
      onAuth(data.user,data.isNewSignup??false);
    }catch(e){setErr(e.message);}finally{setBusy(false);}
  }

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:60,borderRight:`1px solid ${C.border}`}}>
        <div style={{width:72,height:72,background:C.orange,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:"#fff",marginBottom:32}}>r/</div>
        <div style={{fontSize:48,fontWeight:800,color:C.text,letterSpacing:"-0.03em",marginBottom:14}}>ReSurge</div>
        <div style={{fontSize:16,color:C.muted,maxWidth:340,textAlign:"center",lineHeight:1.7}}>Monitor holder activity, track conversions and manage your team.</div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:60}}>
        <div style={{width:320}}>
          <div style={{marginBottom:36}}>
            <div style={{fontSize:24,fontWeight:700,color:C.text,marginBottom:8}}>Monitor Portal</div>
            <div style={{fontSize:14,color:C.muted}}>Sign in with your Google account to continue.</div>
          </div>
          {busy&&<div style={{fontSize:13,color:C.muted,marginBottom:16}}>Signing in…</div>}
          <div ref={btnRef}/>
          {err&&<div style={{marginTop:20,fontSize:13,color:C.red,background:"#1C0505",border:"1px solid #7F1D1D",borderRadius:8,padding:"12px 16px"}}>{err}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Account Setup (first-login) ───────────────────────────────────────────────
function SubredditGrid({allSubs,sel,onToggle}){
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
      {allSubs.map(s=>(
        <div key={s.name} onClick={()=>onToggle(s.name)}
          style={{background:sel.has(s.name)?"#0D1626":C.surface,border:`1px solid ${sel.has(s.name)?C.accent:C.border}`,borderRadius:10,padding:"16px 18px",cursor:"pointer",transition:"all 0.15s"}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:4}}>r/</div>
          <div style={{fontSize:14,fontWeight:600,color:sel.has(s.name)?C.accent:C.text}}>{s.name}</div>
        </div>
      ))}
      {allSubs.length===0&&<div style={{color:C.dim,fontSize:13}}>No subreddits tracked yet.</div>}
    </div>
  );
}

function AccountSetup({onDone}){
  const [form,setForm]=useState({emailAddress:"",redditUsername:""});
  const [allSubs,setAllSubs]=useState([]);
  const [sel,setSel]=useState(new Set());
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  useEffect(()=>{req("GET","/holder/subreddits").then(setAllSubs).catch(()=>{});},[]);
  function toggle(name){setSel(p=>{const n=new Set(p);n.has(name)?n.delete(name):n.add(name);return n;});}
  async function save(){
    if(!form.emailAddress){setErr("Email address is required");return;}
    setBusy(true);setErr("");
    try{await req("POST","/holder/accounts",{...form,subreddits:[...sel]});onDone();}
    catch(e){setErr(e.message);}
    finally{setBusy(false);}
  }
  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",overflow:"hidden"}}>
      <div style={{width:320,background:C.surface,borderRight:`1px solid ${C.border}`,padding:40,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Set up your account</div>
        <div style={{color:C.muted,fontSize:13,lineHeight:1.7,marginBottom:28}}>Add the Reddit account you'll use to post comments.</div>
        <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:24}}>
          <div><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>Email Address *</label><input style={inp} value={form.emailAddress} onChange={e=>setForm(p=>({...p,emailAddress:e.target.value}))} placeholder="email@example.com"/></div>
          <div><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>Reddit Username (optional)</label><input style={inp} value={form.redditUsername} onChange={e=>setForm(p=>({...p,redditUsername:e.target.value}))} placeholder="u/username"/></div>
        </div>
        {err&&<div style={{color:C.red,fontSize:12,marginBottom:12}}>{err}</div>}
        <div style={{marginTop:"auto"}}>
          <div style={{fontSize:13,color:C.sub,marginBottom:10}}>{sel.size} subreddit{sel.size!==1?"s":""} selected</div>
          <button onClick={save} disabled={busy||!form.emailAddress} style={{...btn(C.accent,"#fff"),width:"100%",padding:"13px"}}>{busy?"Saving...":"Save & Continue →"}</button>
          <button onClick={onDone} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontFamily:"inherit",fontSize:12,marginTop:10,padding:0}}>Skip for now →</button>
        </div>
      </div>
      <div style={{flex:1,padding:40,overflowY:"auto"}}>
        <div style={{fontSize:14,fontWeight:700,color:C.sub,marginBottom:20}}>Pick subreddits for this account</div>
        <SubredditGrid allSubs={allSubs} sel={sel} onToggle={toggle}/>
      </div>
    </div>
  );
}

// ── Add Account Modal ─────────────────────────────────────────────────────────
function AddAccountModal({onClose,onAdded}){
  const [form,setForm]=useState({emailAddress:"",redditUsername:""});
  const [allSubs,setAllSubs]=useState([]);
  const [sel,setSel]=useState(new Set());
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  useEffect(()=>{req("GET","/holder/subreddits").then(setAllSubs).catch(()=>{});},[]);
  function toggle(name){setSel(p=>{const n=new Set(p);n.has(name)?n.delete(name):n.add(name);return n;});}
  async function save(){
    if(!form.emailAddress){setErr("Email address is required");return;}
    setBusy(true);setErr("");
    try{await req("POST","/holder/accounts",{...form,subreddits:[...sel]});onAdded();}
    catch(e){setErr(e.message);}finally{setBusy(false);}
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:16,width:"min(780px,96vw)",maxHeight:"88vh",display:"flex",overflow:"hidden"}}>
        <div style={{width:280,background:C.surface,padding:32,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:6}}>Add Account</div>
          <div style={{color:C.muted,fontSize:12,lineHeight:1.7,marginBottom:22}}>Add a new Reddit account and pick its subreddits.</div>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
            <div><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5}}>Email Address *</label><input style={inp} value={form.emailAddress} onChange={e=>setForm(p=>({...p,emailAddress:e.target.value}))} placeholder="email@example.com"/></div>
            <div><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5}}>Reddit Username (optional)</label><input style={inp} value={form.redditUsername} onChange={e=>setForm(p=>({...p,redditUsername:e.target.value}))} placeholder="u/username"/></div>
          </div>
          {err&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{err}</div>}
          <div style={{marginTop:"auto"}}>
            <div style={{fontSize:12,color:C.sub,marginBottom:8}}>{sel.size} subreddit{sel.size!==1?"s":""} selected</div>
            <button onClick={save} disabled={busy||!form.emailAddress} style={{...btn(C.accent,"#fff"),width:"100%",padding:"11px",marginBottom:8}}>{busy?"Saving...":"Add Account →"}</button>
            <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:0}}>Cancel</button>
          </div>
        </div>
        <div style={{flex:1,padding:28,overflowY:"auto"}}>
          <div style={{fontSize:12,fontWeight:700,color:C.sub,marginBottom:16}}>PICK SUBREDDITS</div>
          <SubredditGrid allSubs={allSubs} sel={sel} onToggle={toggle}/>
        </div>
      </div>
    </div>
  );
}

// ── Holder Detail View (monitor sees a holder's data) ─────────────────────────
function HolderDetail({holder,onBack}){
  const [detail,setDetail]=useState(null); const [loadErr,setLoadErr]=useState(null);
  const [accountId,setAccountId]=useState(null); const [timeFilter,setTimeFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all"); const [search,setSearch]=useState("");
  const [customFrom,setCustomFrom]=useState(""); const [customTo,setCustomTo]=useState("");

  useEffect(()=>{
    setDetail(null);setLoadErr(null);setAccountId(null);setSearch("");setTimeFilter("all");setStatusFilter("all");
    req("GET",`/monitor/holders/${holder.id}`).then(d=>{setDetail(d);if(d.accounts&&d.accounts.length>0)setAccountId(d.accounts[0].id);}).catch(e=>setLoadErr(e.message||"Failed to load"));
  },[holder.id]);

  if(loadErr)return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,color:C.muted}}>
      <div style={{fontSize:32}}>⚠️</div>
      <div style={{fontSize:14,color:C.red}}>{loadErr}</div>
      <button onClick={()=>{setLoadErr(null);setDetail(null);req("GET",`/monitor/holders/${holder.id}`).then(d=>{setDetail(d);if(d.accounts?.length>0)setAccountId(d.accounts[0].id);}).catch(e=>setLoadErr(e.message||"Failed"));}} style={{...btn("#1F2937",C.sub),marginTop:4}}>Retry</button>
    </div>
  );

  if(!detail)return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:C.muted}}>
      <div style={{width:28,height:28,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{fontSize:13}}>Loading holder data…</span>
    </div>
  );

  const now=Date.now();
  function timeBounds(k){
    if(k==="today")return{from:now-86400000,to:now};
    if(k==="week")return{from:now-7*86400000,to:now};
    if(k==="month")return{from:now-30*86400000,to:now};
    if(k==="custom"){const f=customFrom?new Date(customFrom).getTime():0;const t=customTo?new Date(customTo).getTime()+86399999:now;return{from:f,to:t};}
    return{from:0,to:Infinity};
  }
  const{from:tFrom,to:tTo}=timeBounds(timeFilter);
  const selAccount=detail.accounts.find(a=>a.id===accountId);
  const acctSubs=selAccount?.subreddits??[];
  const baseNotifs=accountId?detail.notifications.filter(n=>n.accountId===accountId):detail.notifications;
  const timeNotifs=baseNotifs.filter(n=>{const ms=new Date(n.sentAt).getTime();return ms>=tFrom&&ms<=tTo;});
  let tableNotifs=[...timeNotifs].sort((a,b)=>new Date(b.sentAt)-new Date(a.sentAt));
  if(statusFilter==="viewed")tableNotifs=tableNotifs.filter(n=>n.status==="opened");
  else if(statusFilter!=="all")tableNotifs=tableNotifs.filter(n=>n.status===statusFilter);
  if(search){const q=search.toLowerCase();tableNotifs=tableNotifs.filter(n=>n.postTitle?.toLowerCase().includes(q)||n.subreddit?.toLowerCase().includes(q));}

  const statsNotifs=timeNotifs;
  const statsPosted=statsNotifs.filter(n=>n.status==="posted").length;
  const statsViewed=statsNotifs.filter(n=>n.status==="opened"||n.status==="posted"||n.status==="done").length;

  const pillStyle=(active)=>({padding:"8px 18px",borderRadius:24,border:`1px solid ${active?C.accent:C.border}`,background:active?"#1A2A40":"none",color:active?C.accent:C.sub,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:active?700:500,whiteSpace:"nowrap",transition:"all 0.15s"});

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:C.bg}}>
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
      <div style={{padding:"16px 32px",borderBottom:`1px solid ${C.border}`,flexShrink:0,background:C.surface}}>
        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>ACCOUNTS</div>
        {detail.accounts.length===0
          ?<div style={{fontSize:13,color:C.dim}}>No accounts added by this holder.</div>
          :<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {detail.accounts.map(a=>{
              const label=a.redditUsername?`u/${a.redditUsername.replace(/^u\//,"")}`:(a.emailAddress||"Account");
              const acctNotifCount=detail.notifications.filter(n=>n.accountId===a.id).length;
              const acctPostedCount=detail.notifications.filter(n=>n.accountId===a.id&&n.status==="posted").length;
              const active=accountId===a.id;
              return(<div key={a.id} onClick={()=>setAccountId(a.id)} style={pillStyle(active)}><span style={{fontWeight:active?700:500}}>{label}</span><span style={{marginLeft:8,opacity:0.65,fontSize:11}}>{acctNotifCount} notif{acctNotifCount!==1?"s":""} · {acctPostedCount} posted</span></div>);
            })}
          </div>
        }
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"24px 32px",display:"flex",flexDirection:"column",gap:24}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {[{label:"Notifications",value:statsNotifs.length,color:C.text,icon:"📬"},{label:"Posted",value:statsPosted,color:C.green,icon:"✅"},{label:"Viewed",value:statsViewed,color:C.accent,icon:"👁"}].map(s=>(
            <div key={s.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 20px"}}>
              <div style={{fontSize:11,color:C.dim,fontWeight:700,letterSpacing:"0.08em",marginBottom:10}}>{s.icon} {s.label.toUpperCase()}</div>
              <div style={{fontSize:28,fontWeight:800,color:s.color}}>{s.value}</div>
              {timeFilter!=="all"&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>{timeFilter==="today"?"today":timeFilter==="week"?"last 7d":timeFilter==="month"?"last 30d":"custom range"}</div>}
            </div>
          ))}
        </div>
        {accountId&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 22px"}}>
            <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:"0.1em",marginBottom:12}}>TRACKED SUBREDDITS · {acctSubs.length}</div>
            {acctSubs.length===0?<div style={{fontSize:13,color:C.dim}}>No subreddits added for this account.</div>:<div style={{display:"flex",flexWrap:"wrap",gap:8}}>{acctSubs.map(s=><span key={s} style={{background:"#111827",border:`1px solid ${C.border}`,color:C.sub,padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500}}>r/{s}</span>)}</div>}
          </div>
        )}
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <input style={{flex:"1 1 200px",minWidth:160,...inp}} placeholder="Search post title or subreddit…" value={search} onChange={e=>setSearch(e.target.value)}/>
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
          <div style={{display:"flex",gap:2,marginBottom:14,borderBottom:`1px solid ${C.border}`,paddingBottom:0}}>
            {[{k:"all",l:"All",count:timeNotifs.length},{k:"sent",l:"Pending",count:timeNotifs.filter(n=>n.status==="sent").length},{k:"viewed",l:"Viewed",count:timeNotifs.filter(n=>n.status==="opened").length},{k:"posted",l:"Posted",count:timeNotifs.filter(n=>n.status==="posted").length},{k:"done",l:"Done",count:timeNotifs.filter(n=>n.status==="done").length}].map(({k,l,count})=>{
              const active=statusFilter===k;
              const tabColor=k==="posted"?C.green:k==="viewed"?C.accent:k==="sent"?C.amber:k==="done"?C.muted:C.text;
              return(<button key={k} onClick={()=>setStatusFilter(k)} style={{background:"none",border:"none",borderBottom:active?`2px solid ${tabColor}`:"2px solid transparent",color:active?tabColor:C.dim,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:active?700:500,padding:"10px 16px",marginBottom:-1,display:"flex",alignItems:"center",gap:6}}>{l}<span style={{fontSize:11,background:active?tabColor+"22":C.surface,color:active?tabColor:C.dim,padding:"1px 7px",borderRadius:10}}>{count}</span></button>);
            })}
          </div>
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
                    <div><div style={{fontSize:12,color:C.sub}}>{new Date(n.sentAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{new Date(n.sentAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div></div>
                    <div style={{minWidth:0}}><div style={{fontSize:11,color:C.muted,marginBottom:3}}>r/{n.subreddit}</div><div style={{fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{n.postTitle}</div></div>
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

// ── Holders Overview Table ─────────────────────────────────────────────────────
function HoldersOverview({holders,onSelect}){
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState({col:"name",dir:"asc"});
  function toggleSort(col){setSort(s=>s.col===col?{col,dir:s.dir==="asc"?"desc":"asc"}:{col,dir:"asc"});}
  function sortIcon(col){if(sort.col!==col)return<span style={{opacity:0.2,fontSize:9}}> ⇅</span>;return<span style={{fontSize:9,color:C.accent}}> {sort.dir==="asc"?"↑":"↓"}</span>;}
  const filtered=[...holders].filter(h=>h.name.toLowerCase().includes(search.toLowerCase())||h.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{const dir=sort.dir==="asc"?1:-1;if(sort.col==="name")return dir*a.name.localeCompare(b.name);if(sort.col==="email")return dir*a.email.localeCompare(b.email);if(sort.col==="subreddits")return dir*(a.subreddits.length-b.subreddits.length);if(sort.col==="notified")return dir*(a.totalNotifications-b.totalNotifications);if(sort.col==="posted")return dir*(a.converted-b.converted);return 0;});
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"18px 32px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search holders by name or email..."
          style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 16px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}}/>
        <div style={{whiteSpace:"nowrap",fontSize:13,color:C.muted,fontWeight:600}}>{search?`${filtered.length} of ${holders.length}`:holders.length} holder{holders.length!==1?"s":""}</div>
      </div>
      <div style={{flex:1,padding:"24px 32px",overflowY:"auto"}}>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 24px",borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr",gap:16}}>
            {[["name","Name"],["email","Email"],["subreddits","Subreddits"],["notified","Notified"],["posted","Posted"]].map(([col,label])=>(
              <div key={col} onClick={()=>toggleSort(col)} style={{fontSize:11,color:sort.col===col?C.accent:C.dim,fontWeight:700,letterSpacing:"0.05em",cursor:"pointer",userSelect:"none"}}>{label}{sortIcon(col)}</div>
            ))}
          </div>
          {filtered.map(h=>(
            <div key={h.id} onClick={()=>onSelect(h)} style={{padding:"14px 24px",borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr",gap:16,cursor:"pointer",transition:"background 0.1s",alignItems:"center"}}
              onMouseEnter={e=>e.currentTarget.style.background="#13161F"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{fontSize:14,fontWeight:600,color:C.text}}>{h.name}</div>
              <div style={{fontSize:12,color:C.muted}}>{h.email}</div>
              <div style={{fontSize:13,color:C.sub}}>{h.subreddits.length}</div>
              <div style={{fontSize:13,color:C.amber}}>{h.totalNotifications}</div>
              <div style={{fontSize:14,fontWeight:700,color:C.green}}>{h.converted}</div>
            </div>
          ))}
          {filtered.length===0&&<div style={{padding:"40px 24px",textAlign:"center",color:C.dim,fontSize:13}}>{holders.length===0?"No holders assigned yet.":"No results match your search."}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Post Popup (monitor's own notifications) ──────────────────────────────────
function PostPopup({notif,onClose,onAction}){
  const [comment,setComment]=useState(null); const [loading,setLoading]=useState(false); const [copied,setCopied]=useState(false);
  const [showPaste,setShowPaste]=useState(false); const [link,setLink]=useState(""); const [err,setErr]=useState("");
  async function generate(){setLoading(true);setErr("");try{const c=(await req("POST",`/posts/${notif.postId}/generate-comment`)).comment;setComment(c);}catch(e){setErr(e.message);}finally{setLoading(false);}};
  async function copy(){await navigator.clipboard.writeText(comment);setCopied(true);setTimeout(()=>setCopied(false),2000);}
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:32}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`4px solid ${C.accent}`,borderRadius:16,padding:36,maxWidth:660,width:"100%",maxHeight:"86vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
          <div style={{flex:1,paddingRight:20}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:"0.06em",marginBottom:8}}>🔥 VIRAL · r/{notif.subreddit}</div>
            <a href={notif.postUrl} target="_blank" rel="noreferrer" style={{color:C.text,fontSize:17,lineHeight:1.55,textDecoration:"none",fontWeight:600}}>{notif.postTitle}</a>
          </div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontSize:18,borderRadius:8,width:36,height:36,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {!comment&&<button onClick={generate} disabled={loading} style={{...btn(loading?"#1E3A5F":C.accent,"#fff"),width:"100%",padding:"14px",marginBottom:16,fontSize:14}}>{loading?"Generating...":"✨ Generate Comment"}</button>}
        {err&&<div style={{color:C.red,fontSize:13,marginBottom:12}}>{err}</div>}
        {comment&&<div style={{background:"#080B12",border:`1px solid #1E3A5F`,borderRadius:12,padding:22,marginBottom:20}}><p style={{margin:"0 0 16px",fontSize:14,color:"#D1D5DB",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{comment}</p><div style={{display:"flex",gap:10}}><button onClick={()=>{setComment(null);generate();}} style={btn("#1F2937",C.sub)}>↺ Regenerate</button><button onClick={copy} style={btn(copied?"#064E3B":"#1F2937",copied?C.green:C.sub)}>{copied?"✓ Copied!":"Copy Text"}</button></div></div>}
        {comment&&!showPaste&&<div style={{background:"#0A1A10",border:`1px solid #065F46`,borderRadius:8,padding:"11px 14px",marginBottom:12,fontSize:12,color:"#6EE7B7",lineHeight:1.6}}>
          <strong style={{color:C.green}}>Next steps:</strong> Copy the comment above → Open the post → Paste &amp; submit on Reddit → Come back and click <strong style={{color:C.green}}>"✓ I Posted — Save Link"</strong> below to log your comment link.
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:showPaste?16:0}}>
          <button onClick={()=>window.open(notif.postUrl,"_blank")} style={btn("#1A1D2E",C.sub,{border:`1px solid ${C.border}`})}>Open Post ↗</button>
          <button onClick={async()=>{await req("PUT",`/holder/notifications/${notif.id}/done`);onAction();}} style={btn("#1F2937",C.muted)}>Done</button>
          <button onClick={()=>setShowPaste(true)} style={btn("#064E3B",C.green)}>✓ I Posted — Save Link</button>
        </div>
        {showPaste&&<div style={{background:"#060D0A",border:`1px solid #065F46`,borderRadius:10,padding:20,marginTop:12}}><label style={{fontSize:12,color:C.green,display:"block",marginBottom:6,fontWeight:700}}>Paste your Reddit comment link to save it:</label><div style={{fontSize:11,color:C.muted,marginBottom:10}}>Go to your comment on Reddit → click "Share" → copy the link → paste it here.</div><input style={{...inp,marginBottom:12}} placeholder="https://reddit.com/r/.../comments/.../comment/..." value={link} onChange={e=>setLink(e.target.value)}/><button onClick={async()=>{if(!link.trim())return;await req("PUT",`/holder/notifications/${notif.id}/posted`,{postedLink:link.trim()});onAction();}} style={{...btn(C.green,"#fff"),width:"100%"}}>Save &amp; Mark as Posted</button></div>}
      </div>
    </div>
  );
}

// ── My Notifications Panel (monitor's own) ────────────────────────────────────
function MyNotifications({accounts,openAccId,onSetAccId}){
  const [notifs,setNotifs]=useState([]); const [tab,setTab]=useState("all");
  const [search,setSearch]=useState(""); const [popup,setPopup]=useState(null);
  useEffect(()=>{req("GET","/holder/notifications").then(setNotifs).catch(()=>{});},[]);
  const scoped=openAccId?notifs.filter(n=>n.accountId===openAccId):notifs;
  const tabFiltered=scoped.filter(n=>tab==="all"||(tab==="viewed"?n.status==="opened":n.status===tab));
  const filtered=tabFiltered.filter(n=>!search||n.postTitle?.toLowerCase().includes(search.toLowerCase())||n.subreddit?.toLowerCase().includes(search.toLowerCase()));
  const counts={all:scoped.length,viewed:scoped.filter(n=>n.status==="opened").length,posted:scoped.filter(n=>n.status==="posted").length};
  const statusColor=s=>s==="posted"?C.green:s==="done"?C.dim:s==="opened"?C.accent:C.amber;
  const displayStatus=s=>s==="sent"?"new":s;
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {popup&&<PostPopup notif={popup} onClose={()=>setPopup(null)} onAction={()=>{setPopup(null);req("GET","/holder/notifications").then(setNotifs).catch(()=>{});}}/>}
      <div style={{padding:"22px 32px 14px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:C.text}}>
              {openAccId?(accounts.find(a=>a.id===openAccId)?.redditUsername?`u/${accounts.find(a=>a.id===openAccId).redditUsername.replace(/^u\//,"")}`:accounts.find(a=>a.id===openAccId)?.emailAddress??"Account"):"All Notifications"}
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:3}}>Click any post to open and take action.</div>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            {["all","viewed","posted"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:tab===t?"#0D1626":"#161B26",color:tab===t?C.accent:C.sub,border:tab===t?`1px solid ${C.accent}40`:`1px solid ${C.border}`,borderRadius:7,padding:"8px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:tab===t?700:500}}>{t} ({counts[t]??0})</button>)}
          </div>
        </div>
        <input style={{...inp,padding:"8px 12px",fontSize:12}} placeholder="Search by post title or subreddit…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
        {filtered.length===0
          ?<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60%",gap:14}}><div style={{fontSize:44}}>📭</div><div style={{fontSize:16,color:C.muted}}>No notifications yet</div></div>
          :<div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filtered.map(n=>(
              <div key={n.id} onClick={()=>req("GET",`/holder/notifications/${n.id}`).then(setPopup).catch(()=>{})}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${statusColor(n.status)}`,borderRadius:10,padding:"18px 22px",cursor:"pointer",transition:"background 0.1s",display:"flex",alignItems:"center",gap:20}}
                onMouseEnter={e=>e.currentTarget.style.background="#13161F"}
                onMouseLeave={e=>e.currentTarget.style.background=C.surface}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:5}}>r/{n.subreddit}</div>
                  <div style={{fontSize:14,color:C.text,fontWeight:500,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.postTitle}</div>
                  {n.postedLink&&<a href={n.postedLink} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:C.green,marginTop:5,display:"block"}}>✓ Comment posted</a>}
                </div>
                <div style={{flexShrink:0,textAlign:"right"}}>
                  <span style={{display:"inline-block",fontSize:11,color:statusColor(n.status),background:statusColor(n.status)+"18",border:`1px solid ${statusColor(n.status)}30`,padding:"4px 12px",borderRadius:20,marginBottom:5}}>{displayStatus(n.status)}</span>
                  <div style={{fontSize:11,color:C.dim}}>{timeAgo(n.sentAt)}</div>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
}

// ── Manage Subreddits Panel ────────────────────────────────────────────────────
function ManageSubredditsPanel({account,onUpdated}){
  const [allSubs,setAllSubs]=useState([]);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{req("GET","/holder/subreddits").then(setAllSubs).catch(()=>{});},[]);
  if(!account)return null;
  const active=account.subreddits??[];
  const paused=account.pausedSubreddits??[];
  const assignedSet=new Set([...active,...paused]);
  const available=allSubs.filter(s=>!assignedSet.has(s.name));

  async function update(newActive,newPaused){
    setBusy(true);
    try{await req("PUT",`/holder/accounts/${account.id}`,{subreddits:newActive,pausedSubreddits:newPaused});onUpdated();}
    catch(e){alert(e.message);}finally{setBusy(false);}
  }

  const rowStyle={background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:12};
  return(
    <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
      <div style={{marginBottom:32}}>
        <div style={{fontSize:11,color:C.dim,fontWeight:700,letterSpacing:"0.08em",marginBottom:14}}>ACTIVE ({active.length})</div>
        {active.length===0
          ?<div style={{fontSize:13,color:C.dim,padding:"14px 0"}}>No active subreddits. Add one below.</div>
          :<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {active.map(name=>(
              <div key={name} style={{...rowStyle,borderLeft:`3px solid ${C.green}`}}>
                <span style={{fontSize:14,color:C.text,flex:1,fontWeight:500}}>r/{name}</span>
                <button onClick={()=>update(active.filter(s=>s!==name),[...paused,name])} disabled={busy}
                  style={{background:"none",border:`1px solid ${C.amber}50`,color:C.amber,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:"5px 12px",borderRadius:5,fontWeight:600,opacity:busy?0.5:1}}>
                  Hold
                </button>
                <button onClick={()=>update(active.filter(s=>s!==name),paused.filter(s=>s!==name))} disabled={busy}
                  style={{background:"none",border:"1px solid #7F1D1D",color:C.red,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:"5px 12px",borderRadius:5,fontWeight:600,opacity:busy?0.5:1}}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        }
      </div>

      {paused.length>0&&(
        <div style={{marginBottom:32}}>
          <div style={{fontSize:11,color:C.dim,fontWeight:700,letterSpacing:"0.08em",marginBottom:14}}>ON HOLD ({paused.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {paused.map(name=>(
              <div key={name} style={{...rowStyle,borderLeft:`3px solid ${C.amber}`,opacity:0.8}}>
                <span style={{fontSize:14,color:C.sub,flex:1,fontWeight:500}}>r/{name}</span>
                <span style={{fontSize:10,color:C.amber,background:C.amber+"18",padding:"2px 9px",borderRadius:10,fontWeight:700,flexShrink:0}}>ON HOLD</span>
                <button onClick={()=>update([...active,name],paused.filter(s=>s!==name))} disabled={busy}
                  style={{background:"none",border:`1px solid ${C.green}50`,color:C.green,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:"5px 12px",borderRadius:5,fontWeight:600,opacity:busy?0.5:1}}>
                  Resume
                </button>
                <button onClick={()=>update(active,paused.filter(s=>s!==name))} disabled={busy}
                  style={{background:"none",border:"1px solid #7F1D1D",color:C.red,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:"5px 12px",borderRadius:5,fontWeight:600,opacity:busy?0.5:1}}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {available.length>0&&(
        <div>
          <div style={{fontSize:11,color:C.dim,fontWeight:700,letterSpacing:"0.08em",marginBottom:14}}>ADD SUBREDDIT</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {available.map(s=>(
              <button key={s.name} onClick={()=>update([...active,s.name],paused)} disabled={busy}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 16px",color:C.sub,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:6,opacity:busy?0.5:1}}
                onMouseEnter={e=>!busy&&(e.currentTarget.style.borderColor=C.accent)}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <span style={{color:C.dim,fontSize:11}}>r/</span><span>{s.name}</span><span style={{color:C.accent,fontSize:14}}>+</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
function pauseTimeLeft(until){
  const ms=until-Date.now();if(ms<=0)return null;
  const h=Math.floor(ms/3600000);const m=Math.floor((ms%3600000)/60000);
  return h>0?`${h}h ${m}m`:`${m}m`;
}

function PauseModal({isPaused,pausedUntil,onClose,onPause,onResume}){
  const [hours,setHours]=useState(1);const [editing,setEditing]=useState(false);const [inputVal,setInputVal]=useState("1");const [busy,setBusy]=useState(false);
  const timeLeft=isPaused&&pausedUntil?pauseTimeLeft(pausedUntil):null;
  function clamp(v){return Math.min(16,Math.max(1,Math.round(v)));}
  function dec(){setHours(h=>clamp(h-1));}
  function inc(){setHours(h=>clamp(h+1));}
  function startEdit(){setInputVal(String(hours));setEditing(true);}
  function commitEdit(){const v=parseInt(inputVal,10);if(!isNaN(v))setHours(clamp(v));setEditing(false);}
  async function handlePause(){setBusy(true);try{await onPause(hours);onClose();}catch(e){alert(e.message);}finally{setBusy(false);}}
  async function handleResume(){setBusy(true);try{await onResume();onClose();}catch(e){alert(e.message);}finally{setBusy(false);}}
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500}}>
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,width:"min(380px,96vw)",padding:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:800,color:C.text}}>Pause Notifications</div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontSize:18,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {isPaused&&timeLeft?(
          <>
            <div style={{background:"#0A1A10",border:`1px solid #065F46`,borderRadius:10,padding:"16px 18px",marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:11,color:C.green,fontWeight:700,letterSpacing:"0.08em",marginBottom:6}}>CURRENTLY PAUSED</div>
              <div style={{fontSize:28,fontWeight:800,color:C.text,marginBottom:4}}>{timeLeft}</div>
              <div style={{fontSize:12,color:C.muted}}>remaining</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={handleResume} disabled={busy} style={{...btn(C.green,"#000"),flex:1,padding:"11px"}}>{busy?"Resuming...":"Resume Now"}</button>
              <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"11px 16px",borderRadius:7}}>Close</button>
            </div>
          </>
        ):(
          <>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Pause email notifications for how long?</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:24}}>
              <button onClick={dec} style={{width:40,height:40,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.text,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",lineHeight:1}}>−</button>
              {editing?(
                <input autoFocus value={inputVal} onChange={e=>setInputVal(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditing(false);}} style={{width:80,textAlign:"center",background:C.surface,border:`1px solid ${C.accent}`,borderRadius:8,padding:"8px 0",color:C.text,fontSize:22,fontWeight:700,fontFamily:"inherit",outline:"none"}}/>
              ):(
                <div onDoubleClick={startEdit} title="Double-click to type a value" style={{width:80,textAlign:"center",fontSize:22,fontWeight:800,color:C.text,cursor:"default",userSelect:"none",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 0"}}>
                  {hours}<span style={{fontSize:13,fontWeight:500,color:C.muted,marginLeft:4}}>hr</span>
                </div>
              )}
              <button onClick={inc} style={{width:40,height:40,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.text,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",lineHeight:1}}>+</button>
            </div>
            <div style={{fontSize:11,color:C.muted,textAlign:"center",marginBottom:20}}>Max 16 hours · Double-click the number to type a custom value</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={handlePause} disabled={busy} style={{...btn(C.accent),flex:1,padding:"11px"}}>{busy?"Pausing...":"Done"}</button>
              <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"11px 16px",borderRadius:7}}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard({user,onLogout}){
  const [section,setSection]=useState("accounts"); // "accounts" | "holders"
  const [mainTab,setMainTab]=useState("notifications"); // "notifications" | "subreddits"
  const [openAccId,setOpenAccId]=useState(null);
  const [accounts,setAccounts]=useState([]);
  const [showAddAcc,setShowAddAcc]=useState(false);
  const [delAccBusy,setDelAccBusy]=useState(null);
  const [holders,setHolders]=useState([]);
  const [selectedHolder,setSelectedHolder]=useState(null);
  const [showManageAcc,setShowManageAcc]=useState(false);
  const [pausedUntil,setPausedUntil]=useState(null);
  const [showPauseModal,setShowPauseModal]=useState(false);

  const [,setTick]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setTick(t=>t+1),30000);return()=>clearInterval(id);},[]);
  const isPaused=pausedUntil&&pausedUntil>Date.now();
  async function pauseNotifications(hours){const d=await req("PUT","/holder/pause-notifications",{hours});setPausedUntil(d.pausedUntil);}
  async function resumeNotifications(){await req("PUT","/holder/pause-notifications",{hours:null});setPausedUntil(null);}

  useEffect(()=>{loadAccounts();req("GET","/monitor/holders").then(setHolders).catch(()=>{});req("GET","/holder/pause-status").then(d=>setPausedUntil(d.pausedUntil??null)).catch(()=>{});},[]);

  function loadAccounts(){
    req("GET","/holder/accounts").then(accs=>{setAccounts(accs);if(accs.length>0)setOpenAccId(id=>id||accs[0].id);}).catch(()=>{});
  }
  async function deleteAccount(id){
    setDelAccBusy(id);
    try{await req("DELETE",`/holder/accounts/${id}`);loadAccounts();if(openAccId===id)setOpenAccId(null);}
    catch(e){alert(e.message);}finally{setDelAccBusy(null);}
  }

  function ManageAccountsModal({onClose}){
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:24}}>
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,width:"min(480px,96vw)",maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{fontSize:15,fontWeight:800,color:C.text}}>Manage Accounts</div>
            <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontSize:18,borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"12px 24px"}}>
            {accounts.length===0
              ?<div style={{color:C.dim,fontSize:13,padding:"20px 0",textAlign:"center"}}>No accounts yet.</div>
              :accounts.map(acc=>(
                <div key={acc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}20`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {acc.redditUsername?`u/${acc.redditUsername.replace(/^u\//,"")}`:acc.emailAddress}
                    </div>
                    {acc.redditUsername&&<div style={{fontSize:11,color:C.muted,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.emailAddress}</div>}
                  </div>
                  <button onClick={()=>deleteAccount(acc.id)} disabled={delAccBusy===acc.id}
                    style={{background:"none",border:"1px solid #7F1D1D",color:C.red,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:"5px 12px",borderRadius:6,fontWeight:600,flexShrink:0,opacity:delAccBusy===acc.id?0.5:1}}>
                    {delAccBusy===acc.id?"Removing…":"Remove"}
                  </button>
                </div>
              ))
            }
          </div>
          <div style={{padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10}}>
            <button onClick={()=>{onClose();setShowAddAcc(true);}} style={{...btn(C.accent,"#fff"),flex:1,padding:"11px"}}>＋ Add Account</button>
            <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"11px 18px",borderRadius:7}}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const openAccount=accounts.find(a=>a.id===openAccId);

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",overflow:"hidden"}}>
      {showAddAcc&&<AddAccountModal onClose={()=>setShowAddAcc(false)} onAdded={()=>{setShowAddAcc(false);loadAccounts();}}/>}
      {showManageAcc&&<ManageAccountsModal onClose={()=>setShowManageAcc(false)}/>}

      {/* Sidebar */}
      <div style={{width:280,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        {/* Header */}
        <div style={{padding:"24px 20px 18px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:"0.1em",marginBottom:14}}>MONITOR PORTAL</div>
          <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:3}}>{user.name}</div>
          <div style={{fontSize:12,color:C.muted}}>{user.email}</div>
        </div>

        {/* Accounts section header */}
        <div style={{padding:"12px 20px 6px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{fontSize:10,color:C.dim,letterSpacing:"0.08em"}}>MY ACCOUNTS ({accounts.length})</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setShowAddAcc(true)} style={{background:"none",border:`1px solid ${C.accent}40`,color:C.accent,cursor:"pointer",fontFamily:"inherit",fontSize:10,padding:"3px 8px",borderRadius:5,fontWeight:700}}>＋ Add</button>
            {accounts.length>0&&<button onClick={()=>setShowManageAcc(true)} style={{background:"none",border:`1px solid ${C.border}`,color:C.sub,cursor:"pointer",fontFamily:"inherit",fontSize:10,padding:"3px 8px",borderRadius:5,fontWeight:600}}>Manage</button>}
          </div>
        </div>

        {/* Accounts list — clean, no subreddit expansion */}
        <div style={{flex:1,overflowY:"auto"}}>
          {accounts.length===0
            ?<div style={{padding:"10px 20px",fontSize:12,color:C.dim}}>No accounts yet. Click + Add to get started.</div>
            :accounts.map(acc=>{
              const active=openAccId===acc.id&&section==="accounts";
              return(
                <div key={acc.id} onClick={()=>{setOpenAccId(acc.id);setSection("accounts");setMainTab("notifications");}}
                  style={{display:"flex",alignItems:"center",background:active?"#111827":"none",borderLeft:active?`3px solid ${C.accent}`:"3px solid transparent",transition:"all 0.1s",cursor:"pointer",padding:"11px 20px"}}
                  onMouseEnter={e=>{if(!active)e.currentTarget.style.background="#0F1117";}}
                  onMouseLeave={e=>{if(!active)e.currentTarget.style.background="none";}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:active?C.accent:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {acc.redditUsername?`u/${acc.redditUsername.replace(/^u\//,"")}`:acc.emailAddress}
                    </div>
                    {acc.redditUsername&&<div style={{fontSize:11,color:C.dim,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.emailAddress}</div>}
                    <div style={{fontSize:10,color:active?C.accent+"80":C.dim,marginTop:2}}>
                      {(acc.subreddits??[]).length} active · {(acc.pausedSubreddits??[]).length} on hold
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>

        {/* Bottom nav: Holders + Logout */}
        <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 12px"}}>
          <div onClick={()=>{setSection("holders");setSelectedHolder(null);}}
            style={{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:7,cursor:"pointer",marginBottom:2,
              background:section==="holders"?"#0D1626":"transparent",
              borderLeft:`2px solid ${section==="holders"?C.accent:"transparent"}`,transition:"background 0.12s"}}
            onMouseEnter={e=>{if(section!=="holders")e.currentTarget.style.background="#111318";}}
            onMouseLeave={e=>{if(section!=="holders")e.currentTarget.style.background="transparent";}}>
            <span style={{width:20,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:section==="holders"?C.accent:"#6B7280"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <span style={{fontSize:12,color:section==="holders"?C.accent:"#9CA3AF",fontWeight:section==="holders"?600:400,flex:1}}>Holders</span>
            {holders.length>0&&<span style={{fontSize:10,color:"#6B7280"}}>{holders.length}</span>}
          </div>
          <div onClick={()=>setShowPauseModal(true)}
            style={{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:7,cursor:"pointer",marginBottom:2,
              background:isPaused?"#0A1A10":"transparent",
              borderLeft:`2px solid ${isPaused?C.green:"transparent"}`,transition:"background 0.12s"}}
            onMouseEnter={e=>{if(!isPaused)e.currentTarget.style.background="#111318";}}
            onMouseLeave={e=>{if(!isPaused)e.currentTarget.style.background=isPaused?"#0A1A10":"transparent";}}>
            <span style={{width:20,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:isPaused?C.green:"#6B7280"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </span>
            <span style={{fontSize:12,color:isPaused?C.green:"#9CA3AF",flex:1}}>
              {isPaused?`Paused · ${pauseTimeLeft(pausedUntil)||"resuming"}`:"Pause Notifications"}
            </span>
          </div>
          <div onClick={onLogout} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:7,cursor:"pointer"}}
            onMouseEnter={e=>e.currentTarget.style.background="#111318"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{width:20,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#6B7280"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            <span style={{fontSize:12,color:"#9CA3AF"}}>Logout</span>
          </div>
        </div>
      </div>

      {showPauseModal&&<PauseModal isPaused={!!isPaused} pausedUntil={pausedUntil} onClose={()=>setShowPauseModal(false)} onPause={pauseNotifications} onResume={resumeNotifications}/>}

      {/* Main content */}
      {section==="accounts"
        ? openAccId
          ? <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {/* Tab bar */}
              <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",gap:0,flexShrink:0,padding:"0 32px"}}>
                {[["notifications","Notifications"],["subreddits","Manage Subreddits"]].map(([key,label])=>{
                  const a=mainTab===key;
                  return(<button key={key} onClick={()=>setMainTab(key)} style={{background:"none",border:"none",borderBottom:a?`2px solid ${C.accent}`:"2px solid transparent",color:a?C.accent:C.dim,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:a?700:500,padding:"14px 18px",marginBottom:-1,transition:"color 0.12s"}}>{label}</button>);
                })}
              </div>
              {mainTab==="notifications"
                ?<MyNotifications accounts={accounts} openAccId={openAccId} onSetAccId={setOpenAccId}/>
                :<ManageSubredditsPanel account={openAccount} onUpdated={loadAccounts}/>
              }
            </div>
          : <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:C.dim}}>
              <div style={{fontSize:32}}>👤</div>
              <div style={{fontSize:14}}>Select an account from the sidebar</div>
            </div>
        : selectedHolder
          ? <HolderDetail key={selectedHolder.id} holder={selectedHolder} onBack={()=>setSelectedHolder(null)}/>
          : <HoldersOverview holders={holders} onSelect={setSelectedHolder}/>
      }
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState(null); const [newSignup,setNewSignup]=useState(false); const [checked,setChecked]=useState(false);

  function saveUser(u){localStorage.setItem("user_data",JSON.stringify(u));setUser(u);}
  function logout(){localStorage.removeItem("token");localStorage.removeItem("user_data");setUser(null);setNewSignup(false);}

  useEffect(()=>{
    const t=localStorage.getItem("token");
    if(!t){setChecked(true);return;}
    try{
      const p=JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
      if(p.exp*1000>Date.now()&&(p.role==="monitor"||p.role==="main")){
        const stored=localStorage.getItem("user_data");
        if(stored){try{const u=JSON.parse(stored);if(u.role==="monitor"||(u.roles?.includes("monitor"))){setUser(u);setChecked(true);return;}}catch{}}
        fetch("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:t})})
          .then(r=>r.ok?r.json():null).then(d=>{if(d?.user)saveUser(d.user);else{localStorage.removeItem("token");localStorage.removeItem("user_data");}}).catch(()=>{}).finally(()=>setChecked(true));
      }else{localStorage.removeItem("token");localStorage.removeItem("user_data");setChecked(true);}
    }catch{setChecked(true);}
  },[]);

  if(!checked)return<div style={{height:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:"'IBM Plex Sans',sans-serif"}}>Loading...</div>;
  if(!user)return<AuthScreen onAuth={(u,isNew)=>{saveUser(u);setNewSignup(isNew);}}/>;
  if(newSignup)return<AccountSetup onDone={()=>setNewSignup(false)}/>;
  return<Dashboard user={user} onLogout={logout}/>;
}
