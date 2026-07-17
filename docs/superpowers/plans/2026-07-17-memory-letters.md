# Memory Letters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js app that prompts a parent every Sunday at 8pm CT to write a brief memory letter to their kids, pulling recent Google Photos, rotating questions from a curated bank, and emailing the composed letter to the kids' future addresses.

**Architecture:** New GitHub repo (`memory-letters`) under personal account mich.menning@gmail.com, deployed to Vercel. Supabase (new project) handles DB and single-user auth. Vercel Cron fires Sunday 2am UTC → emails parent a form link → parent fills form → Claude composes letter → Resend sends to kids' addresses.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, Supabase (DB + auth), Google Photos REST API + `googleapis` OAuth, Anthropic SDK (`claude-haiku-4-5-20251001`), Resend, Vitest

## Global Constraints

- All routes except `/login` and `/auth/callback` require authenticated session
- Cron route (`/api/cron`) authenticated via `CRON_SECRET` bearer token header, not Supabase auth
- Single-user app — no multi-tenancy, no signup flow
- `claude-haiku-4-5-20251001` only (cost constraint ~$0.01/week)
- Photos must be downloaded and attached to email — never linked
- Plain HTML email only — no CSS frameworks in email templates
- All DB access from server components/routes uses `lib/supabase/server.ts`; browser components use `lib/supabase/client.ts`

---

## File Structure

```
memory-letters/
├── app/
│   ├── layout.tsx                    # Root layout, Tailwind, auth provider
│   ├── page.tsx                      # Redirect to /week/current or /setup
│   ├── login/
│   │   └── page.tsx                  # Magic link login form
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts              # Supabase auth callback handler
│   ├── setup/
│   │   └── page.tsx                  # First-run config (names, emails, birthdays)
│   ├── week/
│   │   └── [id]/
│   │       ├── page.tsx              # Server component: load entry + questions
│   │       └── WeekForm.tsx          # Client component: form, photo picker, preview
│   ├── questions/
│   │   └── page.tsx                  # Question bank admin page
│   └── api/
│       ├── cron/
│       │   └── route.ts              # Sunday cron handler
│       ├── photos/
│       │   ├── auth/
│       │   │   └── route.ts          # Initiate Google OAuth
│       │   ├── callback/
│       │   │   └── route.ts          # Handle OAuth callback + store token
│       │   └── recent/
│       │       └── route.ts          # Fetch recent photos
│       ├── questions/
│       │   └── route.ts              # GET list, POST create, PATCH update
│       ├── suggestions/
│       │   └── [id]/
│       │       └── promote/
│       │           └── route.ts      # Promote Claude suggestion to question bank
│       └── entries/
│           └── [id]/
│               ├── compose/
│               │   └── route.ts      # Claude: compose email from answers
│               └── send/
│                   └── route.ts      # Download photos, send email, stamp sent_at
├── lib/
│   ├── supabase/
│   │   ├── server.ts                 # Server-side Supabase client
│   │   └── client.ts                 # Browser-side Supabase client
│   ├── google-photos.ts              # OAuth URL, token refresh, fetch recent photos
│   ├── claude.ts                     # Generate question suggestions + compose email
│   ├── questions.ts                  # Question selection logic (rotation, theme diversity)
│   └── resend.ts                     # Send reminder email + memory email with attachments
├── components/
│   ├── PhotoPicker.tsx               # Google Photos grid + manual URL fallback
│   ├── QuestionAnswer.tsx            # Single question + textarea + optional "Add to bank" btn
│   └── EmailPreview.tsx              # Rendered preview with inline edit + send button
├── supabase/
│   └── migrations/
│       ├── 001_schema.sql            # All tables + RLS + increment_question_usage fn
│       └── 002_seed_questions.sql    # Initial question bank (~20 questions)
├── middleware.ts                     # Auth guard for all routes except /login /auth
├── vercel.json                       # Cron config
└── .env.local.example               # All required env vars documented
```

---

## Task 1: GitHub repo + Next.js scaffolding

**Files:**
- Create: `memory-letters/` (entire repo)
- Create: `vercel.json`
- Create: `.env.local.example`

**Interfaces:**
- Produces: running Next.js dev server at `localhost:3000`, GitHub repo at `github.com/mich-menning/memory-letters`

- [ ] **Step 1: Verify gh CLI is authenticated with personal account**

```bash
gh auth status
```

If not logged into `mich.menning@gmail.com`, run:
```bash
gh auth login
```
Choose GitHub.com → HTTPS → browser login. Verify the account shown is your personal one (mich.menning@gmail.com).

- [ ] **Step 2: Create GitHub repo**

```bash
gh repo create memory-letters --private --description "Weekly memory letters to my kids" --clone
cd memory-letters
```

- [ ] **Step 3: Scaffold Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

- [ ] **Step 4: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk resend googleapis
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 1 * * 1"
    }
  ]
}
```

(1am UTC Monday = 8pm CDT Sunday. Drifts to 7pm CST in winter — acceptable.)

- [ ] **Step 7: Create .env.local.example**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth (Photos API)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Anthropic
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM_ADDRESS=letters@yourdomain.com

# Vercel Cron auth
CRON_SECRET=
```

Copy it: `cp .env.local.example .env.local`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with dependencies"
git push -u origin main
```

---

## Task 2: Supabase schema + clients

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `supabase/migrations/002_seed_questions.sql`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`

**Interfaces:**
- Produces: `createClient()` from both `lib/supabase/server.ts` (server context) and `lib/supabase/client.ts` (browser context)

- [ ] **Step 1: Create Supabase project**

Manual step: Go to https://supabase.com → New project → name it `memory-letters`. Copy the project URL and anon key into `.env.local`.

Also copy the service role key (Settings → API).

- [ ] **Step 2: Write migration 001_schema.sql**

Create `supabase/migrations/001_schema.sql`:

