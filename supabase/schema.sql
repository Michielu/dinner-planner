-- Meal categories (Pasta, Asian, Mexican, Sheet Pan, Crock Pot)
create table meal_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);

-- Global ingredient catalog — name + which store to buy from
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text not null check (store in ('sams_club', 'aldi', 'target')),
  constraint ingredients_name_unique unique (name)
);

-- Recipes
create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references meal_categories(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Join table: which ingredients belong to which recipe
create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  constraint recipe_ingredients_unique unique (recipe_id, ingredient_id)
);

-- Staple items — selected at the start of each planning session
create table staple_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text not null check (store in ('sams_club', 'aldi', 'target')),
  notes text
);

-- Seed default categories
insert into meal_categories (name, sort_order) values
  ('Pasta', 1),
  ('Asian', 2),
  ('Mexican', 3),
  ('Sheet Pan', 4),
  ('Crock Pot', 5);
