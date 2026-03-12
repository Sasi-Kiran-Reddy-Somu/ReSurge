import { useState, useEffect, useRef } from "react";
import { api } from "./api";

const C = { bg:"#0D0F16", surface:"#0F1117", border:"#1F2937", accent:"#F59E0B", blue:"#3B82F6", green:"#22C55E", red:"#EF4444", muted:"#6B7280", dim:"#374151", text:"#F9FAFB", sub:"#9CA3AF", orange:"#FF4500" };
const btn = (bg=C.accent,fg="#000",ex={}) => ({ background:bg,color:fg,border:"none",borderRadius:7,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13,whiteSpace:"nowrap",...ex });
const inp = { background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box" };
const statusColor = s => s==="posted"?C.green:s==="done"?C.dim:s==="opened"?C.blue:C.accent;
const displayStatus = s => s==="sent"?"new":s;
function timeAgo(ts){const d=(Date.now()-new Date(ts).getTime())/1000;if(d<60)return`${Math.round(d)}s ago`;if(d<3600)return`${Math.round(d/60)}m ago`;if(d<86400)return`${Math.round(d/3600)}h ago`;return`${Math.round(d/86400)}d ago`;}

const ROLE_LABELS={main:"Main Admin",monitor:"Monitor",holder:"Holder"};
const ROLE_PORTS={main:3000,monitor:3003,holder:3002};
const ROLE_COLORS={main:"#FF4500",monitor:"#3B82F6",holder:"#22C55E"};
const ROLE_DESC={main:"Admin dashboard & tracker",monitor:"Oversee holder activity",holder:"Post notifications & comments"};
const THIS_ROLE="holder";

function AuthScreen({onAuth}){
  const [step,setStep]=useState("pick"); // "pick" | "form"
  const [action,setAction]=useState(""); // "signin" | "signup"
  const [role,setRole]=useState("");
  const [form,setForm]=useState({email:"",password:"",name:"",phone:""});
  const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  function pick(action,role){setAction(action);setRole(role);setStep("form");setErr("");}

  async function submit(e){
    e.preventDefault();setErr("");setBusy(true);
    try{
      let res;
      if(action==="signup"){
        res=await api.signup({...form,role});
      } else {
        res=await api.login({email:form.email,password:form.password,loginAs:role});
      }
      if(role===THIS_ROLE){
        localStorage.setItem("token",res.token);onAuth(res.user,action==="signup");
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
          <div><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>Password</label><input style={inp} type="password" value={form.password} onChange={f("password")} required/></div>
          {err&&<div style={{color:C.red,fontSize:13}}>{err}</div>}
          <button type="submit" style={{...btn(ROLE_COLORS[role],role==="holder"?"#000":"#fff"),padding:"13px",fontSize:14}} disabled={busy}>
            {busy?"Please wait...":`${action==="signin"?"Sign in":"Create account"} →`}
          </button>
        </form>
        <div onClick={()=>{setStep("pick");setErr("");}} style={{textAlign:"center",marginTop:16,fontSize:12,color:C.dim,cursor:"pointer"}}>← Back to options</div>
      </div>
    </div>
  );
}

// Shared subreddit grid picker used in both AccountSetup and AddAccountModal
function SubredditGrid({allSubs,sel,onToggle}){
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
      {allSubs.map(s=>(
        <div key={s.name} onClick={()=>onToggle(s.name)}
          style={{background:sel.has(s.name)?"#1C1400":C.surface,border:`1px solid ${sel.has(s.name)?C.accent:C.border}`,borderRadius:10,padding:"16px 18px",cursor:"pointer",transition:"all 0.15s"}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:4}}>r/</div>
          <div style={{fontSize:14,fontWeight:600,color:sel.has(s.name)?C.accent:C.text}}>{s.name}</div>
        </div>
      ))}
      {allSubs.length===0&&<div style={{color:C.dim,fontSize:13}}>No subreddits tracked yet.</div>}
    </div>
  );
}

// Full-screen account setup (first-time signup flow)
function AccountSetup({onDone}){
  const [form,setForm]=useState({emailAddress:"",redditUsername:""});
  const [allSubs,setAllSubs]=useState([]);
  const [sel,setSel]=useState(new Set());
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  useEffect(()=>{api.getSubreddits().then(setAllSubs).catch(()=>{});},[]);
  function toggle(name){setSel(p=>{const n=new Set(p);n.has(name)?n.delete(name):n.add(name);return n;});}
  async function save(){
    if(!form.emailAddress){setErr("Email address is required");return;}
    setBusy(true);setErr("");
    try{await api.addAccount({...form,subreddits:[...sel]});onDone();}
    catch(e){setErr(e.message);}
    finally{setBusy(false);}
  }
  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",overflow:"hidden"}}>
      <div style={{width:320,background:C.surface,borderRight:`1px solid ${C.border}`,padding:40,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Set up your account</div>
        <div style={{color:C.muted,fontSize:13,lineHeight:1.7,marginBottom:28}}>Add the account you'll use to post comments on Reddit.</div>
        <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:24}}>
          <div>
            <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>Email Address *</label>
            <input style={inp} value={form.emailAddress} onChange={e=>setForm(p=>({...p,emailAddress:e.target.value}))} placeholder="email@example.com"/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>Reddit Username (optional)</label>
            <input style={inp} value={form.redditUsername} onChange={e=>setForm(p=>({...p,redditUsername:e.target.value}))} placeholder="u/username"/>
          </div>
        </div>
        {err&&<div style={{color:C.red,fontSize:12,marginBottom:12}}>{err}</div>}
        <div style={{marginTop:"auto"}}>
          <div style={{fontSize:13,color:C.sub,marginBottom:10}}>{sel.size} subreddit{sel.size!==1?"s":""} selected</div>
          <button onClick={save} disabled={busy||!form.emailAddress} style={{...btn(C.accent,"#000"),width:"100%",padding:"13px"}}>
            {busy?"Saving...":"Save & Continue →"}
          </button>
          <button onClick={onDone} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontFamily:"inherit",fontSize:12,marginTop:10,padding:0}}>
            Skip for now →
          </button>
        </div>
      </div>
      <div style={{flex:1,padding:40,overflowY:"auto"}}>
        <div style={{fontSize:14,fontWeight:700,color:C.sub,marginBottom:20}}>Pick subreddits for this account</div>
        <SubredditGrid allSubs={allSubs} sel={sel} onToggle={toggle}/>
      </div>
    </div>
  );
}

