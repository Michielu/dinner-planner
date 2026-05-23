# Dinner Planner — Design Spec
*2026-05-22*

## Problem

Weekly dinner planning takes roughly an hour. The planner (wife) mentally juggles what food needs using up, which meal types to cover, and what to buy from which store. This app compresses that session into a fast, guided flow.

---

## Goals

- Cut weekly dinner planning from ~1 hour to ~10–15 minutes
- Surface recipes that match what's already in the fridge/pantry
- Auto-generate a grocery list split by store (Sam's Club, Aldi, Target)
- Work well on desktop and kitchen tablet; also usable on phone

---

## Non-Goals

- No login / user accounts (private URL is sufficient for a household app)
- No full recipe instructions — just name + ingredients
- No pantry inventory management — just a quick weekly "what needs using up" prompt
- No AI suggestions — filter/highlight existing recipes only

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React |
| Routing | React Router v6 |
| Styling | TailwindCSS |
| Backend / DB | Supabase (Postgres + JS client) |
| Hosting | Vercel or Netlify (free tier) |

No backend code to write. The Supabase JS client talks directly to the database from the browser. Row-level security can be configured in the Supabase dashboard later if needed.

---

## Data Model

### Persistent (Supabase)

**`meal_categories`**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "Fry Pan", "Pasta", "Slow Cooker" |
| sort_order | int | controls display order |

**`ingredients`** — global catalog, shared across all recipes
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "chicken breast" |
| store | enum | `sams_club` \| `aldi` \| `target` |

**`recipes`**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "Chicken Stir Fry" |
| category_id | uuid FK → meal_categories | |
| created_at | timestamptz | |

**`recipe_ingredients`** — join table
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| recipe_id | uuid FK → recipes | |
| ingredient_id | uuid FK → ingredients | |

**`staple_items`** — always appear on the grocery list
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "yogurt", "fruit" |
| store | enum | `sams_club` \| `aldi` \| `target` |
| notes | text | optional, e.g. "check if running low" |

### Ephemeral (browser state only — never saved)

- Pantry items to use up this week (typically 2–3 ingredient names, no hard limit)
- Recipes picked for each day of the week
- Generated grocery list

---

## App Flow

```
Staple Check → Pantry Input → Week Planner → (click slot) → Recipe Picker → Grocery List
```

### ① Staple Check
First step when starting a planning session. Shows the full `staple_items` list as a scrollable tap-to-toggle selector. She checks off which staples to include on this week's grocery list. An inline "Add new staple" form (name + store) expands at the bottom of the list — lets her add new staples without leaving the flow; newly added items are immediately selected and persisted to the DB. Selected staples flow into the grocery list generator; held in React state for the session only (not re-saved).

### ② Pantry Input
A searchable selector that pulls from the global `ingredients` catalog. She taps/clicks to toggle ingredients on or off (selected items appear as chips). A search box filters the list. An inline "Add new ingredient" form (name + store) expands at the bottom — lets her add catalog items on the fly; newly added items are immediately selected and persisted to the DB. Selected items are held in React state for the session only.

### ③ Week Planner
Shows 7 day slots (Mon–Sun), all equal. No pre-assigned types. She clicks any slot to open the Recipe Picker. Default is all slots empty. "Generate Grocery List" button activates once she's happy (not gated on all slots being filled — she may leave some empty intentionally).

### ④ Recipe Picker
Slides in as a panel. Contains:
- **Search bar** at the top — filters the recipe list by name as she types
- **Quick options:** "🍽️ Eating Out" and "🎲 Flex Night" — one click to assign, no ingredients added to grocery list
- **Category filter chips:** All / Pasta / Asian / Mexican / Sheet Pan / Crock Pot
- **Recipe list:** Recipes matching pantry ingredients are **highlighted** at the top; others shown below in normal style
- **"+ Add new recipe" dashed button** at the bottom of the list — navigates to `/recipes` so she can add the recipe, then return to planning

### ⑤ Grocery List
Generated on demand. Logic:
1. Collect all `recipe_ingredients` from the selected meals (skip Eating Out / Flex slots)
2. Deduplicate by ingredient id
3. Each ingredient item shows which meals it's used in (e.g., "Pasta Bolognese, Stir Fry")
4. Append selected staple items (marked with ★)
5. Group by store → three columns: Sam's Club / Aldi / Target

Displayed in-app with a "Copy list" button. Not saved to the DB.

---

## Design System

Sweetgreen-inspired aesthetic. All UI uses these design tokens:

| Token | Value | Usage |
|---|---|---|
| Field Cream | `#f4f3e7` | Page background |
| Willow Mist | `#d8e5d6` | Cards, selector lists |
| Grain Sand | `#e8dcc6` | Secondary cards, recipe picker background |
| Soil Shadow | `#0e150e` | Primary text |
| Stone Grey | `#8c8c82` | Muted text, labels |
| Garden Patch | `#00473c` | Nav, section labels, filter chips (filled) |
| Fresh Herb | `#7aaa6a` | Accent — primary buttons, selected chips, highlights |

**Typography:** Montserrat 200-weight for display headings; Inter 400/700 for body. Both loaded from Google Fonts via `<link>` in `index.html`.

**Shapes:** 24px radius for main cards; 1000px (pill) for buttons; 16px for inner elements. Box shadow: `rgba(14,21,14,0.4) 3px 3px 32px -10px`.

All Tailwind classes for these tokens are defined as custom colors in `tailwind.config.js` (e.g., `bg-field-cream`, `text-soil-shadow`, `bg-fresh-herb`).

---

## Navigation

Three routes in the nav bar:

| Route | Purpose |
|---|---|
| `/` | Week Planner (home) |
| `/recipes` | Recipe library — add, edit, delete recipes and their ingredients |
| `/manage` | Staples & Categories — manage staple items and meal category labels |

Planning always starts from `/` — pantry input appears as the first step when she clicks "Start Planning".

---

## Ingredient Autocomplete

When adding ingredients to a recipe, the input autocompletes from the global `ingredients` catalog. Selecting an existing ingredient pre-fills its store. If she types a new name, a new ingredient record is created with the store she selects. Over time the catalog builds itself with no extra effort.

---

## Responsive Design

- **Desktop / tablet:** Side-by-side layouts where helpful (recipe picker as a slide-in panel)
- **Phone:** Stacked single-column layout, large touch targets
- TailwindCSS breakpoints handle the switch; no separate mobile build

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Supabase offline / slow | Subtle "Reconnecting…" banner; save buttons disabled |
| Save fails | Toast notification: "Couldn't save, try again" — UI state preserved |
| First launch, no recipes | Friendly empty state with prompt to add first recipe |
| Empty week, grocery list triggered | List shows staples only; a note explains no meals were planned |

---

## Testing

- **Unit tests:** Grocery list generation logic (combine ingredients, deduplicate, split by store, append staples)
- **Manual:** UI flows — add recipe, run a planning session, generate grocery list
- No E2E automation needed at this stage

---

## Out of Scope (for now)

- Login / auth
- Sharing the plan with another person
- Historical week plans
- Meal ratings or notes
- Recipe import from URL
