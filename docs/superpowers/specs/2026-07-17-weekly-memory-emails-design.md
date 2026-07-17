# Weekly Memory Emails — Design Spec

**Date:** 2026-07-17  
**Status:** Approved

## Overview

A standalone Next.js app that prompts the parent every Sunday evening with a form to capture the week's highlights for their two kids (ages 3 and 1). On submission, it composes a structured letter and sends it to a future email address the kids will receive at age 18. Google Photos auto-populates recent photos for selection. Questions rotate from a curated bank supplemented by Claude-generated suggestions.

## Architecture

- **Framework:** Next.js (standalone repo, separate from dinner-planner)
- **Hosting:** Vercel (free hobby tier)
- **Database & Auth:** Supabase (new project, single-user auth — parent only)
- **Email sending:** Resend (free tier: 3,000 emails/month)
- **Photos:** Google Photos API (OAuth, refresh token stored encrypted in Supabase)
- **AI:** Claude API for question generation and light email composition (~$0.01/week)
- **Scheduler:** Vercel Cron Job — fires every Sunday at 2am UTC (8pm CT)

## Data Model

### `questions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| text | text | The question text |
| theme | enum | milestone, funny, feelings, routines, gratitude |
| times_used | int | default 0 |
| last_used_at | timestamptz | null until first use |
| source | enum | manual, claude |
| active | bool | default true |

### `weekly_entries`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| week_of | date | Sunday of that week |
| answers | jsonb | Map of question_id → answer text |
| photo_urls | text[] | Permanent attachment URLs |
| sent_at | timestamptz | null until sent |
| email_preview | text | Composed HTML stored for reference |

### `claude_suggestions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| text | text | Suggested question |
| generated_at | timestamptz | |
| promoted | bool | true if added to question bank |

### `config`
Single row containing: children's names, children's email addresses (future), parent's email address, kids' birthdays, timezone.

## Weekly Flow

### Sunday 8pm CT (cron fires)
1. Pull 3 questions from `questions` bank — oldest `last_used_at` first, no repeated `theme` back-to-back
2. Ask Claude to generate 2 fresh suggestions based on: current season, kids' current ages, last 4 weeks of themes used
3. Bundle all 5 into the week's form entry in `weekly_entries`
4. Send parent a reminder email with a unique one-click link to the form

### Parent fills out the form
1. Google Photos picker auto-loads photos from the past 7 days — parent selects 1-3
   - Fallback: manual Google Photos share URL input
2. Parent answers 3-5 questions
3. Claude-generated questions show an "Add to my bank" button — clicking promotes to `questions` table
4. Parent clicks "Preview" — sees composed email
5. Parent can edit inline, then clicks "Send"

### On send
1. Claude composes answers into a flowing letter (preserving parent's voice)
2. Selected photos are downloaded and attached directly (not linked)
3. Email sent to both kids' future addresses via Resend
4. `weekly_entries.sent_at` stamped, `email_preview` stored
5. Used question `last_used_at` updated

## Email Format

```
Subject: Week of [Month DD, YYYY] — from Dad

📅 This week
[Composed answer]

💛 What I love about you both right now
[Composed answer]

[Additional question answers with small headings]

📷 This week in photos
[1-3 inline attached photos]

Love, Dad
```

Plain HTML — no heavy styling, maximally readable across email clients and decades.

## Question Management

A simple `/questions` admin page (auth-gated) lets the parent:
- View all questions with usage stats
- Add new questions manually
- Edit or disable existing questions
- See Claude suggestions history

## Error Handling

| Scenario | Behavior |
|---|---|
| Parent misses a week | Cron fires again next Sunday — no catch-up, no notification |
| Google Photos token expires | Form falls back to manual URL input; banner prompts reconnect |
| Resend delivery failure | Logged in Supabase; parent notified via fallback email |
| Claude API unavailable | Form loads with 3 bank questions only — no hard failure |

## Out of Scope

- Multiple parent accounts
- Kids having separate emails (combined letter only)
- Mobile app
- Catch-up / retroactive entries