// Modal for adding an account from within the dashboard
function AddAccountModal({onClose,onAdded}){
  const [form,setForm]=useState({emailAddress:"",redditUsername:""});
  const [allSubs,setAllSubs]=useState([]);
  const [sel,setSel]=useState(new Set());
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  useEffect(()=>{api.getSubreddits().then(setAllSubs).catch(()=>{});},[]);
  function toggle(name){setSel(p=>{const n=new Set(p);n.has(name)?n.delete(name):n.add(name);return n;});}
  async function save(){
    if(!form.emailAddress){setErr("Email address is required");return;}
    setBusy(true);setErr("");
    try{await api.addAccount({...form,subreddits:[...sel]});onAdded();}
    catch(e){setErr(e.message);}
    finally{setBusy(false);}
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:16,width:"min(780px,96vw)",maxHeight:"88vh",display:"flex",overflow:"hidden"}}>
        <div style={{width:280,background:C.surface,padding:32,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:6}}>Add Account</div>
          <div style={{color:C.muted,fontSize:12,lineHeight:1.7,marginBottom:22}}>Add a new Reddit account and pick its subreddits.</div>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
            <div>
              <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5}}>Email Address *</label>
              <input style={inp} value={form.emailAddress} onChange={e=>setForm(p=>({...p,emailAddress:e.target.value}))} placeholder="email@example.com"/>
            </div>
            <div>
              <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5}}>Reddit Username (optional)</label>
              <input style={inp} value={form.redditUsername} onChange={e=>setForm(p=>({...p,redditUsername:e.target.value}))} placeholder="u/username"/>
            </div>
          </div>
          {err&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{err}</div>}
          <div style={{marginTop:"auto"}}>
            <div style={{fontSize:12,color:C.sub,marginBottom:8}}>{sel.size} subreddit{sel.size!==1?"s":""} selected</div>
            <button onClick={save} disabled={busy||!form.emailAddress} style={{...btn(C.accent,"#000"),width:"100%",padding:"11px",marginBottom:8}}>
              {busy?"Saving...":"Add Account →"}
            </button>
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

