# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every screen of the Dinner Planner fully usable on a mobile phone.

**Architecture:** Pure Tailwind responsive classes throughout — `sm:` prefix for spacing overrides, `md:hidden`/`hidden md:flex` for nav visibility toggling. One new component (`BottomNav`) handles mobile navigation. No new libraries, no routing changes, no feature changes.

**Tech Stack:** React 18, Tailwind CSS v3, React Router v7, Vite. Tests: Vitest (utility functions only — no React testing library in project).

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/index.css` | Modify | Add iOS input zoom fix |
| `src/components/BottomNav.jsx` | **Create** | Mobile bottom tab bar |
| `src/App.jsx` | Modify | Hide top nav links on mobile, add BottomNav, add main padding |
| `src/components/GroceryList.jsx` | Modify | Remove scroll trap, tighten padding |
| `src/components/PlannerShell.jsx` | Modify | Tighten outer padding |
| `src/pages/PlannerPage.jsx` | Modify | Tighten phase panel padding |
| `src/pages/GroceryPage.jsx` | Modify | Tighten padding |
| `src/pages/RecipesPage.jsx` | Modify | Tighten padding, enlarge chip × tap targets |
| `src/pages/ManagePage.jsx` | Modify | Tighten padding, allow action buttons to wrap |

---

## Task 1: iOS Input Zoom Fix

**Files:**
- Modify: `src/index.css`

iOS Safari auto-zooms when a focused `<input>` or `<select>` is smaller than 16px. Tailwind's `text-sm` is 14px. This rule overrides it on mobile without touching any component.

- [ ] **Step 1: Add the fix to index.css**

Open `src/index.css`. The file currently contains:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', sans-serif;
  background-color: #f4f3e7;
  color: #0e150e;
}
```

Replace with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', sans-serif;
  background-color: #f4f3e7;
  color: #0e150e;
}

@media (max-width: 768px) {
  input, select, textarea {
    font-size: 16px;
  }
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Open the app on a phone (or Chrome DevTools mobile emulation). Tap any input field — the viewport should not zoom in.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: prevent iOS input zoom by setting 16px font-size on mobile"
```

---

## Task 2: Create BottomNav Component

**Files:**
- Create: `src/components/BottomNav.jsx`

A fixed bottom navigation bar with 4 tabs, visible only on mobile screens (hidden at `md` breakpoint and above). Uses React Router's `NavLink` for active state detection.

- [ ] **Step 1: Create the file**

Create `src/components/BottomNav.jsx` with this content:

```jsx
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/',        label: 'This Week', icon: '🗓', end: true  },
  { to: '/recipes', label: 'Recipes',   icon: '🍳', end: false },
  { to: '/grocery', label: 'Grocery',   icon: '🛒', end: false },
  { to: '/manage',  label: 'Catalog',   icon: '📋', end: false },
]

export function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-willow-mist border-t border-willow-mist/70 shadow-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs font-bold tracking-wide transition-colors ${
                isActive ? 'text-garden-patch' : 'text-stone-grey'
              }`
            }
          >
            <span className="text-xl leading-tight">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

Note: `end: true` on the home tab is required — without it, NavLink for `"/"` would match every route (since every path starts with `/`).

Note: `paddingBottom: 'env(safe-area-inset-bottom)'` as an inline style rather than a Tailwind class because Tailwind v3 doesn't support `env()` values in `pb-[]` arbitrary syntax without extra config.

- [ ] **Step 2: Verify it renders**

Run `npm run dev`. Open Chrome DevTools, switch to a mobile device profile (e.g. iPhone 12). Navigate between pages — the bottom bar should appear with the correct active tab highlighted in `garden-patch` green.

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomNav.jsx
git commit -m "feat: add BottomNav component for mobile navigation"
```

---

## Task 3: Wire BottomNav into App.jsx

**Files:**
- Modify: `src/App.jsx`

Three changes: (1) hide the top nav links on mobile, (2) render BottomNav, (3) add bottom padding to `<main>` so content doesn't hide under the nav bar.

- [ ] **Step 1: Update App.jsx**

