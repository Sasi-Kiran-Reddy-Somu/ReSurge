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
  const filteredTopComments = previousComments && previousComments.length > 0
    ? topComments.filter(c => !previousComments.some(p => c.trim().slice(0, 40) === p.trim().slice(0, 40)))
    : topComments;
  const commentsContext = filteredTopComments.length > 0
    ? `\n\nTop comments in this thread (for community/topic context — do NOT copy their voice if it conflicts with your persona):\n${filteredTopComments.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const postBody = post.selftext?.trim()
    ? `\n\nPost body:\n${post.selftext.slice(0, 800)}`
    : "";

  // During the personality test, the persona fully replaces the tone selector.
  // Tone is silently ignored when a personality is provided so the test signal
  // isn't muddied by overlapping voice controls.
  const toneInstruction = !personality && tone
    ? `TONE (this overrides the default casual voice where they conflict — apply these tones throughout):
- The requested tone(s): ${tone}.
- Let these shape your word choice, reaction, and what you choose to say.
- "Empathetic" means acknowledge feelings, relate, validate — don't jump to advice.
- "Informative" means add a genuine useful fact or insight, but only if the post invites it.
- "Supportive" means encourage or reassure, not lecture.
- "Casual/Witty/Humorous" means lighter, funnier, more laid-back — match that energy.\n\n`
    : "";

  const customInstruction = customPrompt ? `\nAdditional instruction: ${customPrompt}` : "";
  const avoidInstruction = previousComments && previousComments.length > 0
    ? `\n\nIMPORTANT — These comments have already been posted on this thread by other users of our tool. Do NOT copy their structure, opening words, sentence patterns, or ideas. Write something distinctly different:\n${previousComments.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const allSources = [...topComments, ...(previousComments ?? [])];
  const bannedStarters = [...new Set(
    allSources
      .map(c => c.trim().split(/\s+/).slice(0, 2).join(" "))
      .filter(w => w.length > 0)
  )];
  const bannedStartersInstruction = bannedStarters.length > 0
    ? `- Do not start your comment with any of these words or phrases (they're already used in this thread): ${bannedStarters.map(w => `"${w}"`).join(", ")}.\n`
    : "";

  const personalityBlock = personality
    ? `${renderPersonalityPrompt(personality)}\n\n`
    : "";

  const prompt = `${personalityBlock}You are leaving a quick Reddit comment on r/${post.subreddit}. Write ONE comment replying to the post below.

Post title: ${post.title}${postBody}${commentsContext}

${toneInstruction}UNDERSTAND THE POST BEFORE YOU WRITE:
- First figure out what kind of post this is: (a) asking for help or advice, (b) sharing a story or experience, (c) asking a question, (d) venting or ranting.
- If the post is sharing a story or experience (NOT asking for help), react to what they said — relate, sympathize, express surprise, ask a follow-up — do NOT give advice or solutions they didn't ask for.
- If the post already mentions the cause or resolution of a problem, do NOT suggest causes or fixes — they already know. React to what they discovered instead.
- Match your comment type to the post type. A vent gets empathy. A story gets a reaction. A question gets an answer. A help request gets advice.

Your comment must read as 100% human-written. Follow every rule below without exception.

${personality ? "PERSONA RULES OVERRIDE ANY GENERIC RULE BELOW WHERE THEY CONFLICT.\n\n" : ""}LENGTH & STRUCTURE:
- Keep it short unless your persona explicitly says otherwise. Most good Reddit comments are 1–3 sentences.
- Never pad. Say the one thing you need to say and stop.
- No structure (no bullets, no headers).
- Fragments are fine.

LANGUAGE & VOICE:
- Minor grammar imperfections are fine if they fit your persona.
- Vary capitalization per your persona — don't default to perfect sentence case unless your persona requires it.
- Punctuation at the end is optional per your persona.

WHAT TO AVOID (strictly, unless your persona overrides):
- No bold, italic, bullet points, numbered lists, headers.
- No hashtags.
- Don't start with "I" (capital).
${bannedStartersInstruction}- Never use these AI giveaway words/phrases: certainly, absolutely, great question, I'd be happy to, of course, indeed, it's worth noting, it's important to, comprehensive, delve, foster, utilize, leverage, in conclusion, fascinating, wonderful, crucial, ensure, moreover, furthermore, however.
- Don't pad it out. Say the thing and stop.

Output only the comment text. Nothing else. No quotes around it.${customInstruction}${avoidInstruction}`;

  // Log the final prompt for the first few calls so we can verify the
  // personality is actually reaching the model. Controlled via env to avoid
  // noisy logs in production.
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

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}