function PostPopup({notif,cachedComment,onCommentCached,onClose,onAction}){
  const [comment,setComment]=useState(cachedComment);const [loading,setLoading]=useState(false);const [copied,setCopied]=useState(false);const [showPaste,setShowPaste]=useState(false);const [link,setLink]=useState("");const [err,setErr]=useState("");
  async function generate(){setLoading(true);setErr("");try{const c=(await api.generateComment(notif.postId)).comment;setComment(c);if(onCommentCached)onCommentCached(c);}catch(e){setErr(e.message);}finally{setLoading(false);}}
  async function copy(){await navigator.clipboard.writeText(comment);setCopied(true);setTimeout(()=>setCopied(false),2000);}
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:32}}>
      <div style={{background:C.surface,border:`1px solid #2A1F00`,borderLeft:`4px solid ${C.accent}`,borderRadius:16,padding:36,maxWidth:660,width:"100%",maxHeight:"86vh",overflowY:"auto",boxShadow:"0 0 80px rgba(245,158,11,0.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
          <div style={{flex:1,paddingRight:20}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:"0.06em",marginBottom:8}}>🔥 VIRAL · r/{notif.subreddit}</div>
            <a href={notif.postUrl} target="_blank" rel="noreferrer" style={{color:C.text,fontSize:17,lineHeight:1.55,textDecoration:"none",fontWeight:600}}>{notif.postTitle}</a>
          </div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontSize:18,borderRadius:8,width:36,height:36,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
        </div>
        {!comment&&<button onClick={generate} disabled={loading} style={{...btn(loading?"#78350F":C.accent,loading?"#FCD34D":"#000"),width:"100%",padding:"14px",marginBottom:16,fontSize:14}}>{loading?"Generating...":"✨ Generate Comment"}</button>}
        {err&&<div style={{color:C.red,fontSize:13,marginBottom:12}}>{err}</div>}
        {comment&&<div style={{background:"#080B12",border:`1px solid #1E3A5F`,borderRadius:12,padding:22,marginBottom:20}}><p style={{margin:"0 0 16px",fontSize:14,color:"#D1D5DB",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{comment}</p><div style={{display:"flex",gap:10}}><button onClick={()=>{setComment(null);generate();}} style={btn("#1F2937",C.sub)}>↺ Regenerate</button><button onClick={copy} style={btn(copied?"#064E3B":"#1F2937",copied?C.green:C.sub)}>{copied?"✓ Copied!":"Copy Text"}</button></div></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:showPaste?16:0}}>
          <button onClick={()=>window.open(notif.postUrl,"_blank")} style={btn("#1A1D2E",C.sub,{border:`1px solid ${C.border}`})}>Open Post ↗</button>
          <button onClick={async()=>{await api.markDone(notif.id);onAction();}} style={btn("#1F2937",C.muted)}>Done</button>
          <button onClick={()=>setShowPaste(true)} style={btn("#064E3B",C.green)}>✓ Posted</button>
        </div>
        {showPaste&&<div style={{background:"#060D0A",border:`1px solid #065F46`,borderRadius:10,padding:20,marginTop:12}}><label style={{fontSize:12,color:C.muted,display:"block",marginBottom:8}}>Paste your Reddit comment link:</label><input style={{...inp,marginBottom:12}} placeholder="https://reddit.com/r/.../comment/..." value={link} onChange={e=>setLink(e.target.value)}/><button onClick={async()=>{if(!link.trim())return;await api.markPosted(notif.id,link.trim());onAction();}} style={{...btn(C.green,"#000"),width:"100%"}}>Submit & Save</button></div>}
      </div>
    </div>
  );
}