```sql
create extension if not exists "uuid-ossp";

create type question_theme as enum ('milestone', 'funny', 'feelings', 'routines', 'gratitude');
create type question_source as enum ('manual', 'claude');

create table questions (
  id uuid primary key default uuid_generate_v4(),
  text text not null,
  theme question_theme not null,
  times_used int not null default 0,
  last_used_at timestamptz,
  source question_source not null default 'manual',
  active bool not null default true,
  created_at timestamptz not null default now()
);

create table weekly_entries (
  id uuid primary key default uuid_generate_v4(),
  week_of date not null unique,
  answers jsonb not null default '{}',
  question_ids uuid[] not null default '{}',
  photo_urls text[] not null default '{}',
  sent_at timestamptz,
  email_preview text,
  created_at timestamptz not null default now()
);

create table claude_suggestions (
  id uuid primary key default uuid_generate_v4(),
  text text not null,
  entry_id uuid references weekly_entries(id) on delete cascade,
  generated_at timestamptz not null default now(),
  promoted bool not null default false
);

create table config (
  id int primary key default 1 check (id = 1),
  child1_name text not null default '',
  child2_name text not null default '',
  child1_email text not null default '',
  child2_email text not null default '',
  child1_birthday date,
  child2_birthday date,
  parent_email text not null default '',
  google_refresh_token text,
  updated_at timestamptz not null default now()
);

-- Insert empty config row
insert into config (id) values (1);

-- RLS
alter table questions enable row level security;
alter table weekly_entries enable row level security;
alter table claude_suggestions enable row level security;
alter table config enable row level security;

create policy "authenticated only" on questions for all using (auth.role() = 'authenticated');
create policy "authenticated only" on weekly_entries for all using (auth.role() = 'authenticated');
create policy "authenticated only" on claude_suggestions for all using (auth.role() = 'authenticated');
create policy "authenticated only" on config for all using (auth.role() = 'authenticated');

-- Helper function used by lib/questions.ts
create or replace function increment_question_usage(question_id uuid)
returns void language sql security definer as $$
  update questions
  set times_used = times_used + 1,
      last_used_at = now()
  where id = question_id;
$$;
```

- [ ] **Step 3: Write migration 002_seed_questions.sql**

Create `supabase/migrations/002_seed_questions.sql`:

```sql
insert into questions (text, theme, source) values
  ('What made you both laugh the hardest this week?', 'funny', 'manual'),
  ('What''s something funny one of you said or did that I''ll want to remember?', 'funny', 'manual'),
  ('What new word or skill did one of you pick up this week?', 'milestone', 'manual'),
  ('What milestone happened this week, big or small?', 'milestone', 'manual'),
  ('What was your favorite moment with both of you together this week?', 'feelings', 'manual'),
  ('What do I love most about each of you right now, specifically?', 'feelings', 'manual'),
  ('What was the hardest part of parenting this week, and how did it go?', 'feelings', 'manual'),
  ('What''s something I never want to forget about this stage of your lives?', 'feelings', 'manual'),
  ('What''s your current daily routine look like — what do you both love about it?', 'routines', 'manual'),
  ('What''s a small ritual or habit we have right now that I hope you''ll remember?', 'routines', 'manual'),
  ('What did we eat, watch, or do together that felt like a real family moment?', 'routines', 'manual'),
  ('What am I grateful for about being your parent this week?', 'gratitude', 'manual'),
  ('What did you both teach me this week without meaning to?', 'gratitude', 'manual'),
  ('If I could freeze one moment from this week to show you someday, what would it be?', 'gratitude', 'manual'),
  ('What are you both obsessed with right now?', 'routines', 'manual'),
  ('What''s one thing I did this week that I''m proud of as your parent?', 'feelings', 'manual'),
  ('What''s one thing I wish I''d done differently this week?', 'feelings', 'manual'),
  ('What are you both afraid of right now, and how do we help you through it?', 'feelings', 'manual'),
  ('What game, book, or song is on repeat in our house right now?', 'routines', 'manual'),
  ('What''s something one of you did this week that surprised me?', 'milestone', 'manual');
```

- [ ] **Step 4: Run migrations**

```bash
# Install Supabase CLI if not present
npm install -g supabase

# Log in and link project
supabase login
supabase link --project-ref <your-project-ref>

# Run migrations
supabase db push
```

Verify in Supabase dashboard → Table Editor that all 4 tables exist and config has 1 row.

- [ ] **Step 5: Write lib/supabase/server.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export function createServiceClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 6: Write lib/supabase/client.ts**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 7: Write middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPublic = pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/cron')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: supabase schema, migrations, and client helpers"
```

---

## Task 3: Auth (login page + callback)

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/auth/callback/route.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts`, `createClient()` from `lib/supabase/client.ts`
- Produces: authenticated session cookie; `/login` redirects to `/` after magic link click

- [ ] **Step 1: Write app/login/page.tsx**

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-center text-gray-600">
          Check your email — a login link is on its way to <strong>{email}</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-80">
        <h1 className="text-xl font-semibold">Memory Letters</h1>
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send login link'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Write app/auth/callback/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/`)
}
```

- [ ] **Step 3: Update app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Memory Letters',
  description: 'Weekly letters to my kids',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Write app/page.tsx**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = createClient()

  // Check if config is set up
  const { data: config } = await supabase.from('config').select('parent_email').single()
  if (!config?.parent_email) redirect('/setup')

  // Redirect to most recent unsent entry, or show archive
  const { data: entry } = await supabase
    .from('weekly_entries')
    .select('id')
    .is('sent_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (entry) redirect(`/week/${entry.id}`)

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">All caught up</h1>
        <p className="text-gray-500">Your next letter goes out Sunday at 8pm.</p>
        <a href="/questions" className="text-indigo-600 underline mt-4 block">Manage questions</a>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Test auth flow**

```bash
npm run dev
```

Visit `http://localhost:3000` — should redirect to `/login`. Enter your email, check inbox, click link, should land at `/setup` (since config is empty).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: auth with Supabase magic link"
```

---

## Task 4: Setup page (config)

**Files:**
- Create: `app/setup/page.tsx`
- Create: `app/api/config/route.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts`
- Produces: populated `config` row in DB; redirect to `/` after save

- [ ] **Step 1: Write app/api/config/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const supabase = createClient()

  const { error } = await supabase.from('config').update({
    child1_name: body.child1Name,
    child2_name: body.child2Name,
    child1_email: body.child1Email,
    child2_email: body.child2Email,
    child1_birthday: body.child1Birthday || null,
    child2_birthday: body.child2Birthday || null,
    parent_email: body.parentEmail,
    updated_at: new Date().toISOString(),
  }).eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Write app/setup/page.tsx**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    child1Name: '', child2Name: '',
    child1Email: '', child2Email: '',
    child1Birthday: '', child2Birthday: '',
    parentEmail: '',
  })

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    router.push('/')
  }

  const field = (label: string, key: string, type = 'text') => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        className="border rounded px-3 py-2"
      />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md">
        <h1 className="text-xl font-semibold">Set up Memory Letters</h1>
        {field('Your email (reminder emails go here)', 'parentEmail', 'email')}
        <hr />
        {field('Child 1 name', 'child1Name')}
        {field('Child 1 future email (they get this at 18)', 'child1Email', 'email')}
        {field('Child 1 birthday', 'child1Birthday', 'date')}
        <hr />
        {field('Child 2 name', 'child2Name')}
        {field('Child 2 future email', 'child2Email', 'email')}
        {field('Child 2 birthday', 'child2Birthday', 'date')}
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white rounded px-4 py-2 mt-2 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Test setup flow**

```bash
npm run dev
```

Go through login → `/setup` → fill out form → submit → should land on `/` with "All caught up" message.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: setup page and config API"
```

