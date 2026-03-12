const BASE = "/api";

function getToken() { return localStorage.getItem("token"); }

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export const api = {
  signup:              (data)           => req("POST", "/auth/signup", data),
  login:               (data)           => req("POST", "/auth/login", data),
  getSubreddits:       ()               => req("GET",  "/holder/subreddits"),
  updateSubreddits:    (subreddits)     => req("PUT",  "/holder/subreddits", { subreddits }),
  getNotifications:    ()               => req("GET",  "/holder/notifications"),
  getNotification:     (id)             => req("GET",  `/holder/notifications/${id}`),
  markPosted:          (id, link)       => req("PUT",  `/holder/notifications/${id}/posted`, { postedLink: link }),
  markDone:            (id)             => req("PUT",  `/holder/notifications/${id}/done`),
  generateComment:     (postId)         => req("POST", `/posts/${postId}/generate-comment`),
  getAccounts:         ()               => req("GET",  "/holder/accounts"),
  addAccount:          (data)           => req("POST", "/holder/accounts", data),
  deleteAccount:       (id)             => req("DELETE", `/holder/accounts/${id}`),
};
