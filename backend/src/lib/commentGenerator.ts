import OpenAI from "openai";
import { Personality, renderPersonalityPrompt } from "./personalities.js";

const USER_AGENT = "ReSurge/1.0 (internal tool)";

// Fetch top comments from a Reddit post for tone calibration
async function fetchTopComments(subreddit: string, redditId: string): Promise<string[]> {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${redditId}.json?limit=15&sort=top&depth=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json() as any[];
    const comments = data?.[1]?.data?.children ?? [];
    return comments
      .map((c: any) => c?.data?.body as string)
      .filter((b: string) => b && b !== "[deleted]" && b !== "[removed]" && b.length > 10)
      .slice(0, 4);
  } catch {
    return [];
  }
}

// Strip em-dashes, en-dashes, and semicolons that the model slips through
// despite explicit bans. These are among the strongest AI tells in casual text.
function stripDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, ", ")   // " — " or " – " → ", "
    .replace(/[—–]/g, "-")          // any remaining standalone em/en → hyphen
    .replace(/\s*;\s*/g, ". ");     // semicolons → period (then capitalization
                                    // is handled by the model output already)
}

// Apply small human-like noise to the comment after generation. Layered, these
// nudge the output past AI-detection signature shapes without sounding fake.
// Each individual change has a low probability so we don't always do all of
// them on every comment — that pattern itself would become a tell.
function applyHumanNoise(text: string, allowsCasualNoise: boolean): string {
  let out = text;

  // 1. Drop one comma from the middle (~15% chance). Real people skip commas.
  if (Math.random() < 0.15) {
    const commaPositions: number[] = [];
    for (let i = 0; i < out.length; i++) if (out[i] === ",") commaPositions.push(i);
    // Skip first and last commas — those are often load-bearing for clauses.
    const candidates = commaPositions.slice(1, -1);
    if (candidates.length > 0) {
      const drop = candidates[Math.floor(Math.random() * candidates.length)];
      out = out.slice(0, drop) + out.slice(drop + 1);
    }
  }

  // The next tricks are only safe for casual voices — formal personas
  // (Veteran Power-User, HR Pro, Patient Teacher, Older Storyteller, etc.)
  // would feel off with lowercased openers or trailing "lol".
  if (!allowsCasualNoise) return out;

  // 2. Lowercase a sentence-start letter (~12% chance), but only the very first
  //    letter, and only if the rest of the comment uses sentence case (so
  //    we don't double-lowercase an already-lowercase persona).
  if (Math.random() < 0.12 && /^[A-Z]/.test(out)) {
    // Heuristic: if the first 60 chars contain another capital sentence-start,
    // the persona is sentence-case — safe to lowercase the opener.
    const head = out.slice(0, 80);
    if (/\.\s+[A-Z]/.test(head) || head.length === out.length) {
      out = out[0].toLowerCase() + out.slice(1);
    }
  }

  // 3. Strip the trailing period (~18%) — real casual comments often end without one.
  if (Math.random() < 0.18) {
    out = out.replace(/\.\s*$/, "");
  }

  return out;
}

export async function generateComment(
  post: {
    id: string;
    redditId: string;
    subreddit: string;
    title: string;
    selftext: string;
    url: string;
  },
  tone?: string,
  customPrompt?: string,
  previousComments?: string[],
  personality?: Personality,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey });

  const topComments = await fetchTopComments(post.subreddit, post.redditId);
  // Strip any of our own previously generated comments from the style examples
  // so the AI doesn't learn from and replicate them
  const filteredTopComments = previousComments && previousComments.length > 0
    ? topComments.filter(c => !previousComments.some(p => c.trim().slice(0, 40) === p.trim().slice(0, 40)))
    : topComments;
  const commentsContext = filteredTopComments.length > 0
    ? `\n\nTop comments in this thread (use these to match the community's tone, vocabulary and style):\n${filteredTopComments.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const postBody = post.selftext?.trim()
    ? `\n\nPost body:\n${post.selftext.slice(0, 800)}`
    : "";

  // During the personality test, the persona fully replaces the tone selector.
  const toneInstruction = !personality && tone
    ? `TONE (this overrides the default casual voice where they conflict — apply these tones throughout):