---

## Task 5: Google Photos OAuth + recent photos API

**Files:**
- Create: `lib/google-photos.ts`
- Create: `app/api/photos/auth/route.ts`
- Create: `app/api/photos/callback/route.ts`
- Create: `app/api/photos/recent/route.ts`

**Interfaces:**
- Produces:
  - `getRecentPhotos(): Promise<Photo[]>` from `lib/google-photos.ts`
  - `Photo { id: string; thumbnailUrl: string; downloadUrl: string; filename: string }`
  - `GET /api/photos/recent` → `{ photos: Photo[] }`
  - `GET /api/photos/auth` → redirect to Google OAuth
  - `GET /api/photos/callback` → stores refresh token, redirects to `/`

- [ ] **Step 1: Create Google Cloud credentials**

Manual steps:
1. Go to https://console.cloud.google.com → New project → `memory-letters`
2. APIs & Services → Enable APIs → enable **Photos Library API**
3. APIs & Services → Credentials → Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/api/photos/callback` AND `https://your-vercel-domain.vercel.app/api/photos/callback`
4. Copy client ID and secret into `.env.local`

- [ ] **Step 2: Write lib/google-photos.ts**

```typescript
import { OAuth2Client } from 'googleapis/build/src/auth/oauth2client'
import { createServiceClient } from './supabase/server'

export interface Photo {
  id: string
  thumbnailUrl: string
  downloadUrl: string
  filename: string
}

function makeOAuth2Client(): OAuth2Client {
  const { google } = require('googleapis')
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/photos/callback`
  )
}

export function getAuthUrl(): string {
  const client = makeOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/photoslibrary.readonly'],
    prompt: 'consent',
  })
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const client = makeOAuth2Client()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) throw new Error('No refresh token returned')

  const supabase = createServiceClient()
  await supabase.from('config').update({ google_refresh_token: tokens.refresh_token }).eq('id', 1)

  return tokens.refresh_token
}

async function getAccessToken(): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('config').select('google_refresh_token').single()
  if (!data?.google_refresh_token) throw new Error('No Google Photos token configured')

  const client = makeOAuth2Client()
  client.setCredentials({ refresh_token: data.google_refresh_token })
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Failed to get access token')
  return token
}

export async function getRecentPhotos(daysBack = 7): Promise<Photo[]> {
  const accessToken = await getAccessToken()

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - daysBack)

  const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pageSize: 50,
      filters: {
        dateFilter: {
          ranges: [{
            startDate: { year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate() },
            endDate: { year: end.getFullYear(), month: end.getMonth() + 1, day: end.getDate() },
          }],
        },
        mediaTypeFilter: { mediaTypes: ['PHOTO'] },
      },
    }),
  })

  if (!response.ok) throw new Error(`Photos API error: ${response.status}`)
  const data = await response.json()

  return (data.mediaItems || []).map((item: any) => ({
    id: item.id,
    thumbnailUrl: `${item.baseUrl}=w400-h300-c`,
    downloadUrl: `${item.baseUrl}=d`,
    filename: item.filename,
  }))
}

export async function downloadPhoto(downloadUrl: string): Promise<Buffer> {
  const response = await fetch(downloadUrl)
  if (!response.ok) throw new Error(`Failed to download photo: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}
```

- [ ] **Step 3: Write app/api/photos/auth/route.ts**

```typescript
import { getAuthUrl } from '@/lib/google-photos'
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.redirect(getAuthUrl())
}
```

- [ ] **Step 4: Write app/api/photos/callback/route.ts**

```typescript
import { exchangeCodeForToken } from '@/lib/google-photos'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/?error=no_code`)

  try {
    await exchangeCodeForToken(code)
    return NextResponse.redirect(`${origin}/`)
  } catch (e) {
    console.error('Google Photos OAuth error:', e)
    return NextResponse.redirect(`${origin}/?error=oauth_failed`)
  }
}
```

- [ ] **Step 5: Write app/api/photos/recent/route.ts**

```typescript
import { getRecentPhotos } from '@/lib/google-photos'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const photos = await getRecentPhotos(7)
    return NextResponse.json({ photos })
  } catch (e: any) {
    if (e.message?.includes('No Google Photos token')) {
      return NextResponse.json({ photos: [], needsAuth: true })
    }
    return NextResponse.json({ photos: [], error: e.message })
  }
}
```

- [ ] **Step 6: Test OAuth flow**

```bash
npm run dev
```

Visit `http://localhost:3000/api/photos/auth` → should redirect to Google consent screen → after approval, `google_refresh_token` should be populated in your Supabase `config` table.

Then visit `http://localhost:3000/api/photos/recent` → should return photos from the past 7 days.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Google Photos OAuth and recent photos API"
```

---

## Task 6: Question bank + Claude suggestions

**Files:**
- Create: `lib/questions.ts`
- Create: `lib/claude.ts`
- Create: `app/api/questions/route.ts`

**Interfaces:**
- Produces:
  - `selectWeeklyQuestions(count: number): Promise<Question[]>` from `lib/questions.ts`
  - `markQuestionsUsed(ids: string[]): Promise<void>` from `lib/questions.ts`
  - `Question { id: string; text: string; theme: string; source: string }`
  - `generateQuestionSuggestions(ctx: SuggestionContext): Promise<string[]>` from `lib/claude.ts`
  - `composeEmail(ctx: ComposeContext): Promise<string>` from `lib/claude.ts`
  - `GET /api/questions` → `{ questions: Question[] }`
  - `POST /api/questions` → create question
  - `PATCH /api/questions` → update question

- [ ] **Step 1: Write failing tests for lib/questions.ts**

Create `lib/__tests__/questions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom }),
}))

import { selectWeeklyQuestions } from '../questions'

