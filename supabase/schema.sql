-- Meal categories (Pasta, Asian, Mexican, Sheet Pan, Crock Pot)
create table meal_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);

alter table meal_categories enable row level security;
create policy "anon_all" on meal_categories for all to anon using (true) with check (true);

-- Global ingredient catalog — name + which store to buy from
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text not null check (store in ('sams_club', 'aldi', 'target', 'other')),
  constraint ingredients_name_unique unique (name)
);

alter table ingredients enable row level security;
create policy "anon_all" on ingredients for all to anon using (true) with check (true);

-- Recipes
create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references meal_categories(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table recipes enable row level security;
create policy "anon_all" on recipes for all to anon using (true) with check (true);

-- Join table: which ingredients belong to which recipe
create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  constraint recipe_ingredients_unique unique (recipe_id, ingredient_id)
);

alter table recipe_ingredients enable row level security;
create policy "anon_all" on recipe_ingredients for all to anon using (true) with check (true);

-- Staple items — selected at the start of each planning session
create table staple_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text not null check (store in ('sams_club', 'aldi', 'target', 'other')),
  notes text,
  created_at timestamptz not null default now()
);

alter table staple_items enable row level security;
create policy "anon_all" on staple_items for all to anon using (true) with check (true);

-- Seed default categories
insert into meal_categories (name, sort_order) values
  ('Pasta', 1),
  ('Asian', 2),
  ('Mexican', 3),
  ('Sheet Pan', 4),
  ('Crock Pot', 5);

-- One-off grocery items — added manually, not recurring staples
create table grocery_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text not null check (store in ('sams_club', 'aldi', 'target', 'other')),
  created_at timestamptz not null default now()
);

alter table grocery_extras enable row level security;
create policy "anon_all" on grocery_extras for all to anon using (true) with check (true);

-- Active week plan — one row at a time, persists session state across reloads
create table week_plan (
  id                  uuid        primary key default gen_random_uuid(),
  slots               jsonb       not null default '{}',
  selected_staple_ids uuid[]      not null default '{}',
  pantry_items        jsonb       not null default '[]',
  phase               text        not null default 'staples',
  visited_phases      text[]      not null default '{staples}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table week_plan enable row level security;
create policy "anon_all" on week_plan for all to anon using (true) with check (true);
