import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../utils/api";

const DEFAULT_THRESHOLDS = {
  s1MinAge: 10, s1MinEng: 20,
  s2EvalStart: 7, s2EvalEnd: 14, s2GrowthPct: 30,
};

export function useTracker() {
  const [subreddits,   setSubreddits]   = useState<any[]>([]);
  const [activeTab,    setActiveTab]    = useState("");
  const [thresholds,   setThresholds]   = useState<any>(DEFAULT_THRESHOLDS);
  const [stack3Feed,   setStack3Feed]   = useState<any[]>([]);
  const [stackCounts,  setStackCounts]  = useState<any>({ s1:0, s2:0, s3:0 });
  const [modalPosts,   setModalPosts]   = useState<any>(null); // { stack, posts }
  const [countdown,    setCountdown]    = useState(15);
  const [lastRefresh,  setLastRefresh]  = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<any>(null);

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
        if (subs.length > 0) {
          const saved = sessionStorage.getItem("tracker_active_tab");
          const tab = (saved && subs.find((s: any) => s.name === saved)) ? saved : subs[0].name;
          setActiveTab(tab);
          sessionStorage.setItem("tracker_active_tab", tab);
          const thresh = await api.getThresholds(tab).catch(() => DEFAULT_THRESHOLDS);
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
  const refreshActive = useCallback(async (tab?: string) => {
    const sub = tab ?? activeTabRef.current;
    if (!sub) return;
    try {
      const [counts, s3] = await Promise.all([
        api.getStackCounts(sub),
        api.getStack3All(sub),
      ]);
      setStackCounts(counts);
      setStack3Feed(s3);
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
  const switchTab = useCallback((name: string) => {
    setActiveTab(name);
    sessionStorage.setItem("tracker_active_tab", name);
    setStackCounts({ s1:0, s2:0, s3:0 });
    setStack3Feed([]);
    setCountdown(15);
    // Reset thresholds immediately so SliderPanel clears dirty state
    // before the async API call responds — prevents bleeding previous
    // subreddit's unsaved modifications into the newly selected tab.
    setThresholds({ ...DEFAULT_THRESHOLDS });
    refreshActive(name);
    api.getThresholds(name)
      .then(setThresholds)
      .catch(() => setThresholds({ ...DEFAULT_THRESHOLDS }));
  }, [refreshActive]);

  // ── Add subreddit ──────────────────────────────────────────
  const addSubreddit = useCallback(async (name: string) => {
    const clean = name.replace(/^r\//, "").trim().toLowerCase();
    if (!clean) throw new Error("Name required");
    const added = await api.addSubreddit(clean);
    setSubreddits(prev => [...prev, added]);
    switchTab(clean);
    return added;
  }, [switchTab]);

  // ── Remove subreddit ───────────────────────────────────────
  const removeSubreddit = useCallback(async (name: string) => {
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
  const saveThresholds = useCallback(async (updated: any) => {
    const saved = await api.saveThresholds(activeTabRef.current, updated);
    setThresholds(saved);
  }, []);

  // ── Open stack modal ───────────────────────────────────────
  const openStackModal = useCallback(async (stack: number) => {
    if (!activeTabRef.current) return;
    const posts = await api.getStackPosts(activeTabRef.current, stack);
    setModalPosts({ stack, posts });
  }, []);

  const closeModal = useCallback(() => setModalPosts(null), []);

  // ── Dismiss stack 3 alert post ─────────────────────────────
  const dismissPost = useCallback(async (id: any) => {
    await api.dismissPost(id);
    setStack3Feed(prev => prev.filter((p: any) => p.id !== id));
  }, []);

  return {
    subreddits, activeTab, switchTab,
    thresholds, saveThresholds,
    stack3Feed, stackCounts,
    modalPosts, openStackModal, closeModal,
    addSubreddit, removeSubreddit,
    dismissPost,
    countdown, lastRefresh,
    loading, error,
  };
}
