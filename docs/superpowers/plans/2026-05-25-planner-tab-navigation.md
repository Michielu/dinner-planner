# Planner Tab Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-way Staples → Pantry → Plan → Grocery wizard with a freely-navigable tab bar inside a single unified card.

**Architecture:** A new `PlannerShell` component owns the card wrapper and tab bar, receiving `phase`, `visitedPhases`, and `onNavigate` as props. `PlannerPage` adds `visitedPhases` state and passes it down. `GroceryList` becomes an inline content block instead of a fixed overlay.

**Tech Stack:** React 18, Tailwind CSS (custom design tokens), Vite, Vitest (node environment — component tests not available, test pure logic only)

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/PlannerShell.jsx` | Tab bar + unified card wrapper |
| Create | `src/utils/tabState.js` | Pure `getTabState()` function (testable) |
| Create | `tests/utils/tabState.test.js` | Tests for `getTabState()` |
| Modify | `src/components/GroceryList.jsx` | Remove overlay; become inline content block |
| Modify | `src/components/StapleChecker.jsx` | Strip outer card wrapper; update step label "1 of 2" → "1 of 4" |
| Modify | `src/components/PantryInput.jsx` | Strip outer card wrapper; update step label "2 of 2" → "2 of 4" |
| Modify | `src/pages/PlannerPage.jsx` | Add `visitedPhases` state; use `PlannerShell`; remove overlay pattern |

---

### Task 1: Pure tab state utility + tests

The tab bar needs to know whether each tab is `'active'`, `'visited'`, or `'unvisited'`. Extract this as a testable pure function before touching any components.

**Files:**
- Create: `src/utils/tabState.js`
- Create: `tests/utils/tabState.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/tabState.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { getTabState } from '../../src/utils/tabState.js'