- The requested tone(s): ${tone}.
- Let these shape your word choice, reaction, and what you choose to say. A comment can still be short and casual AND ${tone}.
- "Empathetic" means acknowledge feelings, relate, validate — don't jump to advice.
- "Informative" means add a genuine useful fact or insight, but only if the post invites it.
- "Supportive" means encourage or reassure, not lecture.
- "Casual/Witty/Humorous" means lighter, funnier, more laid-back — match that energy.\n\n`
    : "";

  const customInstruction = customPrompt ? `\nAdditional instruction: ${customPrompt}` : "";
  const avoidInstruction = previousComments && previousComments.length > 0
    ? `\n\nIMPORTANT — These comments have already been posted on this thread by other users of our tool. Do NOT copy their structure, opening words, sentence patterns, or ideas. Write something distinctly different:\n${previousComments.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  // Collect banned opening words from ALL top comments + previously generated comments
  const allSources = [...topComments, ...(previousComments ?? [])];
  const bannedStarters = [...new Set(
    allSources
      .map(c => c.trim().split(/\s+/).slice(0, 2).join(" "))
      .filter(w => w.length > 0)
  )];
  const bannedStartersInstruction = bannedStarters.length > 0
    ? `- Do not start your comment with any of these words or phrases (they're already used in this thread): ${bannedStarters.map(w => `"${w}"`).join(", ")}.\n`
    : "";

  // Persona goes first so the model anchors on "who am I" before reading the
  // general defaults. Persona explicitly wins on register / sentence length /
  // slang / capitalization; the section below is just the fallback for things
  // the persona doesn't pin down.
  const personalityBlock = personality
    ? `${renderPersonalityPrompt(personality)}\n\n`
    : "";

  const prompt = `${personalityBlock}You're scrolling r/${post.subreddit} and you decide to leave one quick comment on the post below.

Post title: ${post.title}${postBody}${commentsContext}

${toneInstruction}First, read the post and match what it actually wants:
- Vent or rant → empathy or a "same", not advice.
- Story or experience → a reaction or follow-up question, not advice.
- Question → an answer.
- Help / advice request → an answer, but only if you have a real one.
- If the post already names the cause of the problem, don't repeat the cause as if it's a fix.
- Don't speak more casually than the post itself. A careful, detailed post deserves a careful reply.

General defaults (your persona's rules override these wherever they conflict):

LENGTH
- Most comments are 1–3 sentences. Go longer only if the post genuinely needs it.
- Don't end with a wrap-up or summary sentence. Stop when you've said the thing.

VOICE
- Type-and-hit-reply, not type-and-polish. Also not type-and-perform-being-messy.
- Use everyday contractions where they sound natural (don't, it's, you're, that's, can't).
- At most one slang hedge per comment, often none. Don't stack tbh, ngl, lol, kinda, fr, lowkey, imo. Pick zero or one and move on.
- A missed comma, a fragment, a casual run-on is fine when it'd happen naturally — not as a tic you sprinkle on top.
- Voice-note typed out, not an essay.
- Vary opener, length, and angle every single time. Different people read the same post very differently.

WHAT REAL PEOPLE DON'T DO
- Don't write a closing summary ("So basically…", "Bottom line…", "In the end…").
- Don't structure your comment as numbered points or first/second/finally.
- Don't use neat transition words: That said, However, Additionally, Furthermore, Moreover, Therefore, In conclusion.
- Don't write balanced parallel structures: "not just X, but Y", "on one hand… on the other".
- Don't make three points in parallel. One point, maybe a second, then stop.
- Don't write a complete, fully-argued case. Real comments often start mid-thought or stop before the obvious conclusion.

HARD BANS
- No bold, italic, bullets, numbered lists, headers, hashtags.
- No em dashes (—), no en dashes (–), no semicolons (;).
- Don't open with "I think you should", "I would recommend", "I'd suggest", or any other advice-template opener. Starting with "I" otherwise is fine ("I had this same thing", "I went through this last year").
${bannedStartersInstruction}- Avoid these AI tells: certainly, absolutely, great question, I'd be happy to, of course, indeed, it's worth noting, it's important to, comprehensive, delve, foster, utilize, leverage, in conclusion, fascinating, wonderful, crucial, ensure, moreover, furthermore, however.

Output only the comment text. No quotes. Nothing else.${customInstruction}${avoidInstruction}`;

  if (process.env.PERSONALITY_DEBUG === "true") {
    console.log("\n────── personality-debug: final prompt ──────");
    console.log(prompt);
    console.log("────── end prompt ──────\n");
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: personality?.temperature ?? 0.92,
  });

  const rawText = response.choices[0]?.message?.content?.trim() ?? "";
  if (!rawText) throw new Error("OpenAI returned empty response");

  // 1. Strip the hard-banned punctuation the model still occasionally produces.
  // 2. Apply gentle human-like noise (with persona-aware gating).
  const allowsCasualNoise = personality?.allowsCasualNoise ?? true;
  return applyHumanNoise(stripDashes(rawText), allowsCasualNoise);
}
