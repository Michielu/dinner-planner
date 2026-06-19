# Mobile Responsive Design

**Date:** 2026-06-19  
**Status:** Approved

## Goal

Make every screen of the Dinner Planner fully usable on a mobile phone without changing the tech stack (React + Tailwind v3 + React Router v7).

## Scope

Six targeted changes. No new libraries, no routing changes, no feature changes.

---

## 1. Navigation: Bottom Tab Bar

### What changes

- New `src/components/BottomNav.jsx` — fixed bottom bar with 4 tabs, visible only on mobile (`md:hidden`)
- `App.jsx` top nav links hidden on mobile (`hidden md:flex`); the "Dinner Planner" wordmark remains visible at all sizes
- `<main>` in `App.jsx` gets `pb-16 md:pb-0` so content clears the bottom nav

### BottomNav design

- Fixed to the bottom of the viewport: `fixed bottom-0 left-0 right-0 z-50`
- Background: `bg-willow-mist`, top border: `border-t border-willow-mist/70`, shadow: `shadow-card`
- Safe-area inset for iOS home indicator: `pb-[env(safe-area-inset-bottom)]`
- 4 equal-width tabs in a `flex` row
- Each tab: icon (emoji) + label, `flex-col items-center`, `py-2 text-xs font-bold`
- Active state: `text-garden-patch`; inactive: `text-stone-grey`

Tabs:
| Label | Icon | Route |
|-------|------|-------|
| This Week | 🗓 | `/` |
| Recipes | 🍳 | `/recipes` |
| Grocery | 🛒 | `/grocery` |
| Catalog | 📋 | `/manage` |

---

## 2. Spacing & Padding

Reduce outer padding on mobile across all pages and components. All changes use the `sm:` breakpoint (640px) to restore desktop padding.

| Location | Current | Mobile fix |
|---|---|---|
| `PlannerShell` wrapper | `p-6` | `p-3 sm:p-6` |
| Planner phase panels (`max-w-md mx-auto`) | `p-8` | `p-4 sm:p-8` |
| `GroceryPage` wrapper | `p-6` | `p-3 sm:p-6` |
| `GroceryPage` card header | `px-6 py-5` | `px-4 py-4 sm:px-6 sm:py-5` |
| `GroceryPage` search section | `px-6 py-4` | `px-4 py-3 sm:px-6 sm:py-4` |
| `RecipesPage` wrapper | `p-6` | `p-3 sm:p-6` |
| `ManagePage` wrapper | `p-6` | `p-3 sm:p-6` |
| `ManagePage` tab content | `p-6` | `p-4 sm:p-6` |
| `GroceryList` store grid area | `px-6 py-5` | `px-4 py-4 sm:px-6 sm:py-5` |

---

## 3. iOS Input Zoom Fix

iOS Safari zooms in when a focused input/select has `font-size < 16px`. All inputs in this app use Tailwind's `text-sm` (14px), triggering this.

**Fix:** Add one rule to `src/index.css`:

```css
@media (max-width: 768px) {
  input, select, textarea {
    font-size: 16px;
  }
}
```

No visual change on desktop.

---

## 4. Touch Targets & Action Button Layout

### Ingredient/staple row actions (ManagePage)

Current layout: `flex items-center justify-between` with name on left, `[Edit] [→ Ingredients] [Remove]` buttons on right. On narrow screens these buttons get cramped.

Fix: make the action row wrap below the item info on mobile.

Change the list item inner div from:
```
flex items-center justify-between
```
to:
```
flex flex-wrap items-center justify-between gap-y-2
```

The button group itself stays `flex gap-3` — it will wrap to a new line on small screens because the parent allows wrapping.

### Remove buttons on ingredient chips (RecipesPage)

The `×` buttons on ingredient tags get `p-1` added to enlarge the tap area without changing visual size.

---

## 5. GroceryList Scroll Trap

`max-h-[60vh] overflow-y-auto` on the store grid creates a scroll-within-scroll on mobile — users get stuck scrolling the inner box instead of the page.

**Fix:** Remove `max-h-[60vh] overflow-y-auto` from the inner div. The page itself scrolls naturally. The `GroceryPage` card (`overflow-hidden`) still clips rounded corners correctly.

---

## 6. RecipePicker (no change needed)

Already `w-full max-w-sm` — on phones narrower than 384px it fills the screen. The fixed overlay with `flex justify-end` works correctly on mobile. No changes required.

---

## Files Changed

| File | Change type |
|------|-------------|
| `src/components/BottomNav.jsx` | **New** |
| `src/App.jsx` | Nav visibility, main padding |
| `src/index.css` | iOS input zoom fix |
| `src/components/PlannerShell.jsx` | Padding |
| `src/pages/PlannerPage.jsx` | Phase panel padding |
| `src/pages/RecipesPage.jsx` | Wrapper padding, chip tap targets |
| `src/pages/GroceryPage.jsx` | Padding |
| `src/pages/ManagePage.jsx` | Padding, action button wrapping |
| `src/components/GroceryList.jsx` | Remove scroll trap |

---

## Non-Goals

- PWA / home screen installation (separate effort)
- Dark mode
- Any layout changes on desktop (all fixes are `sm:` prefixed or `md:hidden`/`md:flex`)
- RecipePicker redesign
