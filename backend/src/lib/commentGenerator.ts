import OpenAI from "openai";

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

export async function generateComment(post: {
  id: string;
  redditId: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
}, tone?: string, customPrompt?: string, previousComments?: string[]): Promise<string> {
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

  const toneInstruction = tone ? `- Write in a ${tone} tone.\n` : "";
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

  const prompt = `You are a regular American Reddit user casually scrolling r/${post.subreddit} and leaving a quick comment. Write ONE comment replying to the post below.

Post title: ${post.title}${postBody}${commentsContext}

Your comment must pass AI detection as 100% human-written. To achieve this, follow every rule below without exception:

LENGTH & STRUCTURE:
- Keep it short. Most good Reddit comments are 1–3 sentences. Only go longer if the post genuinely requires it.
- Never pad. Say the one thing you need to say and stop. No buildup, no filler, no conclusion.
- No structure. Just a raw reaction, quick take, or short question.
- Fragments are fine. Incomplete sentences are fine. That's how people text.

LANGUAGE & VOICE:
- Write exactly like a real American types casually online. Sloppy is good.
- Use contractions always: don't, it's, tbh, ngl, idk, lol, kinda, gonna, wanna, lowkey, fr, rn, tho, bc, cuz, prolly, tbf.
- Minor grammar imperfections are expected and required — don't correct them. Things like "me and my friend" instead of "my friend and I", missing commas, run-ons, etc.
- Vary capitalization naturally — don't capitalize everything perfectly. Lowercase is fine.
- No punctuation at the end sometimes. Or just use … or lol as an ending.
${toneInstruction}
WHAT TO AVOID (strictly):
- Never sound polished, structured, or complete.
- No bold, italic, bullet points, numbered lists, headers.
- No em dashes (—). Use commas or just start a new sentence.
- No hashtags.
- Don't start with "I".
${bannedStartersInstruction}- Never use these AI giveaway words/phrases: certainly, absolutely, great question, I'd be happy to, of course, indeed, it's worth noting, it's important to, comprehensive, delve, foster, utilize, leverage, in conclusion, fascinating, wonderful, crucial, ensure, moreover, furthermore, however.
- Don't try hard to sound casual — just BE casual.
- Don't pad it out. Say the thing and stop.

Output only the comment text. Nothing else. No quotes around it.${customInstruction}${avoidInstruction}`;

  const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 300,
  });

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}