Replace the entire content of `src/App.jsx` with:

```jsx
import { Routes, Route, NavLink } from 'react-router-dom'
import { ConnectionBanner } from './components/ConnectionBanner'
import { BottomNav } from './components/BottomNav'
import PlannerPage from './pages/PlannerPage'
import RecipesPage from './pages/RecipesPage'
import ManagePage from './pages/ManagePage'
import GroceryPage from './pages/GroceryPage'

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-pill text-sm font-bold tracking-wide transition-colors ${
          isActive
            ? 'bg-garden-patch text-fresh-herb'
            : 'text-stone-grey hover:text-soil-shadow'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-field-cream font-body text-soil-shadow">
      <ConnectionBanner />
      <nav className="bg-willow-mist shadow-card px-6 py-4 flex items-center gap-3">
        <span className="font-display font-light text-2xl tracking-tight text-garden-patch mr-4">
          Dinner Planner
        </span>
        <div className="hidden md:flex items-center gap-3">
          <NavItem to="/" label="This Week" />
          <NavItem to="/recipes" label="Recipes" />
          <NavItem to="/grocery" label="Grocery List" />
          <NavItem to="/manage" label="Catalog" />
        </div>
      </nav>
      <main className="max-w-4xl mx-auto pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<PlannerPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/grocery" element={<GroceryPage />} />
          <Route path="/manage" element={<ManagePage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
```

Key changes from the original:
- Top nav `NavItem` elements wrapped in `<div className="hidden md:flex items-center gap-3">` — invisible on mobile
- `<main>` gets `pb-16 md:pb-0` — 64px bottom padding on mobile clears the BottomNav, none on desktop
- `<BottomNav />` rendered after `<main>` (it's `fixed` so position in DOM doesn't matter visually)

- [ ] **Step 2: Verify**

