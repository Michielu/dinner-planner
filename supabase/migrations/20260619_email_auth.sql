-- allowed_emails: the access list
create table if not exists allowed_emails (
  email text primary key
);
alter table allowed_emails enable row level security;
create policy "anon_select" on allowed_emails for select to anon using (true);
create policy "anon_insert" on allowed_emails for insert to anon with check (true);

-- Add user_email to all user-owned tables
alter table week_plan          add column if not exists user_email text not null default '';
alter table staple_items       add column if not exists user_email text not null default '';
alter table ingredients        add column if not exists user_email text not null default '';
alter table stores             add column if not exists user_email text not null default '';
alter table recipes            add column if not exists user_email text not null default '';
alter table recipe_ingredients add column if not exists user_email text not null default '';
alter table meal_categories    add column if not exists user_email text not null default '';