describe('selectWeeklyQuestions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns at most `count` questions', async () => {
    const fakeQuestions = [
      { id: '1', text: 'Q1', theme: 'funny', source: 'manual', times_used: 0, last_used_at: null },
      { id: '2', text: 'Q2', theme: 'milestone', source: 'manual', times_used: 0, last_used_at: null },
      { id: '3', text: 'Q3', theme: 'feelings', source: 'manual', times_used: 0, last_used_at: null },
      { id: '4', text: 'Q4', theme: 'routines', source: 'manual', times_used: 0, last_used_at: null },
    ]
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: fakeQuestions }),
    })

    const result = await selectWeeklyQuestions(3)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('avoids selecting two questions with the same theme when possible', async () => {
    const fakeQuestions = [
      { id: '1', text: 'Q1', theme: 'funny', source: 'manual', times_used: 0, last_used_at: null },
      { id: '2', text: 'Q2', theme: 'funny', source: 'manual', times_used: 0, last_used_at: null },
      { id: '3', text: 'Q3', theme: 'milestone', source: 'manual', times_used: 0, last_used_at: null },
    ]
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: fakeQuestions }),
    })

    const result = await selectWeeklyQuestions(3)
    const themes = result.map(q => q.theme)
    // Should only have one 'funny' question if diverse alternatives exist
    const funnyCount = themes.filter(t => t === 'funny').length
    expect(funnyCount).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — `selectWeeklyQuestions` not defined.

- [ ] **Step 3: Write lib/questions.ts**

```typescript
import { createClient } from './supabase/server'

export interface Question {
  id: string
  text: string
  theme: string
  source: 'manual' | 'claude'
  times_used: number
  last_used_at: string | null
}

export async function selectWeeklyQuestions(count = 3, clientOverride?: any): Promise<Question[]> {
  // clientOverride allows the cron (no auth session) to pass the service role client
  const supabase = clientOverride || createClient()

  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('active', true)
    .or(`last_used_at.is.null,last_used_at.lt.${eightWeeksAgo.toISOString()}`)
    .order('last_used_at', { ascending: true, nullsFirst: true })

  const pool = questions || []
  const selected: Question[] = []
  const usedThemes = new Set<string>()

  // First pass: pick diverse themes
  for (const q of pool) {
    if (selected.length >= count) break
    if (!usedThemes.has(q.theme)) {
      selected.push(q)
      usedThemes.add(q.theme)
    }
  }

  // Second pass: fill remaining spots with any question not already selected
  for (const q of pool) {
    if (selected.length >= count) break
    if (!selected.find(s => s.id === q.id)) selected.push(q)
  }

  // If bank is too small, fall back to all active questions
  if (selected.length < count) {
    const { data: all } = await supabase
      .from('questions')
      .select('*')
      .eq('active', true)
      .order('last_used_at', { ascending: true, nullsFirst: true })
    return (all || []).slice(0, count)
  }

  return selected
}

export async function markQuestionsUsed(questionIds: string[]): Promise<void> {
  const supabase = createClient()
  await Promise.all(
    questionIds.map(id => supabase.rpc('increment_question_usage', { question_id: id }))
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: PASS

- [ ] **Step 5: Write lib/claude.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()
const MODEL = 'claude-haiku-4-5-20251001'

export interface SuggestionContext {
  season: string
  child1Age: string
  child2Age: string
  recentThemes: string[]
}

export async function generateQuestionSuggestions(ctx: SuggestionContext): Promise<string[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Generate 2 warm, brief journaling questions for a parent writing weekly memory letters to their kids (ages ${ctx.child1Age} and ${ctx.child2Age}).

Season: ${ctx.season}
Themes covered recently (avoid these): ${ctx.recentThemes.join(', ') || 'none'}

Requirements:
- Answerable in 2-4 sentences
- Specific to young children at these ages
- From one of these themes (pick underrepresented ones): milestone, funny, feelings, routines, gratitude

Return exactly 2 questions, one per line, no numbering, no bullets, no extra text.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  return text.split('\n').map(q => q.trim()).filter(q => q.length > 0).slice(0, 2)
}

export interface ComposeContext {
  weekOf: string
  child1Name: string
  child2Name: string
  answers: Array<{ question: string; answer: string }>
}

export async function composeEmail(ctx: ComposeContext): Promise<string> {
  const answersText = ctx.answers
    .map(a => `Question: ${a.question}\nAnswer: ${a.answer}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `You are helping a parent write a brief weekly memory letter to their children (${ctx.child1Name} and ${ctx.child2Name}).

Week of: ${ctx.weekOf}

Parent's answers:

${answersText}

Write a structured letter with these exact HTML sections:

<section>
<h2>📅 This week</h2>
<p>[2-4 sentences from the parent's "what happened this week" answer]</p>
</section>

<section>
<h2>💛 What I love about you both right now</h2>
<p>[2-3 sentences from the "what I love" answer, specific and tender]</p>
</section>

[Additional answers as <section><h2>[short heading]</h2><p>[answer]</p></section>]

Rules:
- Keep the parent's exact words as much as possible — lightly weave, do not rewrite or expand
- Warm but not saccharine
- Brief — this is a weekly snapshot
- Return only the HTML sections above, no greeting, no sign-off, no subject line`,
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}
```

- [ ] **Step 6: Write app/api/questions/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data })
}

export async function POST(request: Request) {
  const { text, theme } = await request.json()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('questions')
    .insert({ text, theme, source: 'manual' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question: data })
}

export async function PATCH(request: Request) {
  const { id, ...updates } = await request.json()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question: data })
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: question bank selection logic and Claude integration"
```

---

## Task 7: Sunday cron job

**Files:**
- Create: `lib/resend.ts` (reminder email only — memory email added in Task 10)
- Create: `app/api/cron/route.ts`

**Interfaces:**
- Consumes: `selectWeeklyQuestions()` from `lib/questions.ts`, `generateQuestionSuggestions()` from `lib/claude.ts`, `createServiceClient()` from `lib/supabase/server.ts`
- Produces: `GET /api/cron` — creates `weekly_entries` row, saves `claude_suggestions`, sends reminder email; secured by `Authorization: Bearer <CRON_SECRET>` header

- [ ] **Step 1: Write lib/resend.ts (reminder email)**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_ADDRESS!