Run `npm run dev`. In mobile view: only the wordmark shows in the top bar; the bottom nav has 4 tabs; tapping tabs navigates correctly; active tab is green. In desktop view (≥768px): bottom nav is gone; top nav links are visible.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: show BottomNav on mobile, hide top nav links below md breakpoint"
```

---

## Task 4: Fix GroceryList Scroll Trap

**Files:**
- Modify: `src/components/GroceryList.jsx`

The inner `max-h-[60vh] overflow-y-auto` div creates a scroll-within-scroll on mobile. Removing it lets the page scroll naturally. The outer card's `overflow-hidden` (set in `GroceryPage.jsx`) still clips the rounded corners.

- [ ] **Step 1: Remove the scroll trap**

In `src/components/GroceryList.jsx`, find the div at line 57:

```jsx
<div className="max-h-[60vh] overflow-y-auto px-6 py-5">
```

Change it to:

```jsx
<div className="px-4 py-4 sm:px-6 sm:py-5">
```

This removes the height cap and internal scroll, and tightens the padding on mobile.

- [ ] **Step 2: Verify**

In mobile view, open the Grocery page with several items. Scroll down — the whole page should scroll smoothly, not the inner box. Verify store columns still display correctly.

- [ ] **Step 3: Commit**

```bash
git add src/components/GroceryList.jsx
git commit -m "fix: remove GroceryList scroll trap and tighten mobile padding"
```

---

## Task 5: PlannerShell + PlannerPage Padding

**Files:**
- Modify: `src/components/PlannerShell.jsx`
- Modify: `src/pages/PlannerPage.jsx`

- [ ] **Step 1: Update PlannerShell outer padding**

In `src/components/PlannerShell.jsx`, find line 31:

```jsx
<div className="p-6 max-w-2xl mx-auto">
```

Change to:

```jsx
<div className="p-3 sm:p-6 max-w-2xl mx-auto">
```

- [ ] **Step 2: Update PlannerPage phase panel padding**

In `src/pages/PlannerPage.jsx`, there are two identical inner panels (lines 90 and 100):

```jsx
<div className="max-w-md mx-auto p-8">
```

Change **both** occurrences to:

```jsx
<div className="max-w-md mx-auto p-4 sm:p-8">
```

- [ ] **Step 3: Verify**

In mobile view, open the Planner page (This Week). Check all three phases (Staples, Pantry, Plan) — content should have comfortable but not excessive padding. No content should be cut off.

- [ ] **Step 4: Commit**

```bash
git add src/components/PlannerShell.jsx src/pages/PlannerPage.jsx
git commit -m "fix: tighten PlannerShell and PlannerPage padding on mobile"
```

---

## Task 6: GroceryPage Padding

**Files:**
- Modify: `src/pages/GroceryPage.jsx`

Three padding adjustments within the page.

- [ ] **Step 1: Update GroceryPage wrapper**

In `src/pages/GroceryPage.jsx`, find line 102:

```jsx
<div className="max-w-4xl mx-auto p-6">
```

Change to:

```jsx
<div className="max-w-4xl mx-auto p-3 sm:p-6">
```

- [ ] **Step 2: Update the card header padding**

Find line 106:

```jsx
<div className="px-6 py-5 border-b border-willow-mist flex items-center justify-between gap-4">
```

Change to:

```jsx
<div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-willow-mist flex items-center justify-between gap-4">
```

- [ ] **Step 3: Update the search section padding**

Find line 118:

```jsx
<div className="px-6 py-4 border-b border-willow-mist">
```

Change to:

```jsx
<div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-willow-mist">
```

- [ ] **Step 4: Verify**

In mobile view, open the Grocery page. The card should reach close to the screen edges. The header, search bar, and list should all have sensible padding.

- [ ] **Step 5: Commit**

```bash
git add src/pages/GroceryPage.jsx
git commit -m "fix: tighten GroceryPage padding on mobile"
```

---

## Task 7: RecipesPage Padding + Chip Tap Targets

**Files:**
- Modify: `src/pages/RecipesPage.jsx`

Two changes: tighter wrapper padding, and a larger tap target on the `×` remove buttons inside ingredient chips.

- [ ] **Step 1: Update wrapper padding**

In `src/pages/RecipesPage.jsx`, find line 62:

```jsx
<div className="p-6 max-w-3xl mx-auto">
```

Change to:

```jsx
<div className="p-3 sm:p-6 max-w-3xl mx-auto">
```

- [ ] **Step 2: Enlarge chip × tap targets**

Find the `×` button inside the ingredient chip map (around line 181). The current button:

```jsx
<button
  type="button"
  onClick={() => handleRemoveIngredient(recipe, ing.id)}
  className="text-stone-grey/50 hover:text-red-500 leading-none transition-colors"
  aria-label={`Remove ${ing.name}`}
>
  ×
</button>
```

Change to:

```jsx
<button
  type="button"
  onClick={() => handleRemoveIngredient(recipe, ing.id)}
  className="text-stone-grey/50 hover:text-red-500 leading-none transition-colors p-1 -m-1"
  aria-label={`Remove ${ing.name}`}
>
  ×
</button>
```

`p-1 -m-1` adds padding (enlarging the tap area) while the negative margin cancels any layout shift.

- [ ] **Step 3: Verify**

In mobile view, open the Recipes page. The page should sit closer to screen edges. Tap a `×` on an ingredient chip — it should be easy to hit without tapping the wrong thing.

- [ ] **Step 4: Commit**

```bash
git add src/pages/RecipesPage.jsx
git commit -m "fix: tighten RecipesPage padding and enlarge ingredient chip tap targets"
```

---

## Task 8: ManagePage Padding + Action Button Wrapping

**Files:**
- Modify: `src/pages/ManagePage.jsx`

Three changes: wrapper padding, tab content padding, and making the action button group wrap below the item name on narrow screens.

- [ ] **Step 1: Update wrapper padding**

In `src/pages/ManagePage.jsx`, find line 141:

```jsx
<div className="p-6 max-w-2xl mx-auto">
```

Change to:

```jsx
<div className="p-3 sm:p-6 max-w-2xl mx-auto">
```

- [ ] **Step 2: Update tab content padding**

Find line 167:

```jsx
<div className="p-6 space-y-4">
```

Change to:

```jsx
<div className="p-4 sm:p-6 space-y-4">
```

- [ ] **Step 3: Fix staple row action buttons**

The staple list items (in the non-editing state) have this layout around line 199:

```jsx
<div className="flex items-center justify-between">
  <div>
    <span className="font-bold text-soil-shadow">{s.name}</span>
    <span className="text-xs text-stone-grey ml-2">{STORES.find(st => st.value === s.store)?.label}</span>
    {s.notes && <span className="text-xs text-stone-grey ml-2">— {s.notes}</span>}
  </div>
  <div className="flex gap-3">
    <button onClick={() => setEditingStaple(s)} className="text-garden-patch text-sm font-bold hover:underline">Edit</button>
    <button onClick={() => handleMoveToIngredients(s)} className="text-stone-grey hover:text-soil-shadow text-sm font-bold transition-colors">→ Ingredients</button>
    <button onClick={() => handleDeleteStaple(s.id)} className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors">Remove</button>
  </div>
