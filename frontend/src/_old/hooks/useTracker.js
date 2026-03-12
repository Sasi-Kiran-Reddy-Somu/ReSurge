import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../utils/api.js";

const DEFAULT_THRESHOLDS = {
  s1MinAge: 10, s1MinEng: 20,
  s2MinAge: 7,  s2GrowthPct: 30,
  s3MinAge: 7,  s3GrowthPct: 50,
};

export function useTracker() {
  const [subreddits,   setSubreddits]   = useState([]);
  const [activeTab,    setActiveTab]    = useState("");
  const [thresholds,   setThresholds]   = useState(DEFAULT_THRESHOLDS);
  const [stack4Feed,   setStack4Feed]   = useState([]);
  const [stackCounts,  setStackCounts]  = useState({ s1:0, s2:0, s3:0, s4:0 });
  const [modalPosts,   setModalPosts]   = useState(null); // { stack, posts }
  const [countdown,    setCountdown]    = useState(60);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const activeTabRef  = useRef(activeTab);
  const threshRef     = useRef(thresholds);
  useEffect(() => { activeTabRef.current = activeTab; },   [activeTab]);
  useEffect(() => { threshRef.current    = thresholds; },  [thresholds]);

  // ── Initial load ───────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const subs = await api.getSubreddits();
        setSubreddits(subs);
        const firstSub = subs.length > 0 ? subs[0].name : null;
        if (firstSub) {
          setActiveTab(firstSub);
          const thresh = await api.getThresholds(firstSub).catch(() => DEFAULT_THRESHOLDS);
          setThresholds(thresh);
        }
      } catch (e) {
        setError("Cannot connect to backend. Is the server running?");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ── Refresh data for active tab ────────────────────────────
  const refreshActive = useCallback(async (tab) => {
    const sub = tab ?? activeTabRef.current;
    if (!sub) return;
    try {
      const [counts, s4] = await Promise.all([
        api.getStackCounts(sub),
        api.getStack4All(sub),
      ]);
      setStackCounts(counts);
      setStack4Feed(s4);
      setLastRefresh(new Date());
    } catch {
      // Silently fail on poll refresh
    }
  }, []);

  // ── Auto-refresh every 15 seconds ─────────────────────────
  useEffect(() => {
    if (!activeTab) return;
    refreshActive(activeTab);

    const interval = setInterval(() => refreshActive(activeTab), 15_000);
    const cdInterval = setInterval(() => {
      setCountdown(c => c <= 1 ? 15 : c - 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(cdInterval);
    };
  }, [activeTab, refreshActive]);

  // ── Tab switch ─────────────────────────────────────────────
  const switchTab = useCallback((name) => {
    setActiveTab(name);
    setStackCounts({ s1:0, s2:0, s3:0, s4:0 });
    setStack4Feed([]);
    setCountdown(15);
    refreshActive(name);
    // Load thresholds for the new subreddit
    api.getThresholds(name).then(setThresholds).catch(() => {});
  }, [refreshActive]);

  // ── Add subreddit ──────────────────────────────────────────
  const addSubreddit = useCallback(async (name) => {
    const clean = name.replace(/^r\//, "").trim().toLowerCase();
    if (!clean) throw new Error("Name required");
    const added = await api.addSubreddit(clean);
    setSubreddits(prev => [...prev, added]);
    switchTab(clean);
    return added;
  }, [switchTab]);

  // ── Remove subreddit ───────────────────────────────────────
  const removeSubreddit = useCallback(async (name) => {
    await api.removeSubreddit(name);
    setSubreddits(prev => {
      const next = prev.filter(s => s.name !== name);
      if (activeTabRef.current === name && next.length > 0) {
        switchTab(next[0].name);
      }
      return next;
    });
  }, [switchTab]);

  // ── Save thresholds (for current active subreddit) ─────────
  const saveThresholds = useCallback(async (updated) => {
    const saved = await api.saveThresholds(activeTabRef.current, updated);
    setThresholds(saved);
  }, []);

  // ── Open stack modal ───────────────────────────────────────
  const openStackModal = useCallback(async (stack) => {
    if (!activeTabRef.current) return;
    const posts = await api.getStackPosts(activeTabRef.current, stack);
    setModalPosts({ stack, posts });
  }, []);

  const closeModal = useCallback(() => setModalPosts(null), []);

  // ── Dismiss stack 4 post ───────────────────────────────────
  const dismissPost = useCallback(async (id) => {
    await api.dismissPost(id);
    setStack4Feed(prev => prev.filter(p => p.id !== id));
  }, []);

  return {
    subreddits, activeTab, switchTab,
    thresholds, saveThresholds,
    stack4Feed, stackCounts,
    modalPosts, openStackModal, closeModal,
    addSubreddit, removeSubreddit,
    dismissPost,
    countdown, lastRefresh,
    loading, error,
  };
}
