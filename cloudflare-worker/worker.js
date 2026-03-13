/**
 * ReSurge Reddit Proxy — Cloudflare Worker
 *
 * Routes:
 *   GET /new?subs=sub1+sub2&limit=100   → r/sub1+sub2/new.json
 *   GET /info?ids=t3_abc,t3_def          → api/info.json?id=...
 *
 * Set WORKER_SECRET as a Worker env var in the Cloudflare dashboard,
 * and the same value as REDDIT_PROXY_SECRET in Railway.
 */
export default {
  async fetch(request, env) {
    // Secret check — prevents public abuse of the worker
    const secret = request.headers.get("X-Worker-Secret");
    if (env.WORKER_SECRET && secret !== env.WORKER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    let redditUrl;

    if (path === "/new") {
      const subs = params.get("subs");
      const limit = params.get("limit") || "100";
      if (!subs) return new Response("Missing subs param", { status: 400 });
      redditUrl = `https://www.reddit.com/r/${subs}/new.json?limit=${limit}`;
    } else if (path === "/info") {
      const ids = params.get("ids");
      if (!ids) return new Response("Missing ids param", { status: 400 });
      redditUrl = `https://www.reddit.com/api/info.json?id=${ids}`;
    } else {
      return new Response("Not found", { status: 404 });
    }

    const res = await fetch(redditUrl, {
      headers: {
        "User-Agent": "ReSurge/1.0 (internal tool)",
        "Accept": "application/json",
      },
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};
