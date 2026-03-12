import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  real,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

// ─── subreddits ────────────────────────────────────────────────
export const subreddits = pgTable("subreddits", {
  id:               uuid("id").primaryKey().defaultRandom(),
  name:             text("name").notNull().unique(),
  isActive:         boolean("is_active").notNull().default(true),
  visibleToHolders: boolean("visible_to_holders").notNull().default(true),
  addedAt:          timestamp("added_at").notNull().defaultNow(),
});

// ─── posts ─────────────────────────────────────────────────────
export const posts = pgTable("posts", {
  id:              uuid("id").primaryKey().defaultRandom(),
  redditId:        text("reddit_id").notNull().unique(),
  subreddit:       text("subreddit").notNull(),
  title:           text("title").notNull(),
  url:             text("url").notNull(),
  author:          text("author").notNull().default(""),
  selftext:        text("selftext").notNull().default(""),

  upvotes:         integer("upvotes").notNull().default(0),
  comments:        integer("comments").notNull().default(0),
  engagement:      integer("engagement").notNull().default(0),

  // unix ms timestamps
  redditCreatedAt: bigint("reddit_created_at", { mode: "number" }).notNull(),
  stackEnteredAt:  bigint("stack_entered_at",  { mode: "number" }).notNull(),

  stack:           integer("stack").notNull().default(1),  // 1 | 2 | 3
  engAtStackEntry: integer("eng_at_stack_entry").notNull().default(0),
  engAtEvalStart:  integer("eng_at_eval_start"),  // snapshot recorded when s2EvalStart is crossed
  lastGrowth:      real("last_growth"),
  alertedAt:       bigint("alerted_at",        { mode: "number" }),
  discarded:       boolean("discarded").notNull().default(false),

  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  subredditIdx:    index("posts_subreddit_idx").on(t.subreddit),
  stackIdx:        index("posts_stack_idx").on(t.stack),
  discardedIdx:    index("posts_discarded_idx").on(t.discarded),
}));

// ─── thresholds (per-subreddit; subreddit=null means global default) ──
export const thresholds = pgTable("thresholds", {
  id:           uuid("id").primaryKey().defaultRandom(),
  subreddit:    text("subreddit"),               // null = global default
  s1MinAge:     integer("s1_min_age").notNull().default(10),
  s1MinEng:     integer("s1_min_eng").notNull().default(20),
  s2EvalStart:  integer("s2_eval_start").notNull().default(7),   // min minutes before eval begins
  s2EvalEnd:    integer("s2_eval_end").notNull().default(14),    // max minutes — eval window closes
  s2GrowthPct:  real("s2_growth_pct").notNull().default(30),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

// ─── generated_comments ───────────────────────────────────────
export const generatedComments = pgTable("generated_comments", {
  id:           uuid("id").primaryKey().defaultRandom(),
  postId:       text("post_id").notNull(),
  provider:     text("provider").notNull(),  // "claude" | "openai"
  suggestions:  text("suggestions").notNull(), // JSON string
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

// ─── users ─────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name:         text("name").notNull(),
  role:               text("role").notNull(), // primary/display role
  roles:              text("roles").array().notNull().default([]), // all roles this account can use
  phone:              text("phone"),
  adminAcknowledged:  boolean("admin_acknowledged").notNull().default(true), // false for self-signups until admin views
  createdAt:          timestamp("created_at").notNull().defaultNow(),
});

// ─── holder_accounts (email/reddit accounts a holder manages) ──
export const holderAccounts = pgTable("holder_accounts", {
  id:             uuid("id").primaryKey().defaultRandom(),
  holderId:       uuid("holder_id").notNull(),
  emailAddress:   text("email_address").notNull(),
  redditUsername: text("reddit_username"),
  notes:          text("notes"),
  subreddits:     text("subreddits").array().notNull().default([]),
  addedAt:        timestamp("added_at").notNull().defaultNow(),
});

// ─── user_subreddits (holder subscriptions) ────────────────────
export const userSubreddits = pgTable("user_subreddits", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull(),
  subreddit: text("subreddit").notNull(),
  joinedAt:  timestamp("joined_at").notNull().defaultNow(),
});

// ─── monitor_assignments ───────────────────────────────────────
export const monitorAssignments = pgTable("monitor_assignments", {
  id:         uuid("id").primaryKey().defaultRandom(),
  monitorId:  uuid("monitor_id").notNull(),
  holderId:   uuid("holder_id").notNull(),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

// ─── notifications ─────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull(),
  postId:     text("post_id").notNull(),
  subreddit:  text("subreddit").notNull(),
  postTitle:  text("post_title").notNull(),
  postUrl:    text("post_url").notNull(),
  accountId:  uuid("account_id"),
  sentAt:     timestamp("sent_at").notNull().defaultNow(),
  openedAt:   timestamp("opened_at"),
  status:     text("status").notNull().default("sent"), // "sent"|"opened"|"done"|"posted"
  postedLink: text("posted_link"),
  postedAt:   timestamp("posted_at"),
});

export type DbSubreddit          = typeof subreddits.$inferSelect;
export type DbPost               = typeof posts.$inferSelect;
export type DbThresholds         = typeof thresholds.$inferSelect;
export type DbGeneratedComment   = typeof generatedComments.$inferSelect;
export type DbUser               = typeof users.$inferSelect;
export type DbNotification       = typeof notifications.$inferSelect;
