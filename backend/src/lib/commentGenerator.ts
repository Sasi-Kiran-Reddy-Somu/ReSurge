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
      .slice(0, 8);
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
  const commentsContext = topComments.length > 0
    ? `\n\nTop comments in this thread (use these to match the community's tone, vocabulary and style):\n${topComments.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const postBody = post.selftext?.trim()
    ? `\n\nPost body:\n${post.selftext.slice(0, 800)}`
    : "";

  const toneInstruction = tone ? `- Write in a ${tone} tone.\n` : "";
  const customInstruction = customPrompt ? `\nAdditional instruction: ${customPrompt}` : "";
  const avoidInstruction = previousComments && previousComments.length > 0
    ? `\n\nIMPORTANT — These comments have already been posted on this thread by other users of our tool. Do NOT copy their structure, opening words, sentence patterns, or ideas. Write something distinctly different:\n${previousComments.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const prompt = `You are a regular Reddit user in r/${post.subreddit}. Write ONE comment replying to the post below.

Post title: ${post.title}${postBody}${commentsContext}

Rules — follow every single one:
- Sound like a real human, not AI. Write how people actually talk on Reddit.
- Match the tone, vocabulary, and energy of the existing comments and subreddit.
${toneInstruction}- Add genuine value: a useful insight, experience, question, or opinion that fits the conversation.
- Use natural shortcuts and casual language: gonna, tbh, ngl, imo, lol, idk, bc, cuz, rn, kinda, tbf, fr, etc. — but only where they feel natural, don't force them.
- Vary your sentence length. Mix short punchy lines with slightly longer ones.
- No bold text. No italic text. No bullet points. No numbered lists. No headers.
- No em dashes (—). Use commas or just start a new sentence instead.
- No hashtags.
- Don't start with "I".
- Never use AI giveaway words: certainly, absolutely, great question, I'd be happy to, of course, indeed, it's worth noting, it's important to, comprehensive, delve, foster, utilize, leverage, in conclusion.
- Don't sound like you're trying too hard to be casual — just be natural.
- Keep it concise: 2-4 sentences is usually enough. Don't pad it out.
- Output only the comment text. Nothing else.${customInstruction}${avoidInstruction}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.92,
    max_tokens: 300,
  });

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}