function NotifList({notifs,onOpen}){
  if(notifs.length===0)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60%",gap:14}}>
      <div style={{fontSize:44}}>📭</div>
      <div style={{fontSize:16,color:C.muted}}>No notifications yet</div>
      <div style={{fontSize:13,color:C.dim}}>You'll get an email when a viral post appears in your subreddits.</div>
    </div>
  );
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {notifs.map(n=>(
        <div key={n.id} onClick={()=>onOpen(n.id)}
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
  );
}

function ManageAccountsModal({accounts,onClose,onDeleted,onAdd,delBusy}){
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
                <button onClick={()=>onDeleted(acc.id)} disabled={delBusy===acc.id}
                  style={{background:"none",border:"1px solid #7F1D1D",color:"#EF4444",cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:"5px 12px",borderRadius:6,fontWeight:600,flexShrink:0,opacity:delBusy===acc.id?0.5:1}}>
                  {delBusy===acc.id?"Removing…":"Remove"}
                </button>
              </div>
            ))
          }
        </div>
        <div style={{padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10}}>
          <button onClick={onAdd} style={{...btn(C.accent,"#000"),flex:1,padding:"11px"}}>＋ Add Account</button>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"11px 18px",borderRadius:7}}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({user,onLogout}){
  const [notifs,setNotifs]=useState([]);
  const [accounts,setAccounts]=useState([]);
  const [openAccId,setOpenAccId]=useState(null);
  const [tab,setTab]=useState("all");
  const [search,setSearch]=useState("");
  const [timeFilter,setTimeFilter]=useState("all");
  const [fromDate,setFromDate]=useState("");
  const [toDate,setToDate]=useState("");
  const [popup,setPopup]=useState(null);
  const [showAddAcc,setShowAddAcc]=useState(false);
  const [showManageAcc,setShowManageAcc]=useState(false);
  const [delAccBusy,setDelAccBusy]=useState(null);
  const commentCache=useRef({});

  useEffect(()=>{
    load();
    loadAccounts();
    const p=new URLSearchParams(window.location.search);
    const nId=p.get("postId");
    if(nId){
      api.getNotification(nId).then(notif=>{
        setPopup(notif);
        if(notif.accountId)setOpenAccId(notif.accountId);
      }).catch(()=>{});
      window.history.replaceState({},"","/");
    }
  },[]);

  function loadAccounts(){
    api.getAccounts().then(accs=>{setAccounts(accs);if(accs.length>0)setOpenAccId(id=>id||accs[0].id);}).catch(()=>{});
  }

  async function deleteAccount(accId){
    setDelAccBusy(accId);
    try{await api.deleteAccount(accId);loadAccounts();if(openAccId===accId)setOpenAccId(null);}
    catch(e){alert(e.message);}
    finally{setDelAccBusy(null);}
  }

  async function load(){try{setNotifs(await api.getNotifications());}catch{}}

  // Notifications scoped to selected account (or all if none selected)
  const scopedNotifs = openAccId
    ? notifs.filter(n=>n.accountId===openAccId)
    : notifs;

  // Time filter
  const now=Date.now();
  function getTimeBounds(key){
    if(key==="today") return{from:now-86400000,to:now};
    if(key==="week")  return{from:now-7*86400000,to:now};
    if(key==="month") return{from:now-30*86400000,to:now};
    if(key==="custom"){
      const f=fromDate?new Date(fromDate).getTime():0;
      const t=toDate?new Date(toDate).getTime()+86399999:now;
      return{from:f,to:t};
    }
    return{from:0,to:Infinity};
  }
  const{from:tFrom,to:tTo}=getTimeBounds(timeFilter);
  const timeFiltered=scopedNotifs.filter(n=>{const ms=new Date(n.sentAt).getTime();return ms>=tFrom&&ms<=tTo;});

  // Status tab filter
  const tabFiltered=timeFiltered.filter(n=>tab==="all"||(tab==="viewed"?n.status==="opened":n.status===tab));

  // Search filter
  const filtered=tabFiltered.filter(n=>{
    if(!search)return true;
    const q=search.toLowerCase();
    return n.postTitle?.toLowerCase().includes(q)||n.subreddit?.toLowerCase().includes(q);
  });

  const counts={all:timeFiltered.length,viewed:timeFiltered.filter(n=>n.status==="opened").length,posted:timeFiltered.filter(n=>n.status==="posted").length};

  const openAcc = accounts.find(a=>a.id===openAccId);

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",overflow:"hidden"}}>
      {popup&&<PostPopup notif={popup} cachedComment={commentCache.current[popup.postId]||null} onCommentCached={c=>{commentCache.current[popup.postId]=c;}} onClose={()=>setPopup(null)} onAction={()=>{setPopup(null);load();}}/>}
      {showAddAcc&&<AddAccountModal onClose={()=>setShowAddAcc(false)} onAdded={()=>{setShowAddAcc(false);loadAccounts();}}/>}
      {showManageAcc&&<ManageAccountsModal accounts={accounts} delBusy={delAccBusy} onClose={()=>setShowManageAcc(false)} onDeleted={async id=>{await deleteAccount(id);}} onAdd={()=>{setShowManageAcc(false);setShowAddAcc(true);}}/>}

      {/* Sidebar */}
      <div style={{width:270,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"24px 20px 18px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:"0.1em",marginBottom:14}}>🎯 HOLDER PORTAL</div>
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

        {/* Accounts accordion */}
        <div style={{flex:1,overflowY:"auto"}}>
          {accounts.length===0
            ? <div style={{padding:"10px 20px",fontSize:12,color:C.dim}}>No accounts yet. Click + Add to get started.</div>
            : accounts.map(acc=>{
              const isOpen=openAccId===acc.id;
              const accNotifs=notifs.filter(n=>n.accountId===acc.id);
              const accPosted=accNotifs.filter(n=>n.status==="posted").length;
              return(
                <div key={acc.id}>
                  {/* Account header row */}
                  <div onClick={()=>setOpenAccId(isOpen?null:acc.id)}
                    style={{display:"flex",alignItems:"center",background:isOpen?"#111827":"none",borderLeft:isOpen?`3px solid ${C.accent}`:"3px solid transparent",transition:"all 0.1s",cursor:"pointer"}}
                    onMouseEnter={e=>{if(!isOpen)e.currentTarget.style.background="#0F1117";}}
                    onMouseLeave={e=>{if(!isOpen)e.currentTarget.style.background="none";}}>
                    <div style={{flex:1,padding:"10px 20px",minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:isOpen?C.accent:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {acc.redditUsername?`u/${acc.redditUsername.replace(/^u\//,"")}`:acc.emailAddress}
                      </div>
                      {acc.redditUsername&&<div style={{fontSize:11,color:C.dim,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.emailAddress}</div>}
                    </div>
                    <span style={{color:C.dim,fontSize:11,paddingRight:14}}>{isOpen?"▲":"▼"}</span>
                  </div>

                  {/* Expanded: stats + subreddits + manage */}
                  {isOpen&&(
                    <div style={{background:"#0A0D14",borderBottom:`1px solid ${C.border}20`}}>
                      <div style={{display:"flex",gap:0,padding:"10px 20px 0"}}>
                        {[{l:"Notified",v:accNotifs.length,c:C.sub},{l:"Posted",v:accPosted,c:C.green}].map(s=>(
                          <div key={s.l} style={{flex:1}}>
                            <div style={{fontSize:16,fontWeight:700,color:s.c}}>{s.v}</div>
                            <div style={{fontSize:10,color:C.dim}}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                      {acc.subreddits&&acc.subreddits.length>0&&(
                        <div style={{padding:"10px 20px 8px"}}>
                          <div style={{fontSize:10,color:C.dim,letterSpacing:"0.06em",marginBottom:7}}>SUBREDDITS</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {acc.subreddits.map(s=><span key={s} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.sub,padding:"2px 8px",borderRadius:10,fontSize:10}}>r/{s}</span>)}
                          </div>
                        </div>
                      )}
                      <div style={{padding:"6px 20px 12px"}}>
                        <button onClick={e=>{e.stopPropagation();setShowManageAcc(true);}}
                          style={{background:"none",border:`1px solid ${C.border}`,color:C.sub,cursor:"pointer",fontFamily:"inherit",fontSize:10,padding:"4px 10px",borderRadius:5,fontWeight:600}}>
                          Manage Accounts
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>

        <div style={{padding:"16px 20px",borderTop:`1px solid ${C.border}`}}>
          <button onClick={onLogout} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"6px 0"}}>→ Logout</button>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"22px 32px 14px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <div style={{fontSize:20,fontWeight:800,color:C.text}}>
                {openAcc
                  ? (openAcc.redditUsername ? `u/${openAcc.redditUsername.replace(/^u\//,"")}` : openAcc.emailAddress)
                  : "All Notifications"}
              </div>
              {openAcc&&openAcc.redditUsername&&(
                <div style={{fontSize:12,color:C.muted,marginTop:1}}>{openAcc.emailAddress}</div>
              )}
              <div style={{fontSize:12,color:C.muted,marginTop:3}}>
                {openAcc
                  ? "Click any post to open, generate a comment and mark as posted"
                  : "Click any post to open, generate a comment and mark as posted"}
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexShrink:0}}>
              {["all","viewed","posted"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:tab===t?"#1C1400":"#161B26",color:tab===t?C.accent:C.sub,border:tab===t?`1px solid ${C.accent}40`:`1px solid ${C.border}`,borderRadius:7,padding:"8px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:tab===t?700:500}}>{t} <span style={{opacity:0.8}}>({counts[t]??0})</span></button>)}
            </div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <input
              style={{...inp,flex:1,minWidth:160,padding:"8px 12px",fontSize:12}}
              placeholder="Search by post title or subreddit…"
              value={search}
              onChange={e=>setSearch(e.target.value)}
            />
            <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
              {[{k:"all",l:"All time"},{k:"today",l:"Today"},{k:"week",l:"7d"},{k:"month",l:"30d"},{k:"custom",l:"Custom"}].map(({k,l})=>(
                <button key={k} onClick={()=>setTimeFilter(k)} style={{background:timeFilter===k?"#1C1400":"#161B26",color:timeFilter===k?C.accent:C.sub,border:timeFilter===k?`1px solid ${C.accent}40`:`1px solid ${C.border}`,borderRadius:7,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:timeFilter===k?700:500,whiteSpace:"nowrap"}}>{l}</button>
              ))}
              {timeFilter==="custom"&&(
                <>
                  <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{...inp,padding:"7px 10px",fontSize:11,colorScheme:"dark"}}/>
                  <span style={{fontSize:11,color:C.dim}}>–</span>
                  <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{...inp,padding:"7px 10px",fontSize:11,colorScheme:"dark"}}/>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
          <NotifList notifs={filtered} onOpen={id=>api.getNotification(id).then(setPopup).catch(()=>{})}/>
        </div>
      </div>
    </div>
  );
}

function decodeJwt(t){try{const b=t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(atob(b));}catch{return null;}}

export default function App(){
  const [user,setUser]=useState(null);const [newSignup,setNewSignup]=useState(false);const [checked,setChecked]=useState(false);

  function saveUser(u){localStorage.setItem("user_data",JSON.stringify(u));setUser(u);}
  function logout(){localStorage.removeItem("token");localStorage.removeItem("user_data");setUser(null);setNewSignup(false);}

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const urlToken=params.get("token");const urlRole=params.get("role");

    if(urlToken&&urlRole==="holder"){
      localStorage.setItem("token",urlToken);
      const postId=params.get("postId");
      window.history.replaceState({},"",postId?`/?postId=${postId}`:`/`);
      // Verify deep-link token and cache user
      fetch("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:urlToken})})
        .then(r=>r.ok?r.json():null)
        .then(d=>{if(d?.user)saveUser(d.user);else{localStorage.removeItem("token");localStorage.removeItem("user_data");}})
        .catch(()=>{})
        .finally(()=>setChecked(true));
      return;
    }

    const t=localStorage.getItem("token");
    if(!t){setChecked(true);return;}

    const p=decodeJwt(t);
    // If token is expired, clear everything
    if(!p||p.exp*1000<=Date.now()){
      localStorage.removeItem("token");localStorage.removeItem("user_data");setChecked(true);return;
    }

    // Check cached user_data first — if it has holder role, trust it without API call
    const stored=localStorage.getItem("user_data");
    if(stored){
      try{
        const u=JSON.parse(stored);
        if(u.role==="holder"||(u.roles&&u.roles.includes("holder"))){
          setUser(u);setChecked(true);return;
        }
      }catch{}
    }

    // No cached data or wrong role — verify with API
    if(p.role!=="holder"){
      localStorage.removeItem("token");localStorage.removeItem("user_data");setChecked(true);return;
    }
    fetch("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:t})})
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(d?.user)saveUser(d.user);else{localStorage.removeItem("token");localStorage.removeItem("user_data");}})
      .catch(()=>{})
      .finally(()=>setChecked(true));
  },[]);

  if(!checked)return<div style={{height:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:"'IBM Plex Sans',sans-serif"}}>Loading...</div>;
  if(!user)return<AuthScreen onAuth={(u,isNew)=>{saveUser(u);setNewSignup(isNew);}}/>;
  if(newSignup)return<AccountSetup onDone={()=>setNewSignup(false)}/>;
  return<Dashboard user={user} onLogout={logout}/>;
}
