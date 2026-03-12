// ─────────────────────────────────────────────
//  Shared Types
// ─────────────────────────────────────────────

export type Stack = 1 | 2 | 3;

export interface Post {
  id: string;
  redditId: string;
  subreddit: string;
  title: string;
  url: string;
  author: string;
  selftext: string;
  upvotes: number;
  comments: number;
  engagement: number;
  createdAt: number;        // unix ms — when posted on Reddit
  stack: Stack;
  stackEnteredAt: number;   // unix ms — when moved to current stack
  engAtStackEntry: number;  // engagement score when entering current stack
  lastGrowth: number | null;
  alertedAt: number | null;
  discarded: boolean;
}

export interface Subreddit {
  id: string;
  name: string;
  addedAt: number;
  isActive: boolean;
}

export interface Thresholds {
  s1MinAge:    number;   // minutes post must be old before S1 check
  s1MinEng:    number;   // absolute engagement to pass S1 → S2
  s2EvalStart: number;   // minutes in S2 before evaluation window opens
  s2EvalEnd:   number;   // minutes in S2 when evaluation window closes (discard if not promoted)
  s2GrowthPct: number;   // % growth during window to pass S2 → S3 (alert)
}

export interface RedditPost {
  id: string;
  title: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  author: string;
  selftext: string;
  subreddit?: string;
}

export type AppEnv = {
  Variables: {
    userId: string;
    userRole: string;
  };
};

export interface PollJobData {
  // global job — no per-subreddit data needed
}

export interface StackCounts {
  s1: number;
  s2: number;
  s3: number;
}