export async function sendReminderEmail({ to, formUrl, weekOf }: {
  to: string
  formUrl: string
  weekOf: string
}) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `📝 Time to write this week's memory letter (${weekOf})`,
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="font-size:20px;font-weight:normal">Hey — it's Sunday.</h2>
        <p>This week's memory letter is waiting for you. Takes about 5 minutes.</p>
        <p>
          <a href="${formUrl}"
             style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px">
            Write this week's letter →
          </a>
        </p>
        <p style="color:#9CA3AF;font-size:13px;margin-top:24px">
          Week of ${weekOf}
        </p>
      </div>
    `,
  })

  if (error) throw new Error(`Reminder email failed: ${error.message}`)
}

export async function sendFailureNotification({ to, entryId, error: errMsg }: {
  to: string
  entryId: string
  error: string
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: '⚠️ Memory letter failed to send',
    html: `<p>Your memory letter (entry ${entryId}) failed to send: ${errMsg}</p>
           <p>Log in to retry: ${process.env.NEXT_PUBLIC_APP_URL}/week/${entryId}</p>`,
  })
}
```

- [ ] **Step 2: Write app/api/cron/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { selectWeeklyQuestions } from '@/lib/questions'
import { generateQuestionSuggestions } from '@/lib/claude'
import { sendReminderEmail } from '@/lib/resend'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: config } = await supabase.from('config').select('*').single()
  if (!config?.parent_email) {
    return NextResponse.json({ error: 'Config not set up' }, { status: 500 })
  }

  const weekOf = getThisSunday()

  // Idempotency: don't create a duplicate entry for the same week
  const { data: existing } = await supabase
    .from('weekly_entries')
    .select('id')
    .eq('week_of', weekOf)
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Entry already exists', entryId: existing.id })
  }

  // Select bank questions — pass service client since cron has no auth session
  const bankQuestions = await selectWeeklyQuestions(3, supabase)
  const questionIds = bankQuestions.map(q => q.id)

  // Create entry
  const { data: entry, error: entryError } = await supabase
    .from('weekly_entries')
    .insert({ week_of: weekOf, question_ids: questionIds })
    .select()
    .single()

  if (entryError || !entry) {
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
  }

  // Generate Claude suggestions (non-fatal if fails)
  try {
    const ctx = {
      season: getSeason(),
      child1Age: getAgeString(config.child1_birthday),
      child2Age: getAgeString(config.child2_birthday),
      recentThemes: bankQuestions.map(q => q.theme),
    }
    const suggestions = await generateQuestionSuggestions(ctx)
    if (suggestions.length > 0) {
      await supabase.from('claude_suggestions').insert(
        suggestions.map(text => ({ text, entry_id: entry.id }))
      )
    }
  } catch (e) {
    console.error('Claude suggestions failed (non-fatal):', e)
  }

  // Send reminder email
  const formUrl = `${process.env.NEXT_PUBLIC_APP_URL}/week/${entry.id}`
  await sendReminderEmail({ to: config.parent_email, formUrl, weekOf })

  return NextResponse.json({ success: true, entryId: entry.id })
}

function getThisSunday(): string {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday
  const diff = dayOfWeek === 0 ? 0 : -dayOfWeek
  const sunday = new Date(now)
  sunday.setDate(now.getDate() + diff)
  return sunday.toISOString().split('T')[0]
}

function getSeason(): string {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

function getAgeString(birthday: string | null): string {
  if (!birthday) return 'young'
  const birth = new Date(birthday)
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 24) return `${months} months old`
  return `${Math.floor(months / 12)} years old`
}
```

- [ ] **Step 3: Set CRON_SECRET in .env.local**

```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the output to `.env.local` as `CRON_SECRET=<value>`.

- [ ] **Step 4: Set up Resend**