</div>
```

Change the outer div class from `flex items-center justify-between` to `flex flex-wrap items-center justify-between gap-y-2`:

```jsx
<div className="flex flex-wrap items-center justify-between gap-y-2">
  <div>
    <span className="font-bold text-soil-shadow">{s.name}</span>
    <span className="text-xs text-stone-grey ml-2">{STORES.find(st => st.value === s.store)?.label}</span>
    {s.notes && <span className="text-xs text-stone-grey ml-2">— {s.notes}</span>}
  </div>
  <div className="flex gap-3">
    <button onClick={() => setEditingStaple(s)} className="text-garden-patch text-sm font-bold hover:underline">Edit</button>
    <button onClick={() => handleMoveToIngredients(s)} className="text-stone-grey hover:text-soil-shadow text-sm font-bold transition-colors">→ Ingredients</button>
    <button onClick={() => handleDeleteStaple(s.id)} className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors">Remove</button>
  </div>
</div>
```

- [ ] **Step 4: Fix ingredient row action buttons**

The ingredient list items (in the non-editing state) have the same pattern around line 277:

```jsx
<div className="flex items-center justify-between">
  <div>
    <span className="font-bold text-soil-shadow">{ing.name}</span>
    <span className="text-xs text-stone-grey ml-2">{STORES.find(st => st.value === ing.store)?.label}</span>
  </div>
  <div className="flex gap-3">
    <button onClick={() => setEditingIngredient(ing)} className="text-garden-patch text-sm font-bold hover:underline">Edit</button>
    <button onClick={() => handleMoveToStaples(ing)} className="text-stone-grey hover:text-soil-shadow text-sm font-bold transition-colors">→ Staples</button>
    <button onClick={() => handleDeleteIngredient(ing.id)} className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors">Remove</button>
  </div>
</div>
```

Change the outer div class from `flex items-center justify-between` to `flex flex-wrap items-center justify-between gap-y-2`:

```jsx
<div className="flex flex-wrap items-center justify-between gap-y-2">
  <div>
    <span className="font-bold text-soil-shadow">{ing.name}</span>
    <span className="text-xs text-stone-grey ml-2">{STORES.find(st => st.value === ing.store)?.label}</span>
  </div>
  <div className="flex gap-3">
    <button onClick={() => setEditingIngredient(ing)} className="text-garden-patch text-sm font-bold hover:underline">Edit</button>
    <button onClick={() => handleMoveToStaples(ing)} className="text-stone-grey hover:text-soil-shadow text-sm font-bold transition-colors">→ Staples</button>
    <button onClick={() => handleDeleteIngredient(ing.id)} className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors">Remove</button>
  </div>
</div>
```

- [ ] **Step 5: Verify**

In mobile view, open the Catalog page. Check the Staples and Ingredients tabs. Each item row should show the name/store on one line and the action buttons either inline (if space permits) or wrapped below. The buttons should never overflow the card.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ManagePage.jsx
git commit -m "fix: tighten ManagePage padding and allow action buttons to wrap on mobile"
```
