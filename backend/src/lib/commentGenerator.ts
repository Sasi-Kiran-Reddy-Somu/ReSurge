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

// Strip em-dashes and en-dashes the model still slips in despite explicit bans.
// Em-dashes are one of the strongest AI tells in casual text. Replace with a
// comma (most contextually neutral substitute) or period if surrounded by spaces.
function stripDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, ", ")  // " — " or " – " → ", "
    .replace(/[—–]/g, "-");        // any remaining standalone em/en → hyphen
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

  // Personality block goes FIRST so the model reads "who am I" before the
  // style rules. The persona shapes *what* this person says; the rules below
  // shape *how it reads on Reddit* (sloppy, casual, contractions, etc.).
  // Both apply together — persona is the voice, rules are the medium.
  const personalityBlock = personality
    ? `${renderPersonalityPrompt(personality)}\n\n`
    : "";

  const prompt = `${personalityBlock}You are a regular American Reddit user casually scrolling r/${post.subreddit} and leaving a quick comment. Write ONE comment replying to the post below.

Post title: ${post.title}${postBody}${commentsContext}

${toneInstruction}UNDERSTAND THE POST BEFORE YOU WRITE:
- First figure out what kind of post this is: (a) asking for help or advice, (b) sharing a story or experience, (c) asking a question, (d) venting or ranting.
- If the post is sharing a story or experience (NOT asking for help), react to what they said — relate, sympathize, express surprise, ask a follow-up — do NOT give advice or solutions they didn't ask for.
- If the post already mentions the cause or resolution of a problem, do NOT suggest causes or fixes — they already know. React to what they discovered instead.
- Match your comment type to the post type. A vent gets empathy. A story gets a reaction. A question gets an answer. A help request gets advice.

Your comment must pass AI detection as 100% human-written. To achieve this, follow every rule below without exception:

LENGTH & STRUCTURE:
- Keep it short. Most good Reddit comments are 1–3 sentences. Only go longer if the post genuinely requires it.
- Never pad. Say the one thing you need to say and stop. No buildup, no filler, no conclusion.
- No structure. Just a raw reaction, quick take, or short question.
- Fragments are fine. Incomplete sentences are fine. That's how people text.

LANGUAGE & VOICE:
- Write exactly like a real American types casually online. Sloppy is good.
- Use contractions always: don't, it's, tbh, ngl, idk, lol, kinda, gonna, wanna, lowkey, fr, rn, tho, bc, cuz, prolly, tbf. (If your persona is older/formal, still use everyday contractions like don't, it's, you're — just skip the slang.)
- Minor grammar imperfections are expected and required — don't correct them. Things like "me and my friend" instead of "my friend and I", missing commas, run-ons, etc.
- Vary capitalization naturally — don't capitalize everything perfectly. Lowercase is fine.
- No punctuation at the end sometimes. Or just use … or lol as an ending.

SOUND LIKE A LOCAL AMERICAN (this is critical):
- Think of how a regular American talks in their daily life — not formal, not trying to impress anyone, just natural and unfiltered.
- Real Americans cut words short, skip words, trail off, use filler words mid-sentence, and don't always finish their thought cleanly.
- Imperfect sentence structure is a feature, not a bug — run-ons, comma splices, missing subjects, sentences that just end mid-thought are all fine.
- It should read like a text message or a voice note typed out, not a written response.
- IMPORTANT: Do NOT reuse fixed phrases or templates. Every comment must feel like a different person reacting differently — vary your word choice, sentence length, entry point, and reaction style every single time. The same post can get wildly different genuine reactions from different people.

WHAT TO AVOID (strictly):
- Never sound polished, structured, or complete.
- No bold, italic, bullet points, numbered lists, headers.
- No em dashes (—) and no en dashes (–). Use commas or just start a new sentence.
- No semicolons (;). Use a period or a comma.
- No hashtags.
- Don't start with "I".
${bannedStartersInstruction}- Never use these AI giveaway words/phrases: certainly, absolutely, great question, I'd be happy to, of course, indeed, it's worth noting, it's important to, comprehensive, delve, foster, utilize, leverage, in conclusion, fascinating, wonderful, crucial, ensure, moreover, furthermore, however.
- Don't try hard to sound casual — just BE casual.
- Don't pad it out. Say the thing and stop.

Output only the comment text. Nothing else. No quotes around it.${customInstruction}${avoidInstruction}`;

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

  // Belt + suspenders: strip any em-dashes the model snuck through.
  return stripDashes(rawText);
}
