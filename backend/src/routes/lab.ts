import { Hono } from "hono";
import { db } from "../db/client.js";
import { posts } from "../db/schema.js";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { generateComment } from "../lib/commentGenerator.js";
import { PERSONALITIES, getPersonalityById } from "../lib/personalities.js";

export const labRoutes = new Hono();

// Tiny shared-password gate. Set LAB_PASSWORD in env to use it.
// If unset, lab is open (fine for local-only testing).
function checkLab(c: any): boolean {
  const required = process.env.LAB_PASSWORD;
  if (!required) return true;
  const hdr = c.req.header("X-Lab-Password") ?? c.req.query("k") ?? "";
  return hdr === required;
}

// GET /api/lab/recent-s3-posts — recent S3/alerted posts for the lab dropdown
labRoutes.get("/recent-s3-posts", async (c) => {
  if (!checkLab(c)) return c.json({ error: "lab locked" }, 401);
  const rows = await db
    .select()
    .from(posts)
    .where(isNotNull(posts.alertedAt))
    .orderBy(desc(posts.alertedAt))
    .limit(25);
  return c.json(rows);
});

// POST /api/lab/generate-grid — generate ONE comment per personality for a given post.
// Does NOT persist assignments; pure ephemeral test.
labRoutes.post("/generate-grid", async (c) => {
  if (!checkLab(c)) return c.json({ error: "lab locked" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const postId: string | undefined = body.postId;
  if (!postId) return c.json({ error: "postId required" }, 400);

  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return c.json({ error: "post not found" }, 404);

  const out: Array<{ personalityId: string; personalityName: string; comment: string; error?: string }> = [];
  for (const p of PERSONALITIES) {
    try {
      const text = await generateComment(post, undefined, undefined, [], p);
      out.push({ personalityId: p.id, personalityName: p.name, comment: text });
    } catch (e: any) {
      out.push({ personalityId: p.id, personalityName: p.name, comment: "", error: e.message });
    }
  }

  return c.json({
    post: { id: post.id, title: post.title, subreddit: post.subreddit, selftext: post.selftext, url: post.url },
    results: out,
  });
});

// POST /api/lab/generate-grid-adhoc — same as generate-grid but for a pasted post
// (title + body, no DB lookup). Top-comments fetch is skipped since there's no redditId.
labRoutes.post("/generate-grid-adhoc", async (c) => {
  if (!checkLab(c)) return c.json({ error: "lab locked" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const title: string = (body.title ?? "").trim();
  const selftext: string = (body.selftext ?? "").trim();
  const subreddit: string = (body.subreddit ?? "general").trim().toLowerCase();
  if (!title) return c.json({ error: "title required" }, 400);

  const fakePost = {
    id: "adhoc",
    redditId: "",
    subreddit,
    title,
    selftext,
    url: "",
  };

  const out: Array<{ personalityId: string; personalityName: string; comment: string; error?: string }> = [];
  for (const p of PERSONALITIES) {
    try {
      const text = await generateComment(fakePost, undefined, undefined, [], p);
      out.push({ personalityId: p.id, personalityName: p.name, comment: text });
    } catch (e: any) {
      out.push({ personalityId: p.id, personalityName: p.name, comment: "", error: e.message });
    }
  }

  return c.json({
    post: { id: "adhoc", title, subreddit, selftext, url: "" },
    results: out,
  });
});

// POST /api/lab/regenerate-one-adhoc — same as regenerate-one but for pasted post
labRoutes.post("/regenerate-one-adhoc", async (c) => {
  if (!checkLab(c)) return c.json({ error: "lab locked" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const title: string = (body.title ?? "").trim();
  const selftext: string = (body.selftext ?? "").trim();
  const subreddit: string = (body.subreddit ?? "general").trim().toLowerCase();
  const personalityId: string = body.personalityId;
  if (!title || !personalityId) return c.json({ error: "title + personalityId required" }, 400);
  const p = getPersonalityById(personalityId);
  if (!p) return c.json({ error: "personality not found" }, 404);

  const fakePost = { id: "adhoc", redditId: "", subreddit, title, selftext, url: "" };
  const text = await generateComment(fakePost, undefined, undefined, [], p);
  return c.json({ personalityId: p.id, personalityName: p.name, comment: text });
});

// POST /api/lab/regenerate-one — regenerate ONE personality for a post (for stability check)
labRoutes.post("/regenerate-one", async (c) => {
  if (!checkLab(c)) return c.json({ error: "lab locked" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const postId: string | undefined = body.postId;
  const personalityId: string | undefined = body.personalityId;
  if (!postId || !personalityId) return c.json({ error: "postId + personalityId required" }, 400);

  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return c.json({ error: "post not found" }, 404);
  const p = getPersonalityById(personalityId);
  if (!p) return c.json({ error: "personality not found" }, 404);

  const text = await generateComment(post, undefined, undefined, [], p);
  return c.json({ personalityId: p.id, personalityName: p.name, comment: text });
});

// GET /api/lab — the lab HTML page itself
labRoutes.get("/", async (c) => {
  const locked = !!process.env.LAB_PASSWORD;
  return c.html(LAB_HTML.replace("__LOCKED__", locked ? "true" : "false"));
});

const LAB_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ReSurge — Personality Lab</title>
<style>
  :root { --bg:#0D0F16; --surf:#0F1117; --bord:#1F2937; --text:#F9FAFB; --mute:#9CA3AF; --acc:#7DD3FC; --warn:#FCD34D; }
  * { box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--text); margin:0; padding:24px; }
  h1 { font-size:18px; margin:0 0 16px; letter-spacing:0.04em; }
  .tabs { display:flex; gap:4px; margin-bottom:20px; border-bottom:1px solid var(--bord); }
  .tabs button { background:none; border:none; color:var(--mute); padding:10px 18px; cursor:pointer; font-size:13px; border-bottom:2px solid transparent; }
  .tabs button.active { color:var(--acc); border-bottom-color:var(--acc); }
  select, button, input { background:var(--surf); color:var(--text); border:1px solid var(--bord); border-radius:6px; padding:8px 12px; font-size:13px; font-family:inherit; }
  button { cursor:pointer; }
  button:hover:not(:disabled) { border-color:var(--acc); color:var(--acc); }
  button:disabled { opacity:0.5; cursor:wait; }
  .row { display:flex; gap:10px; align-items:center; margin-bottom:16px; }
  .post-card { background:var(--surf); border:1px solid var(--bord); border-left:3px solid var(--acc); border-radius:8px; padding:14px 18px; margin-bottom:20px; }
  .post-card .ttl { font-size:14px; font-weight:600; margin-bottom:6px; }
  .post-card .meta { font-size:11px; color:var(--mute); }
  .post-card .body { font-size:12px; color:#D1D5DB; margin-top:8px; max-height:120px; overflow-y:auto; line-height:1.5; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:900px) { .grid { grid-template-columns:1fr; } }
  .cell { background:var(--surf); border:1px solid var(--bord); border-radius:8px; padding:16px; }
  .cell h3 { margin:0 0 6px; font-size:12px; color:var(--acc); letter-spacing:0.06em; text-transform:uppercase; }
  .cell .anchor { font-size:11px; color:var(--mute); margin-bottom:10px; font-style:italic; }
  .cell .out { font-size:13px; line-height:1.7; white-space:pre-wrap; color:#E5E7EB; padding:10px; background:#080B12; border-radius:6px; min-height:60px; }
  .cell .actions { margin-top:10px; display:flex; gap:8px; }
  .cell .actions button { font-size:11px; padding:5px 10px; }
  .blind-card { background:var(--surf); border:1px solid var(--bord); border-radius:8px; padding:24px; max-width:680px; }
  .blind-card .qcomment { font-size:14px; line-height:1.8; white-space:pre-wrap; padding:14px; background:#080B12; border-radius:6px; margin-bottom:16px; }
  .blind-choices { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .blind-choices button { padding:12px; text-align:left; }
  .blind-choices button.right { border-color:#10B981; color:#10B981; }
  .blind-choices button.wrong { border-color:#EF4444; color:#EF4444; }
  .score { font-size:13px; color:var(--mute); margin-bottom:12px; }
  .err { color:#EF4444; font-size:12px; }
  .password-gate { max-width:340px; }
  .password-gate input { width:100%; margin-bottom:8px; }
</style>
</head>
<body>

<h1>🧪 ReSurge Personality Lab</h1>

<div id="gate" class="password-gate" style="display:none;">
  <p style="font-size:12px;color:var(--mute);">Lab is password-protected.</p>
  <input id="pw" type="password" placeholder="lab password">
  <button onclick="unlock()">Unlock</button>
  <div id="gate-err" class="err"></div>
</div>

<div id="app" style="display:none;">
  <div class="tabs">
    <button class="active" onclick="switchTab('grid')">4-up Grid</button>
    <button onclick="switchTab('adhoc')">Ad-hoc Post</button>
    <button onclick="switchTab('blind')">Blind Test</button>
  </div>

  <div id="tab-grid">
    <div class="row">
      <select id="postSel" style="flex:1;min-width:200px;"></select>
      <button id="genBtn" onclick="genGrid()">Generate 4 Comments</button>
    </div>
    <div id="postShow"></div>
    <div id="grid" class="grid"></div>
  </div>

  <div id="tab-adhoc" style="display:none;">
    <div class="row" style="flex-direction:column;align-items:stretch;">
      <input id="adhocSub" placeholder="subreddit (e.g. 30PlusSkinCare)" style="margin-bottom:8px;">
      <input id="adhocTitle" placeholder="Post title" style="margin-bottom:8px;">
      <textarea id="adhocBody" placeholder="Post body (optional)" rows="8" style="background:var(--surf);color:var(--text);border:1px solid var(--bord);border-radius:6px;padding:10px;font-size:13px;font-family:inherit;resize:vertical;margin-bottom:8px;"></textarea>
      <button id="adhocBtn" onclick="genAdhoc()" style="align-self:flex-start;">Generate 4 Comments</button>
    </div>
    <div id="adhocShow"></div>
    <div id="adhocGrid" class="grid"></div>
  </div>

  <div id="tab-blind" style="display:none;">
    <div class="row">
      <select id="postSel2" style="flex:1;min-width:200px;"></select>
      <button onclick="startBlind()">New Blind Test</button>
    </div>
    <div class="score" id="score"></div>
    <div id="blind"></div>
  </div>
</div>

<script>
const LOCKED = __LOCKED__;
let pw = "";

const $ = (id) => document.getElementById(id);
const headers = () => ({ "Content-Type": "application/json", ...(pw ? { "X-Lab-Password": pw } : {}) });

async function api(path, opts={}) {
  const r = await fetch(path, { ...opts, headers: headers() });
  if (!r.ok) throw new Error((await r.json().catch(()=>({error:r.statusText}))).error);
  return r.json();
}

function init() {
  if (LOCKED) {
    const saved = localStorage.getItem("lab_pw");
    if (saved) { pw = saved; tryStart(); return; }
    $("gate").style.display = "block";
  } else { tryStart(); }
}
async function unlock() {
  pw = $("pw").value;
  try { await loadPosts(); localStorage.setItem("lab_pw", pw); $("gate").style.display="none"; $("app").style.display="block"; }
  catch (e) { $("gate-err").textContent = e.message; }
}
async function tryStart() {
  try { await loadPosts(); $("app").style.display="block"; }
  catch (e) { $("gate").style.display="block"; $("gate-err").textContent=e.message; }
}

let posts = [];
async function loadPosts() {
  posts = await api("/api/lab/recent-s3-posts");
  for (const sel of ["postSel","postSel2"]) {
    $(sel).innerHTML = posts.map(p => '<option value="'+p.id+'">r/'+p.subreddit+' — '+p.title.slice(0,80).replace(/"/g,"&quot;")+'</option>').join("");
  }
}

function switchTab(t) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
  $("tab-grid").style.display  = t==="grid"  ? "block" : "none";
  $("tab-adhoc").style.display = t==="adhoc" ? "block" : "none";
  $("tab-blind").style.display = t==="blind" ? "block" : "none";
}

async function genAdhoc() {
  const title = $("adhocTitle").value.trim();
  const selftext = $("adhocBody").value;
  const subreddit = $("adhocSub").value.trim() || "general";
  if (!title) { alert("Title required"); return; }
  $("adhocBtn").disabled = true;
  $("adhocGrid").innerHTML = '<div style="color:var(--mute);">Generating 4 comments… ~15-30s</div>';
  $("adhocShow").innerHTML = '';
  try {
    const r = await api("/api/lab/generate-grid-adhoc", { method:"POST", body: JSON.stringify({title, selftext, subreddit}) });
    $("adhocShow").innerHTML = '<div class="post-card"><div class="ttl">'+escape(r.post.title)+'</div><div class="meta">r/'+r.post.subreddit+'</div>'+(r.post.selftext?'<div class="body">'+escape(r.post.selftext)+'</div>':'')+'</div>';
    $("adhocGrid").innerHTML = r.results.map(x => '<div class="cell" data-pid="'+x.personalityId+'"><h3>'+x.personalityName+'</h3><div class="out">'+(x.error?'<span class="err">'+escape(x.error)+'</span>':escape(x.comment))+'</div><div class="actions"><button onclick="regenAdhoc(\''+x.personalityId+'\',this)">↺ Regenerate (same voice)</button></div></div>').join("");
  } catch (e) { $("adhocGrid").innerHTML = '<div class="err">'+e.message+'</div>'; }
  finally { $("adhocBtn").disabled = false; }
}

async function regenAdhoc(personalityId, btn) {
  const title = $("adhocTitle").value.trim();
  const selftext = $("adhocBody").value;
  const subreddit = $("adhocSub").value.trim() || "general";
  btn.disabled = true; btn.textContent = "…";
  try {
    const r = await api("/api/lab/regenerate-one-adhoc", { method:"POST", body: JSON.stringify({title, selftext, subreddit, personalityId}) });
    btn.closest(".cell").querySelector(".out").textContent = r.comment;
  } catch (e) { btn.textContent = "err: " + e.message; }
  finally { setTimeout(() => { btn.disabled=false; btn.textContent="↺ Regenerate (same voice)"; }, 800); }
}

function showPost(post) {
  $("postShow").innerHTML = '<div class="post-card"><div class="ttl">'+escape(post.title)+'</div><div class="meta">r/'+post.subreddit+' · <a href="'+post.url+'" target="_blank" style="color:var(--acc);">open ↗</a></div>'+(post.selftext?'<div class="body">'+escape(post.selftext)+'</div>':'')+'</div>';
}
function escape(s){return (s||"").replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));}

async function genGrid() {
  const id = $("postSel").value;
  $("genBtn").disabled = true;
  $("grid").innerHTML = '<div style="color:var(--mute);">Generating 4 comments… ~15-30s</div>';
  try {
    const r = await api("/api/lab/generate-grid", { method:"POST", body: JSON.stringify({postId:id}) });
    showPost(r.post);
    $("grid").innerHTML = r.results.map(x => '<div class="cell" data-pid="'+x.personalityId+'"><h3>'+x.personalityName+'</h3><div class="out">'+(x.error?'<span class="err">'+escape(x.error)+'</span>':escape(x.comment))+'</div><div class="actions"><button onclick="regen(\''+x.personalityId+'\',\''+id+'\',this)">↺ Regenerate (same voice)</button></div></div>').join("");
  } catch (e) { $("grid").innerHTML = '<div class="err">'+e.message+'</div>'; }
  finally { $("genBtn").disabled = false; }
}

async function regen(personalityId, postId, btn) {
  btn.disabled = true; btn.textContent="…";
  try {
    const r = await api("/api/lab/regenerate-one", { method:"POST", body: JSON.stringify({postId, personalityId}) });
    const cell = btn.closest(".cell");
    cell.querySelector(".out").textContent = r.comment;
  } catch (e) { btn.textContent = "err: "+e.message; }
  finally { setTimeout(() => { btn.disabled=false; btn.textContent="↺ Regenerate (same voice)"; }, 800); }
}

// ── Blind test ────────────────────────────────────────────────
let blindState = null;
let scoreRight = 0, scoreTotal = 0;
async function startBlind() {
  const id = $("postSel2").value;
  $("blind").innerHTML = '<div style="color:var(--mute);">Generating…</div>';
  try {
    const r = await api("/api/lab/generate-grid", { method:"POST", body: JSON.stringify({postId:id}) });
    const pick = r.results.filter(x=>!x.error)[Math.floor(Math.random()*r.results.filter(x=>!x.error).length)];
    blindState = { post: r.post, correct: pick.personalityId, all: r.results };
    renderBlind();
  } catch (e) { $("blind").innerHTML = '<div class="err">'+e.message+'</div>'; }
}
function renderBlind() {
  if (!blindState) return;
  const pick = blindState.all.find(x=>x.personalityId===blindState.correct);
  $("score").textContent = "Score: "+scoreRight+"/"+scoreTotal+(scoreTotal>0?" ("+Math.round(scoreRight/scoreTotal*100)+"%)":"");
  $("blind").innerHTML = '<div class="blind-card"><div style="font-size:11px;color:var(--mute);margin-bottom:8px;">POST</div><div style="font-size:13px;margin-bottom:14px;">'+escape(blindState.post.title)+'</div><div style="font-size:11px;color:var(--mute);margin-bottom:8px;">COMMENT</div><div class="qcomment">'+escape(pick.comment)+'</div><div style="font-size:11px;color:var(--mute);margin-bottom:8px;">WHO WROTE IT?</div><div class="blind-choices" id="choices">'+blindState.all.map(x=>'<button onclick="answer(\''+x.personalityId+'\')">'+escape(x.personalityName)+'</button>').join("")+'</div></div>';
}
function answer(pid) {
  scoreTotal++;
  if (pid === blindState.correct) scoreRight++;
  document.querySelectorAll("#choices button").forEach(b => {
    const txt = b.textContent;
    const match = blindState.all.find(x=>x.personalityName===txt);
    if (match.personalityId === blindState.correct) b.classList.add("right");
    else if (match.personalityId === pid) b.classList.add("wrong");
    b.disabled = true;
  });
  $("score").textContent = "Score: "+scoreRight+"/"+scoreTotal+" ("+Math.round(scoreRight/scoreTotal*100)+"%) · "+(pid===blindState.correct?"✓ correct":"✗ wrong — was "+blindState.all.find(x=>x.personalityId===blindState.correct).personalityName);
  setTimeout(() => { const btn = document.createElement("button"); btn.textContent="Next →"; btn.style.marginTop="14px"; btn.onclick=startBlind; $("blind").appendChild(btn); }, 200);
}

init();
</script>
</body>
</html>`;