Manual step:
1. Go to https://resend.com → sign up free
2. Add and verify your sending domain (or use Resend's shared domain `onboarding@resend.dev` for testing)
3. Create an API key → add to `.env.local` as `RESEND_API_KEY=<key>`
4. Set `RESEND_FROM_ADDRESS=letters@yourdomain.com` (or `onboarding@resend.dev` for local testing)

- [ ] **Step 5: Test cron route**

```bash
npm run dev
```

```bash
curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  http://localhost:3000/api/cron
```

Expected: `{"success":true,"entryId":"..."}` and a reminder email arrives at your `parent_email`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: sunday cron job with reminder email"
```

---

## Task 8: Weekly form UI

**Files:**
- Create: `components/PhotoPicker.tsx`
- Create: `components/QuestionAnswer.tsx`
- Create: `app/week/[id]/page.tsx`
- Create: `app/week/[id]/WeekForm.tsx`

**Interfaces:**
- Consumes: `GET /api/photos/recent`, `GET /api/photos/auth`, `PATCH /api/entries/[id]` (save answers + photos)
- Produces: filled `weekly_entries.answers` and `weekly_entries.photo_urls`; user can proceed to preview

- [ ] **Step 1: Write components/PhotoPicker.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'

interface Photo {
  id: string
  thumbnailUrl: string
  downloadUrl: string
  filename: string
}

interface PhotoPickerProps {
  selected: string[]
  onSelect: (downloadUrls: string[]) => void
}

export default function PhotoPicker({ selected, onSelect }: PhotoPickerProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [needsAuth, setNeedsAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [manualUrl, setManualUrl] = useState('')

  useEffect(() => {
    fetch('/api/photos/recent')
      .then(r => r.json())
      .then(data => {
        setPhotos(data.photos || [])
        setNeedsAuth(!!data.needsAuth)
        setLoading(false)
      })
  }, [])

  function toggle(photo: Photo) {
    const url = photo.downloadUrl
    if (selected.includes(url)) {
      onSelect(selected.filter(u => u !== url))
    } else if (selected.length < 3) {
      onSelect([...selected, url])
    }
  }

  function addManualUrl() {
    const trimmed = manualUrl.trim()
    if (trimmed && !selected.includes(trimmed) && selected.length < 3) {
      onSelect([...selected, trimmed])
      setManualUrl('')
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading photos…</p>

  if (needsAuth) {
    return (
      <div className="border rounded p-4 bg-amber-50">
        <p className="text-sm text-amber-800 mb-2">Connect Google Photos to auto-load this week's pictures.</p>
        <a href="/api/photos/auth" className="text-indigo-600 underline text-sm">Connect Google Photos</a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">Select up to 3 photos from the past week.</p>
      <div className="grid grid-cols-4 gap-2">
        {photos.map(photo => (
          <button
            key={photo.id}
            type="button"
            onClick={() => toggle(photo)}
            className={`relative aspect-square overflow-hidden rounded border-2 transition-all ${
              selected.includes(photo.downloadUrl) ? 'border-indigo-500 opacity-100' : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <img src={photo.thumbnailUrl} alt={photo.filename} className="w-full h-full object-cover" />
            {selected.includes(photo.downloadUrl) && (
              <div className="absolute top-1 right-1 bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {selected.indexOf(photo.downloadUrl) + 1}
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        <input
          type="url"
          placeholder="Or paste a Google Photos share URL"
          value={manualUrl}
          onChange={e => setManualUrl(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm flex-1"
        />
        <button
          type="button"
          onClick={addManualUrl}
          disabled={!manualUrl || selected.length >= 3}
          className="text-sm px-3 py-1.5 border rounded disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write components/QuestionAnswer.tsx**

```typescript
'use client'

interface QuestionAnswerProps {
  questionId: string
  text: string
  isSuggestion?: boolean
  answer: string
  onAnswerChange: (questionId: string, answer: string) => void
  onPromote?: (questionId: string) => void
  promoted?: boolean
}

export default function QuestionAnswer({
  questionId, text, isSuggestion, answer, onAnswerChange, onPromote, promoted,
}: QuestionAnswerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <label className="text-sm font-medium text-gray-800 leading-snug">{text}</label>
        {isSuggestion && onPromote && (
          <button
            type="button"
            onClick={() => onPromote(questionId)}
            disabled={promoted}
            className="shrink-0 text-xs text-indigo-600 border border-indigo-300 rounded px-2 py-0.5 disabled:opacity-40 disabled:cursor-default"
          >
            {promoted ? 'Added ✓' : '+ Add to bank'}
          </button>
        )}
      </div>
      <textarea
        value={answer}
        onChange={e => onAnswerChange(questionId, e.target.value)}
        rows={3}
        className="border rounded px-3 py-2 text-sm resize-y w-full"
        placeholder="Write a few sentences…"
      />
    </div>
  )
}
```

- [ ] **Step 3: Write app/week/[id]/page.tsx**

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import WeekForm from './WeekForm'

export default async function WeekPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: entry }, { data: suggestions }] = await Promise.all([
    supabase.from('weekly_entries').select('*').eq('id', params.id).single(),
    supabase.from('claude_suggestions').select('*').eq('entry_id', params.id),
  ])

  if (!entry) notFound()

  // Load bank questions for this entry
  let bankQuestions: any[] = []
  if (entry.question_ids?.length > 0) {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .in('id', entry.question_ids)
    bankQuestions = data || []
  }

  return (
    <WeekForm
      entry={entry}
      bankQuestions={bankQuestions}
      suggestions={suggestions || []}
    />
  )
}
```

- [ ] **Step 4: Write app/api/entries/[id]/route.ts (save draft)**

Create `app/api/entries/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { answers, photoUrls } = await request.json()
  const supabase = createClient()

  const { error } = await supabase
    .from('weekly_entries')
    .update({ answers: answers ?? {}, photo_urls: photoUrls ?? [] })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Write app/week/[id]/WeekForm.tsx**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhotoPicker from '@/components/PhotoPicker'
import QuestionAnswer from '@/components/QuestionAnswer'

interface Props {
  entry: { id: string; week_of: string; answers: Record<string, string>; photo_urls: string[] }
  bankQuestions: Array<{ id: string; text: string; theme: string }>
  suggestions: Array<{ id: string; text: string; promoted: boolean }>
}

export default function WeekForm({ entry, bankQuestions, suggestions }: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>(entry.answers || {})
  const [photoUrls, setPhotoUrls] = useState<string[]>(entry.photo_urls || [])
  const [promoted, setPromoted] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  function setAnswer(id: string, value: string) {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  async function handlePromote(suggestionId: string) {
    await fetch(`/api/suggestions/${suggestionId}/promote`, { method: 'POST' })
    setPromoted(prev => new Set([...prev, suggestionId]))
  }

  async function handlePreview() {
    setSaving(true)
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, photoUrls }),
    })
    router.push(`/preview/${entry.id}`)
  }

  const weekLabel = new Date(entry.week_of + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Week of {weekLabel}</h1>
        <p className="text-sm text-gray-500 mt-1">A letter to your kids.</p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Photos</h2>
        <PhotoPicker selected={photoUrls} onSelect={setPhotoUrls} />
      </div>

      <div className="flex flex-col gap-6">
        <h2 className="font-medium">This week</h2>
        {bankQuestions.map(q => (
          <QuestionAnswer
            key={q.id}
            questionId={q.id}
            text={q.text}
            answer={answers[q.id] || ''}
            onAnswerChange={setAnswer}
          />
        ))}
        {suggestions.length > 0 && (
          <>
            <p className="text-xs text-gray-400 -mb-3">✨ Suggested this week</p>
            {suggestions.map(s => (
              <QuestionAnswer
                key={s.id}
                questionId={s.id}
                text={s.text}
                isSuggestion
                answer={answers[s.id] || ''}
                onAnswerChange={setAnswer}
                onPromote={handlePromote}
                promoted={promoted.has(s.id)}
              />
            ))}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handlePreview}
        disabled={saving}
        className="bg-indigo-600 text-white rounded px-4 py-2.5 font-medium disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Preview letter →'}
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Write app/api/suggestions/[id]/promote/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: suggestion } = await supabase
    .from('claude_suggestions')
    .select('text')
    .eq('id', params.id)
    .single()

  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await Promise.all([
    supabase.from('questions').insert({ text: suggestion.text, theme: 'feelings', source: 'claude' }),
    supabase.from('claude_suggestions').update({ promoted: true }).eq('id', params.id),
  ])

  return NextResponse.json({ ok: true })
}
```

Note: theme defaults to `'feelings'` for promoted suggestions — the parent can change it in `/questions`.

- [ ] **Step 7: Test the form**

```bash
npm run dev
```

1. Trigger the cron manually (see Task 7 Step 5) to create an entry
2. Visit the form link from the reminder email (or `http://localhost:3000/week/<id>`)
3. Verify: Google Photos grid loads, questions appear, typing in textareas works, "Add to bank" button on suggestions works
4. Click "Preview letter →" — should save and redirect to `/preview/<id>` (404 for now — that's Task 9)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: weekly form UI with photo picker and question answers"
```

---

## Task 9: Email composition (Claude) + preview

**Files:**
- Create: `app/preview/[id]/page.tsx`
- Create: `components/EmailPreview.tsx`
- Create: `app/api/entries/[id]/compose/route.ts`

**Interfaces:**
- Consumes: `composeEmail()` from `lib/claude.ts`
- Produces: `weekly_entries.email_preview` (HTML string); preview page with inline edit and send button

- [ ] **Step 1: Write app/api/entries/[id]/compose/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'
import { composeEmail } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: entry }, { data: config }] = await Promise.all([
    supabase.from('weekly_entries').select('*').eq('id', params.id).single(),
    supabase.from('config').select('*').single(),
  ])

  if (!entry || !config) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Load questions for this entry (bank + suggestions with answers)
  const questionIds = Object.keys(entry.answers || {})
  let questionTexts: Record<string, string> = {}

  if (questionIds.length > 0) {
    const [{ data: bankQs }, { data: suggestionQs }] = await Promise.all([
      supabase.from('questions').select('id,text').in('id', questionIds),
      supabase.from('claude_suggestions').select('id,text').in('id', questionIds),
    ])
    ;[...(bankQs || []), ...(suggestionQs || [])].forEach(q => {
      questionTexts[q.id] = q.text
    })
  }

  const answers = Object.entries(entry.answers || {})
    .filter(([, ans]) => (ans as string).trim().length > 0)
    .map(([id, ans]) => ({ question: questionTexts[id] || '', answer: ans as string }))
    .filter(a => a.question)

  const weekLabel = new Date(entry.week_of + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const body = await composeEmail({
    weekOf: weekLabel,
    child1Name: config.child1_name,
    child2Name: config.child2_name,
    answers,
  })

  const emailPreview = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a;line-height:1.7">
      ${body}
      <p style="margin-top:32px">Love, Dad</p>
    </div>
  `

  await supabase.from('weekly_entries').update({ email_preview: emailPreview }).eq('id', params.id)

  return NextResponse.json({ html: emailPreview })
}
```

- [ ] **Step 2: Write components/EmailPreview.tsx**

```typescript
'use client'
import { useState } from 'react'

interface EmailPreviewProps {
  initialHtml: string
  onSend: (html: string) => Promise<void>
  sending: boolean
}

export default function EmailPreview({ initialHtml, onSend, sending }: EmailPreviewProps) {
  const [html, setHtml] = useState(initialHtml)
  const [editing, setEditing] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Preview</h2>
        <button
          type="button"
          onClick={() => setEditing(e => !e)}
          className="text-sm text-indigo-600 underline"
        >
          {editing ? 'Done editing' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <textarea
          value={html}
          onChange={e => setHtml(e.target.value)}
          rows={20}
          className="border rounded px-3 py-2 text-sm font-mono w-full"
        />
      ) : (
        <div
          className="border rounded p-6 bg-white shadow-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      <button
        type="button"
        onClick={() => onSend(html)}
        disabled={sending}
        className="bg-indigo-600 text-white rounded px-4 py-2.5 font-medium disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Send to the kids ✉️'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Write app/preview/[id]/page.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import EmailPreview from '@/components/EmailPreview'

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetch(`/api/entries/${id}/compose`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setHtml(data.html)
        setLoading(false)
      })
  }, [id])

  async function handleSend(editedHtml: string) {
    setSending(true)
    const res = await fetch(`/api/entries/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: editedHtml }),
    })
    if (res.ok) {
      router.push('/?sent=1')
    } else {
      alert('Send failed — check console')
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Composing your letter…</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <a href={`/week/${id}`} className="text-sm text-gray-400 underline mb-4 block">← Back to edit</a>
      <EmailPreview initialHtml={html!} onSend={handleSend} sending={sending} />
    </div>
  )
}
```

- [ ] **Step 4: Test preview**

```bash
npm run dev
```

Fill out a week form → click "Preview letter →" → should see Claude-composed HTML letter. Check that:
- Sections render correctly (📅, 💛, etc.)
- Edit button toggles raw HTML editing
- "Send" button is present (will 404 until Task 10)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Claude email composition and preview page"
```

---

## Task 10: Email sending (Resend) + delivery handling

**Files:**
- Modify: `lib/resend.ts` (add `sendMemoryEmail`)
- Create: `app/api/entries/[id]/send/route.ts`

**Interfaces:**
- Consumes: `sendMemoryEmail()` from `lib/resend.ts`, `downloadPhoto()` from `lib/google-photos.ts`
- Produces: stamps `weekly_entries.sent_at`, updates `weekly_entries.email_preview` with final HTML; failure logged + notification email sent

- [ ] **Step 1: Add sendMemoryEmail to lib/resend.ts**

Add to the end of `lib/resend.ts`:

```typescript
export async function sendMemoryEmail({ toAddresses, subject, html, photoBuffers }: {
  toAddresses: string[]
  subject: string
  html: string
  photoBuffers: Array<{ filename: string; content: Buffer }>
}) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: toAddresses,
    subject,
    html,
    attachments: photoBuffers.map(p => ({
      filename: p.filename,
      content: p.content,
    })),
  })

  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 2: Write app/api/entries/[id]/send/route.ts**

