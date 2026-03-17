const BASE = "/api";

async function req(method: string, path: string, body?: any) {
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
  getSubreddits:    ()                    => req("GET",    "/subreddits"),
  addSubreddit:     (name: string)        => req("POST",   "/subreddits", { name }),
  removeSubreddit:  (name: string)        => req("DELETE", `/subreddits/${name}`),

  // Posts
  getStackPosts:    (sub: string, stack: number) => req("GET", `/posts/${sub}/stack/${stack}`),
  getStack3All:     (sub: string)         => req("GET", `/posts/stack3/all${sub ? `?subreddit=${sub}` : ""}`),
  getStackCounts:   (sub: string)         => req("GET", `/posts/${sub}/counts`),
  getPostHistory:   (sub: string)         => req("GET", `/posts/${sub}/history`),
  getAllHistory:     ()                    => req("GET", `/posts/history/all`),
  dismissPost:      (id: any)             => req("DELETE", `/posts/${id}/dismiss`),

  // Comments
  generateComment:  (id: any)             => req("POST",   `/posts/${id}/generate-comment`),

  // Thresholds (per-subreddit)
  getThresholds:      (sub: string)              => req("GET",  `/thresholds${sub ? `?subreddit=${encodeURIComponent(sub)}` : ""}`),
  saveThresholds:     (sub: string, data: any)   => req("PUT",  `/thresholds${sub ? `?subreddit=${encodeURIComponent(sub)}` : ""}`, data),
  getThresholdEdits:    (sub: string)  => req("GET",  `/thresholds/edits${sub ? `?subreddit=${encodeURIComponent(sub)}` : ""}`),
  getAllThresholdEdits: ()            => req("GET",  `/thresholds/edits/all`),
  saveThresholdEdit:   (data: any)   => req("POST", `/thresholds/edits`, data),
};
