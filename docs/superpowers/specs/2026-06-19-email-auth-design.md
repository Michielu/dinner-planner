# Email-Gated Auth Design

**Date:** 2026-06-19
**Status:** Approved — ready for implementation

## Problem

The app has no authentication. All tables use open anonymous RLS policies and return every row to every visitor. We need multiple users each with fully isolated data.

## Chosen Approach

Custom email-check auth — no Supabase auth, no magic links, no redirects. An `allowed_emails` table acts as the access list. On login, the app checks the table and stores the email in `localStorage` as the session identifier. All queries filter by that email.

**Adding passwords later:** add a `password_hash` column to `allowed_emails`, add a password field to the login form, and hash/compare server-side via a Supabase Edge Function. No schema changes elsewhere, no data migration.

---

## Data Model

### New table: `allowed_emails`

```sql
create table allowed_emails (
  email text primary key
);
alter table allowed_emails enable row level security;
-- anonymous users must be able to check and insert their own email
create policy "anon_select" on allowed_emails for select to anon using (true);
create policy "anon_insert" on allowed_emails for insert to anon with check (true);
```

### `user_email` column on all user-owned tables

Add `user_email text not null default ''` to:
- `week_plan`
- `staple_items`
- `ingredients`
- `stores`
- `recipes`
- `recipe_ingredients`
- `meal_categories`

After adding the column, run the migration below to claim all existing rows.

### Existing data migration

```sql
update week_plan        set user_email = 'samina.menning@gmail.com' where user_email = '';
update staple_items     set user_email = 'samina.menning@gmail.com' where user_email = '';
update ingredients      set user_email = 'samina.menning@gmail.com' where user_email = '';
update stores           set user_email = 'samina.menning@gmail.com' where user_email = '';
update recipes          set user_email = 'samina.menning@gmail.com' where user_email = '';
update recipe_ingredients set user_email = 'samina.menning@gmail.com' where user_email = '';
update meal_categories  set user_email = 'samina.menning@gmail.com' where user_email = '';
```

Run this in the Supabase SQL editor once, immediately after the column migration.

---

## Auth Components

### `src/hooks/useAuth.js`

Pure localStorage wrapper. No async, no Supabase calls.

```js
const KEY = 'dinner_planner_email'

export function useAuth() {
  const email = localStorage.getItem(KEY) ?? null

  function signIn(email) {
    localStorage.setItem(KEY, email)
  }

  function signOut() {
    localStorage.removeItem(KEY)
    window.location.href = '/login'
  }

  return { email, signIn, signOut }
}
```

### `src/pages/LoginPage.jsx`

Route: `/login`. Accessible to unauthenticated users only (if already logged in, redirect to `/`).

**Flow:**
1. User enters email and submits.
2. Query `allowed_emails` where `email = input`.
3. **Found** → call `signIn(email)` → navigate to `/`.
4. **Not found** → show confirmation step: *"We don't recognize this email. Create a new account?"*
   - **Yes** → insert `{ email }` into `allowed_emails` → seed default categories for this user → call `signIn(email)` → navigate to `/`.
   - **No** → return to the email input (clear the confirmation).
5. Show an inline error (not an alert) if the Supabase query fails.

### Default categories (seeded on new account creation)

When a new account is confirmed, insert the following into `meal_categories` with `user_email` set to the new user's email:

| name | sort_order |
|------|-----------|
| Pasta | 1 |
| Soup | 2 |
| Salad | 3 |
| Chicken | 4 |
| Beef | 5 |
| Seafood | 6 |
| Vegetarian | 7 |
| Quick | 8 |

These match the existing categories already in the database for samina.menning@gmail.com (the migration above claims those rows; new users get a fresh copy).

### Route guard in `App.jsx`

```jsx
// At the top of App(), before any route rendering:
const { email } = useAuth()
if (!email && !isLoginRoute) return <Navigate to="/login" />
```

`/login` itself is always accessible. All other routes require a stored email.

---

## Hook Updates

Every hook that touches a user-owned table must:

1. Call `useAuth()` to get `email`.
2. Add `.eq('user_email', email)` to every `select`, `update`, and `delete` query.
3. Spread `user_email: email` into every `insert` payload.

**Affected hooks:**
- `useRecipes` — `recipes`, `meal_categories`, `recipe_ingredients`
- `useStaples` — `staple_items`
- `useIngredients` — `ingredients`
- `useStores` — `stores` (also scope the in-use checks in `deleteStore`)
- `useWeekPlan` — `week_plan`

`recipe_ingredients` is joined through `recipes` on reads (already scoped), but inserts still need `user_email`.

---

## Sign-out

`useAuth().signOut()` clears localStorage and hard-navigates to `/login`. Add a "Sign out" button somewhere accessible — the nav bar or a small footer link.

---

## Security posture

RLS stays permissive (existing `anon_all` policies unchanged). Data isolation is enforced client-side by the `user_email` filter in every query. This is intentional for simplicity — the app stores no sensitive data. A determined person with the Supabase anon key could query other users' rows, but that requires developer tooling, not casual browsing.
