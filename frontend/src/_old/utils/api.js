const BASE = "/api";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export const api = {
  // Subreddits
  getSubreddits:    ()           => req("GET",    "/subreddits"),
  addSubreddit:     (name)       => req("POST",   "/subreddits", { name }),
  removeSubreddit:  (name)       => req("DELETE", `/subreddits/${name}`),

  // Posts
  getStackPosts:    (sub, stack) => req("GET", `/posts/${sub}/stack/${stack}`),
  getStack4All:     (sub)        => req("GET", `/posts/stack4/all${sub ? `?subreddit=${sub}` : ""}`),
  getStackCounts:   (sub)        => req("GET", `/posts/${sub}/counts`),
  getPostHistory:   (sub)        => req("GET", `/posts/${sub}/history`),
  getAllHistory:     ()           => req("GET", `/posts/history/all`),
  dismissPost:      (id)         => req("DELETE", `/posts/${id}/dismiss`),

  // Comments
  generateComment:  (id)         => req("POST",   `/posts/${id}/generate-comment`),

  // Thresholds (per-subreddit)
  getThresholds:    (sub)        => req("GET",  `/thresholds${sub ? `?subreddit=${encodeURIComponent(sub)}` : ""}`),
  saveThresholds:   (sub, data)  => req("PUT",  `/thresholds${sub ? `?subreddit=${encodeURIComponent(sub)}` : ""}`, data),
};
