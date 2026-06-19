# Planner Tab Navigation

**Date:** 2026-05-25  
**Status:** Approved

## Problem

The "This Week" planner forces a strict one-way flow: Staples → Pantry → Plan → Grocery. There is no way to navigate back or jump between steps without hitting "Start over". This makes it clunky to revisit selections mid-session.

## Design

### Navigation style

A **tab bar** sits at the top of a single unified card that wraps all four planner steps. All tabs are always clickable — the user can jump freely in any direction at any time with no gates.

Tab states:
- **Unvisited** (grey text) — not yet reached, but still clickable
- **Visited** (green text + ✓ prefix) — has been reached at least once
- **Active** (dark green text + bold bottom underline + subtle green background tint) — currently shown

Tabs: `Staples | Pantry | Plan | Grocery`

### Unified card layout

All four steps share one card (`max-w-2xl`, `bg-willow-mist`, `rounded-card`, `shadow-card`). The tab bar is flush to the top of the card. Content area below the tabs swaps on tab click.

Staples and Pantry content is centered in a `max-w-md` inner column inside the wider card — no visual change to those steps.

### State preservation

All state (`selectedStaples`, `pantryItems`, `slots`) already lives in `PlannerPage`. Switching tabs simply changes `phase` — no state is reset. Navigating back to Staples shows your previous selections intact.

### Grocery list

`GroceryList` moves from a fixed overlay to being the inline content of the Grocery tab. The backdrop, close button (×), and `onClose` prop are removed. The component renders directly inside the card's content area.

The "Generate grocery list →" button in the Plan tab remains as a shortcut that switches to the Grocery tab.

### Visited tracking

A `Set<phase>` called `visitedPhases` tracks which steps have been reached. It initialises as `new Set(['staples'])` since Staples is always the first phase shown. A phase is added to the set whenever `setPhase()` is called. This drives the ✓ prefix and green colour on tabs.

### "Start over" button

Stays in the Plan tab header (top-right, small grey text). Resets all state and navigates back to the Staples tab.

### Step labels

The "Step 1 of 2" / "Step 2 of 2" labels inside StapleChecker and PantryInput update to "Step 1 of 4" / "Step 2 of 4" to match the expanded flow.

## Components changed

| File | Change |
|------|--------|
| `src/pages/PlannerPage.jsx` | Add `visitedPhases` state; replace phase-conditional rendering with a `PlannerShell` wrapper; remove GroceryList overlay pattern; wire "Grocery list →" button to `setPhase('grocery')` |
| `src/components/GroceryList.jsx` | Remove `fixed inset-0` overlay wrapper and backdrop; remove `onClose` prop and close button; render as plain scrollable content block |
| `src/components/StapleChecker.jsx` | Update step label from "Step 1 of 2" to "Step 1 of 4" |
| `src/components/PantryInput.jsx` | Update step label from "Step 2 of 2" to "Step 2 of 4" |

A new `PlannerShell` component at `src/components/PlannerShell.jsx` owns the tab bar and card wrapper, and accepts `phase`, `visitedPhases`, and `onNavigate` as props.

## What does not change

- All data fetching and mutation hooks (`useRecipes`, `useStaples`, `useIngredients`) — untouched
- RecipePicker modal behaviour — untouched
- The Recipes and Manage pages — untouched
- Grocery list content and layout (3-column, checkboxes, ★ staples, Copy button) — preserved exactly