describe('getTabState', () => {
  it('returns active for the current phase', () => {
    expect(getTabState('plan', 'plan', new Set(['staples', 'pantry', 'plan']))).toBe('active')
  })

  it('returns visited for a phase in visitedPhases that is not current', () => {
    expect(getTabState('staples', 'plan', new Set(['staples', 'pantry', 'plan']))).toBe('visited')
  })

  it('returns unvisited for a phase not in visitedPhases', () => {
    expect(getTabState('grocery', 'plan', new Set(['staples', 'plan']))).toBe('unvisited')
  })

  it('active takes priority over visited (current phase is always in visitedPhases)', () => {
    expect(getTabState('staples', 'staples', new Set(['staples']))).toBe('active')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/michielu/code/dinner-planner && npm test -- tests/utils/tabState.test.js
```

Expected: FAIL — `Cannot find module '../../src/utils/tabState.js'`

- [ ] **Step 3: Implement `getTabState`**

Create `src/utils/tabState.js`:

```js
/**
 * Returns the display state for a planner tab.
 *
 * @param {string} tab - The tab to evaluate ('staples' | 'pantry' | 'plan' | 'grocery')
 * @param {string} currentPhase - The currently active phase
 * @param {Set<string>} visitedPhases - Phases the user has reached at least once
 * @returns {'active' | 'visited' | 'unvisited'}
 */
export function getTabState(tab, currentPhase, visitedPhases) {
  if (tab === currentPhase) return 'active'
  if (visitedPhases.has(tab)) return 'visited'
  return 'unvisited'
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/michielu/code/dinner-planner && npm test -- tests/utils/tabState.test.js
```

Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/utils/tabState.js tests/utils/tabState.test.js
git commit -m "feat: add getTabState pure utility for planner tab bar"
```

---

### Task 2: PlannerShell component

The unified card wrapper with the tab bar. Accepts the current phase, visited set, and a navigation callback. Renders children inside the card body.

**Files:**
- Create: `src/components/PlannerShell.jsx`

The four tabs in order:
```js
const TABS = [
  { key: 'staples', label: 'Staples' },
  { key: 'pantry',  label: 'Pantry'  },
  { key: 'plan',    label: 'Plan'    },
  { key: 'grocery', label: 'Grocery' },
]
```

Tab bar CSS rules (Tailwind):
- **Outer bar:** `flex border-b-2 border-willow-mist bg-willow-mist/50`
- **Active tab button:** `flex-1 py-3 text-xs font-bold tracking-wide text-garden-patch border-b-2 border-garden-patch -mb-0.5 bg-fresh-herb/10 transition-colors`
- **Visited tab button:** `flex-1 py-3 text-xs font-bold tracking-wide text-garden-patch hover:text-soil-shadow transition-colors`
- **Unvisited tab button:** `flex-1 py-3 text-xs font-bold tracking-wide text-stone-grey hover:text-soil-shadow transition-colors`

- [ ] **Step 1: Create PlannerShell**

Create `src/components/PlannerShell.jsx`:

```jsx
import { getTabState } from '../utils/tabState'

const TABS = [
  { key: 'staples', label: 'Staples' },
  { key: 'pantry',  label: 'Pantry'  },
  { key: 'plan',    label: 'Plan'    },
  { key: 'grocery', label: 'Grocery' },
]

function tabClass(state) {
  const base = 'flex-1 py-3 text-xs font-bold tracking-wide transition-colors'
  if (state === 'active')
    return `${base} text-garden-patch border-b-2 border-garden-patch -mb-0.5 bg-fresh-herb/10`
  if (state === 'visited')
    return `${base} text-garden-patch hover:text-soil-shadow`
  return `${base} text-stone-grey hover:text-soil-shadow`
}

function tabLabel(label, state) {
  return state === 'visited' ? `✓ ${label}` : label
}

/**
 * Props:
 *   phase: 'staples' | 'pantry' | 'plan' | 'grocery'
 *   visitedPhases: Set<string>
 *   onNavigate: (phase: string) => void
 *   children: React.ReactNode
 */
export function PlannerShell({ phase, visitedPhases, onNavigate, children }) {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-willow-mist rounded-card shadow-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b-2 border-willow-mist bg-willow-mist/50">
          {TABS.map(tab => {
            const state = getTabState(tab.key, phase, visitedPhases)
            return (
              <button
                key={tab.key}
                onClick={() => onNavigate(tab.key)}
                className={tabClass(state)}
              >
                {tabLabel(tab.label, state)}
              </button>
            )
          })}
        </div>

        {/* Step content */}
        <div>
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file is importable (quick sanity check)**

```bash
cd /Users/michielu/code/dinner-planner && npm run build 2>&1 | head -20
```

Expected: build succeeds (PlannerShell isn't wired in yet, so no import errors)

- [ ] **Step 3: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/components/PlannerShell.jsx
git commit -m "feat: add PlannerShell tab bar wrapper component"
```

---

### Task 3: Strip GroceryList overlay

Remove the `fixed inset-0` backdrop wrapper and the close button/`onClose` prop. The component becomes a plain scrollable block that renders inline inside the card.

**Files:**
- Modify: `src/components/GroceryList.jsx`

- [ ] **Step 1: Rewrite GroceryList**

Replace the entire contents of `src/components/GroceryList.jsx` with:

```jsx
import { useState } from 'react'
import { generateGroceryList } from '../utils/groceryList'

const STORE_CONFIG = [
  { key: 'sams_club', label: "Sam's Club" },
  { key: 'aldi',     label: 'Aldi' },
  { key: 'target',   label: 'Target' },
]

/**
 * Props:
 *   slots: Record<string, {type, recipe?: {id, name}} | null>
 *   recipes: Array<{id, name, ingredients: [{id, name, store}]}>
 *   staples: Array<{id, name, store, notes}>
 */
export function GroceryList({ slots, recipes, staples }) {
  const [copyStatus, setCopyStatus] = useState(null) // null | 'copied' | 'error'

  const slotArray = Object.entries(slots)
    .filter(([, slot]) => slot !== null)
    .map(([day, slot]) => ({ day, ...slot, recipeId: slot?.recipe?.id }))

  const list = generateGroceryList(slotArray, recipes, staples)
  const total = Object.values(list).reduce((sum, items) => sum + items.length, 0)

  async function copyList() {
    const lines = STORE_CONFIG
      .filter(s => list[s.key].length > 0)
      .flatMap(s => [
        s.label,
        ...list[s.key].map(i => `  □ ${i.name}${i.isStaple ? ' ★' : ''}`),
        '',
      ])
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(null), 2000)
    } catch {
      setCopyStatus('error')
      setTimeout(() => setCopyStatus(null), 3000)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="px-6 py-5 border-b border-willow-mist">
        <h2 className="font-display font-light text-3xl tracking-tight text-soil-shadow">Grocery List</h2>
      </div>

      <div className="overflow-y-auto px-6 py-5">
        {total === 0 ? (
          <p className="text-center text-stone-grey py-8">No meals planned yet — nothing to buy.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STORE_CONFIG.map(store => (
              <div key={store.key}>
                <h3 className="font-bold text-xs text-garden-patch mb-3 uppercase tracking-widest">{store.label}</h3>
                {list[store.key].length === 0 ? (
                  <p className="text-xs text-stone-grey/50">Nothing from here</p>
                ) : (
                  <ul className="space-y-2">
                    {list[store.key].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-stone-grey mt-0.5 shrink-0">□</span>
                        <span>
                          <span className="text-sm font-bold text-soil-shadow">{item.name}</span>
                          {item.isStaple && (
                            <span className="ml-1 text-xs text-fresh-herb font-bold">★</span>
                          )}
                          {item.notes && (
                            <span className="block text-xs text-stone-grey">{item.notes}</span>
                          )}
                          {!item.isStaple && item.meals && item.meals.length > 0 && (
                            <span className="block text-xs text-stone-grey">{item.meals.join(', ')}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        {total > 0 && (
          <p className="text-xs text-stone-grey mt-6">★ staple — check if you have enough</p>
        )}
      </div>

      <div className="px-6 py-4 border-t border-willow-mist flex gap-3 justify-end">
        <button
          onClick={copyList}
          className={`px-5 py-2.5 text-sm font-bold rounded-pill shadow-card transition-opacity ${
            copyStatus === 'error'
              ? 'bg-red-400 text-white'
              : 'bg-fresh-herb text-soil-shadow hover:opacity-90'
          }`}
        >
          {copyStatus === 'copied' ? '✓ Copied!' : copyStatus === 'error' ? 'Copy failed' : '📋 Copy list'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the existing tests to make sure nothing broke**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: all tests pass (GroceryList has no unit tests; groceryList utility tests still pass)

- [ ] **Step 3: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/components/GroceryList.jsx
git commit -m "refactor: convert GroceryList from overlay to inline content block"
```

---

### Task 4: Strip outer card from StapleChecker and PantryInput; update step labels

Both components currently wrap themselves in a standalone card (`bg-willow-mist rounded-card shadow-card`). Inside PlannerShell's card they'd create a nested card-within-a-card. Remove those outer wrappers — PlannerPage provides centering. Also update step labels from "of 2" to "of 4".

**Files:**
- Modify: `src/components/StapleChecker.jsx`
- Modify: `src/components/PantryInput.jsx`

- [ ] **Step 1: Update StapleChecker — strip outer card wrapper and update step label**

In `src/components/StapleChecker.jsx`, the `return` statement currently opens with a card div. Replace it with a plain fragment:

```jsx
// Before (line 70-72):
  return (
    <div className="max-w-md mx-auto mt-16 bg-willow-mist rounded-card p-8 shadow-card">
      <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Step 1 of 2</p>
```

```jsx
// After:
  return (
    <>
      <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Step 1 of 4</p>
```

Also replace the closing tag. The component currently ends with:

```jsx
    </div>
  )
}
```

Replace with:

```jsx
    </>
  )
}
```

- [ ] **Step 2: Update PantryInput — strip outer card wrapper and update step label**

In `src/components/PantryInput.jsx`, the `return` statement currently opens with a card div. Replace it:

```jsx
// Before (line 61-63):
  return (
    <div className="max-w-md mx-auto mt-10 bg-willow-mist rounded-card p-8 shadow-card">
      <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Step 2 of 2</p>
```

```jsx
// After:
  return (
    <>
      <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Step 2 of 4</p>
```

Also replace the closing tag at the end of PantryInput's return:

```jsx
    </div>
  )
}
```

Replace with:

```jsx
    </>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/components/StapleChecker.jsx src/components/PantryInput.jsx
git commit -m "refactor: remove standalone card wrappers from StapleChecker and PantryInput; update step labels to 'of 4'"
```

---

### Task 5: Wire up PlannerPage

Replace the old phase-conditional rendering (two full-page cards + overlay) with `PlannerShell` wrapping all four steps inline. Add `visitedPhases` state and thread `onNavigate` through.

**Files:**
- Modify: `src/pages/PlannerPage.jsx`

- [ ] **Step 1: Rewrite PlannerPage**

Replace the entire contents of `src/pages/PlannerPage.jsx` with:

```jsx
import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { PlannerShell } from '../components/PlannerShell'
import { StapleChecker } from '../components/StapleChecker'
import { PantryInput } from '../components/PantryInput'
import { WeekGrid } from '../components/WeekGrid'
import { RecipePicker } from '../components/RecipePicker'
import { GroceryList } from '../components/GroceryList'

const EMPTY_SLOTS = {
  monday: null, tuesday: null, wednesday: null,
  thursday: null, friday: null, saturday: null, sunday: null,
}

export default function PlannerPage() {
  const { recipes, categories, loading } = useRecipes()

  // phase: 'staples' | 'pantry' | 'plan' | 'grocery'
  const [phase, setPhase] = useState('staples')
  const [visitedPhases, setVisitedPhases] = useState(new Set(['staples']))
  const [selectedStaples, setSelectedStaples] = useState([])
  const [pantryItems, setPantryItems] = useState([])
  const [slots, setSlots] = useState(EMPTY_SLOTS)
  const [activeDay, setActiveDay] = useState(null)

  function navigate(nextPhase) {
    setPhase(nextPhase)
    setVisitedPhases(prev => new Set([...prev, nextPhase]))
  }

  function handleStaplesNext(chosen) {
    setSelectedStaples(chosen)
    navigate('pantry')
  }

  function handlePantryStart(items) {
    setPantryItems(items)
    navigate('plan')
  }

  function handleSlotClick(day) {
    setActiveDay(day)
  }

  function handleSelect(slot) {
    setSlots(prev => ({ ...prev, [activeDay]: slot }))
    setActiveDay(null)
  }

  function handleReset() {
    setSlots(EMPTY_SLOTS)
    setPantryItems([])
    setSelectedStaples([])
    setActiveDay(null)
    setPhase('staples')
    setVisitedPhases(new Set(['staples']))
  }

  if (loading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  return (
    <PlannerShell phase={phase} visitedPhases={visitedPhases} onNavigate={navigate}>
      {activeDay && (
        <RecipePicker
          recipes={recipes}
          categories={categories}
          pantryItems={pantryItems.map(i => i.name)}
          onSelect={handleSelect}
          onClose={() => setActiveDay(null)}
          day={activeDay}
        />
      )}

      {phase === 'staples' && (
        <div className="max-w-md mx-auto p-8">
          <StapleChecker onNext={handleStaplesNext} />
        </div>
      )}

      {phase === 'pantry' && (
        <div className="max-w-md mx-auto p-8">
          <PantryInput onStart={handlePantryStart} />
        </div>
      )}

      {phase === 'plan' && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow">This Week</h1>
              {pantryItems.length > 0 && (
                <p className="text-sm text-garden-patch mt-0.5 font-bold">
                  Using up: {pantryItems.map(i => i.name).join(', ')}
                </p>
              )}
            </div>
            <button onClick={handleReset} className="text-sm text-stone-grey hover:text-soil-shadow font-bold">
              ↺ Start over
            </button>
          </div>

          <WeekGrid slots={slots} onSlotClick={handleSlotClick} />

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => navigate('grocery')}
              className="bg-fresh-herb text-soil-shadow font-bold px-8 py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
            >
              Grocery list →
            </button>
          </div>
        </div>
      )}

      {phase === 'grocery' && (
        <GroceryList
          slots={slots}
          recipes={recipes}
          staples={selectedStaples}
        />
      )}
    </PlannerShell>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: all tests pass

- [ ] **Step 3: Build to catch any import/JSX errors**

```bash
cd /Users/michielu/code/dinner-planner && npm run build 2>&1 | tail -20
```

Expected: build completes with no errors

- [ ] **Step 4: Smoke test in the browser**

```bash
cd /Users/michielu/code/dinner-planner && npm run dev
```

Open http://localhost:5173 and verify:
- All four tabs are visible in a unified card
- Clicking any tab navigates freely — no forced order
- Staples tab: checkboxes work, "Next: Pantry →" button advances and marks Pantry visited
- Pantry tab: search/select works, "Let's plan →" advances to Plan
- Plan tab: week grid is clickable, recipe picker opens, "Grocery list →" button navigates to Grocery tab
- Grocery tab: 3-column list renders inline (no overlay), Copy button works
- Start over resets everything and returns to Staples tab
- Visited tabs show ✓ prefix in green; unvisited tabs are grey

- [ ] **Step 5: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/pages/PlannerPage.jsx
git commit -m "feat: replace linear wizard with freely-navigable tab bar in PlannerPage"
```
