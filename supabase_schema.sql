-- supabase_schema.sql
-- Migration script to track users and their subscription status

-- Create a table for public profiles linked to auth.users
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  stripe_customer_id text,
  is_premium boolean default false,
  subscription_status text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Create policy to allow users to read their own profile
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

-- Create policy to allow service role (backend webhook) to manage profiles
create policy "Service role can manage all profiles" on public.profiles
  for all using (true);

-- Trigger to automatically create a profile record when a new user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Bind trigger to auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