```typescript
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { downloadPhoto } from '@/lib/google-photos'
import { sendMemoryEmail, sendFailureNotification } from '@/lib/resend'
import { markQuestionsUsed } from '@/lib/questions'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { html } = await request.json()
  const supabase = createClient()

  const [{ data: entry }, { data: config }] = await Promise.all([
    supabase.from('weekly_entries').select('*').eq('id', params.id).single(),
    supabase.from('config').select('*').single(),
  ])

  if (!entry || !config) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (entry.sent_at) return NextResponse.json({ error: 'Already sent' }, { status: 409 })

  // Download photos as buffers (attach, not link).
  // Note: Google Photos download URLs expire ~60 min after the form was loaded.
  // If downloads fail here, the email still sends without those photos.
  const photoBuffers: Array<{ filename: string; content: Buffer }> = []
  for (const url of entry.photo_urls || []) {
    try {
      const content = await downloadPhoto(url)
      const filename = `photo-${photoBuffers.length + 1}.jpg`
      photoBuffers.push({ filename, content })
    } catch (e) {
      console.error(`Failed to download photo ${url}:`, e)
    }
  }

  const weekLabel = new Date(entry.week_of + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const recipientAddresses = [config.child1_email, config.child2_email].filter(Boolean)

  try {
    await sendMemoryEmail({
      toAddresses: recipientAddresses,
      subject: `Week of ${weekLabel} — from Dad`,
      html,
      photoBuffers,
    })
  } catch (e: any) {
    // Log failure and notify parent
    console.error('Memory email send failed:', e)
    await supabase.from('weekly_entries').update({
      email_preview: html,
    }).eq('id', params.id)

    try {
      await sendFailureNotification({
        to: config.parent_email,
        entryId: params.id,
        error: e.message,
      })
    } catch {}

    return NextResponse.json({ error: 'Send failed', detail: e.message }, { status: 500 })
  }

  // Mark entry sent + update preview with final HTML
  const now = new Date().toISOString()
  await supabase.from('weekly_entries').update({
    sent_at: now,
    email_preview: html,
  }).eq('id', params.id)

  // Mark bank questions as used
  await markQuestionsUsed(entry.question_ids || [])

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Test full send flow**

```bash
npm run dev
```

1. Fill out a week form → preview → click "Send to the kids"
2. Check both child email addresses received the email with photos attached
3. Check Supabase: `weekly_entries.sent_at` is populated
4. Confirm app redirects to "All caught up" page

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: email sending with photo attachments via Resend"
```

---

## Task 11: Question management admin page

**Files:**
- Create: `app/questions/page.tsx`

**Interfaces:**
- Consumes: `GET /api/questions`, `POST /api/questions`, `PATCH /api/questions`
- Produces: usable admin page to view, add, edit, and disable questions

- [ ] **Step 1: Write app/questions/page.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'

const THEMES = ['milestone', 'funny', 'feelings', 'routines', 'gratitude']

interface Question {
  id: string
  text: string
  theme: string
  times_used: number
  active: boolean
  source: string
  last_used_at: string | null
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [newText, setNewText] = useState('')
  const [newTheme, setNewTheme] = useState('feelings')
  const [adding, setAdding] = useState(false)

  async function load() {
    const res = await fetch('/api/questions')
    const data = await res.json()
    setQuestions(data.questions || [])
  }

  useEffect(() => { load() }, [])

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newText.trim(), theme: newTheme }),
    })
    setNewText('')
    await load()
    setAdding(false)
  }

  async function toggleActive(q: Question) {
    await fetch('/api/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: q.id, active: !q.active }),
    })
    await load()
  }

  async function updateText(q: Question, text: string) {
    await fetch('/api/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: q.id, text }),
    })
    await load()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Question Bank</h1>
        <a href="/" className="text-sm text-gray-400 underline">← Home</a>
      </div>

      <form onSubmit={addQuestion} className="flex gap-2 mb-8">
        <input
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Add a new question…"
          className="border rounded px-3 py-2 text-sm flex-1"
        />
        <select
          value={newTheme}
          onChange={e => setNewTheme(e.target.value)}
          className="border rounded px-2 py-2 text-sm"
        >
          {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          type="submit"
          disabled={adding || !newText.trim()}
          className="bg-indigo-600 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {questions.map(q => (
          <div
            key={q.id}
            className={`border rounded p-3 flex gap-3 items-start ${!q.active ? 'opacity-40' : ''}`}
          >
            <div className="flex-1">
              <input
                type="text"
                defaultValue={q.text}
                onBlur={e => { if (e.target.value !== q.text) updateText(q, e.target.value) }}
                className="w-full text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 outline-none py-0.5"
              />
              <div className="flex gap-3 mt-1 text-xs text-gray-400">
                <span>{q.theme}</span>
                <span>{q.source}</span>
                <span>used {q.times_used}×</span>
                {q.last_used_at && (
                  <span>last {new Date(q.last_used_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggleActive(q)}
              className="text-xs text-gray-400 hover:text-gray-700 shrink-0"
            >
              {q.active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test question management**

```bash
npm run dev
```

Visit `http://localhost:3000/questions`:
- Verify 20 seed questions appear with usage stats
- Add a new question → appears in list
- Click "Disable" → question grays out
- Edit question text (click, edit, click away) → saves

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: question bank admin page"
```

---

## Task 12: Vercel deployment + production setup

**Files:**
- No new files — configure external services and Vercel project

**Interfaces:**
- Produces: live app at `https://memory-letters.vercel.app` (or custom domain); cron running Sunday 1am UTC

- [ ] **Step 1: Push all changes to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Create Vercel project**

Manual steps:
1. Go to https://vercel.com → Add New Project → Import from GitHub
2. Select `memory-letters` repo from `mich.menning@gmail.com`'s account
3. Framework preset: Next.js → Deploy (will fail — env vars not set yet)

- [ ] **Step 3: Set environment variables in Vercel**

In Vercel project → Settings → Environment Variables, add every key from `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL          = <from Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY     = <from Supabase>
SUPABASE_SERVICE_ROLE_KEY         = <from Supabase>
GOOGLE_CLIENT_ID                  = <from Google Cloud>
GOOGLE_CLIENT_SECRET              = <from Google Cloud>
NEXT_PUBLIC_APP_URL               = https://<your-vercel-domain>.vercel.app
ANTHROPIC_API_KEY                 = <from console.anthropic.com>
RESEND_API_KEY                    = <from resend.com>
RESEND_FROM_ADDRESS               = letters@yourdomain.com
CRON_SECRET                       = <same value as local .env.local>
```

- [ ] **Step 4: Update Google OAuth redirect URI**

In Google Cloud Console → Credentials → your OAuth 2.0 client → add authorized redirect URI:
```
https://<your-vercel-domain>.vercel.app/api/photos/callback
```

- [ ] **Step 5: Update Supabase auth redirect URLs**

In Supabase dashboard → Authentication → URL Configuration → add:
```
https://<your-vercel-domain>.vercel.app/auth/callback
```

- [ ] **Step 6: Redeploy**

In Vercel → Deployments → Redeploy latest. Wait for build to succeed.

- [ ] **Step 7: Test production deployment**

1. Visit `https://<your-vercel-domain>.vercel.app` → login with magic link
2. Complete setup page
3. Connect Google Photos (`/api/photos/auth`)
4. Trigger cron manually to test:

```bash
curl -H "Authorization: Bearer <your-CRON_SECRET>" \
  https://<your-vercel-domain>.vercel.app/api/cron
```

5. Click link in reminder email → fill form → preview → send
6. Verify email arrives at child email address with photos attached

- [ ] **Step 8: Verify cron schedule in Vercel**

In Vercel dashboard → your project → Cron Jobs tab. Confirm cron is listed as `0 1 * * 1`. It will fire automatically every Sunday at 1am UTC (8pm CDT). No action needed.

- [ ] **Step 9: Final commit**

```bash
git add .
git commit -m "chore: production-ready deployment notes"
git push origin main
```

---

## Manual Steps Summary

Before the app works end-to-end, these manual steps must be completed in order:

1. **Supabase**: Create project → run migrations via `supabase db push`
2. **Google Cloud**: Create project → enable Photos Library API → create OAuth client → add redirect URIs
3. **Resend**: Create account → add/verify sending domain → create API key
4. **Anthropic**: Get API key from console.anthropic.com
5. **Vercel**: Import repo → set all env vars → redeploy
6. **First run**: Login → `/setup` → connect Google Photos → trigger cron once manually to create first entry
