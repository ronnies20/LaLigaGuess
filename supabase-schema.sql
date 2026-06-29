-- =====================================================
-- LaLiga Predictions — Supabase Schema
-- הרץ את כל הקובץ הזה ב-Supabase SQL Editor
-- =====================================================

-- 1. PROFILES (משתמשים)
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz default now()
);
alter table profiles add column if not exists avatar_url text;

-- יצירה אוטומטית של פרופיל בעת הרשמה
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. MATCHES (משחקים)
create table if not exists matches (
  id          uuid primary key default gen_random_uuid(),
  external_id bigint unique,
  round       int not null,
  home_team   text not null,
  away_team   text not null,
  kickoff     timestamptz not null,
  home_score  int,
  away_score  int,
  created_at  timestamptz default now()
);
alter table matches add column if not exists external_id bigint unique;

-- פונקציה לבדיקה אם משחק נעול (שעה לפני קיקאוף)
create or replace function is_match_locked(kickoff timestamptz)
returns boolean language sql stable as $$
  select kickoff - interval '1 hour' <= now();
$$;

create index if not exists matches_round_idx on matches(round);

-- 3. PREDICTIONS (ניחושים)
create table if not exists predictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  match_id    uuid not null references matches(id) on delete cascade,
  home_guess  int not null,
  away_guess  int not null,
  points      int,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, match_id)
);

create index if not exists predictions_user_idx  on predictions(user_id);
create index if not exists predictions_match_idx on predictions(match_id);

-- עדכון אוטומטי של updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists predictions_updated_at on predictions;
create trigger predictions_updated_at
  before update on predictions
  for each row execute function update_updated_at();

-- 4. פונקציה לחישוב נקודות לאחר עדכון תוצאה
create or replace function calculate_points(
  home_guess int, away_guess int,
  home_real int,  away_real int
) returns int language plpgsql as $$
begin
  if home_real is null then return null; end if;
  if home_guess = home_real and away_guess = away_real then return 3; end if;
  if sign(home_guess - away_guess) = sign(home_real - away_real) then return 1; end if;
  return 0;
end;
$$;

-- עדכון נקודות אחרי עדכון תוצאת משחק
create or replace function update_match_points()
returns trigger language plpgsql security definer as $$
begin
  if new.home_score is not null then
    update predictions
    set points = calculate_points(home_guess, away_guess, new.home_score, new.away_score)
    where match_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_match_result on matches;
create trigger on_match_result
  after update of home_score, away_score on matches
  for each row execute function update_match_points();

-- 5. VIEW: טבלת דירוג עונה שלמה
create or replace view leaderboard_view as
select
  p.user_id,
  pr.display_name,
  coalesce(sum(p.points), 0)             as total_points,
  count(*) filter (where p.points = 3)   as exact_count,
  count(*) filter (where p.points = 1)   as direction_count,
  count(*) filter (where p.points = 0)   as miss_count,
  count(*)                               as total_predictions
from predictions p
join profiles pr on pr.id = p.user_id
where p.points is not null
group by p.user_id, pr.display_name;

-- 6. VIEW: טבלת דירוג לפי מחזור
create or replace view round_leaderboard_view as
select
  p.user_id,
  pr.display_name,
  m.round,
  coalesce(sum(p.points), 0)             as round_points,
  count(*) filter (where p.points = 3)   as round_exact,
  count(*) filter (where p.points = 1)   as round_direction
from predictions p
join profiles pr on pr.id = p.user_id
join matches m   on m.id  = p.match_id
where p.points is not null
group by p.user_id, pr.display_name, m.round;

-- 7. ROW LEVEL SECURITY
alter table profiles    enable row level security;
alter table matches     enable row level security;
alter table predictions enable row level security;

-- Profiles: כל אחד יכול לקרוא, רק את עצמו לשנות
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Matches: כולם יכולים לקרוא
create policy "matches_select" on matches for select using (true);

-- Predictions: כל אחד רואה הכל, שומר רק את שלו + לא יכול לשנות אחרי נעילה
create policy "predictions_select" on predictions for select using (true);
create policy "predictions_insert" on predictions for insert
  with check (
    auth.uid() = user_id
    and not (select is_match_locked(kickoff) from matches where id = match_id)
  );
create policy "predictions_update" on predictions for update
  using (auth.uid() = user_id)
  with check (
    not (select is_match_locked(kickoff) from matches where id = match_id)
  );

-- 8. VIEW: רצף נוכחי של ניחושים מדויקים רצופים (לפי כיפוף זמן)
-- סופר כמה ניחושים מדויקים אחרונים יש לכל שחקן ברצף, ללא הפסקה
create or replace view current_streak_view as
with ordered as (
  select
    p.user_id,
    m.kickoff,
    case when p.points = 3 then 1 else 0 end as is_exact,
    row_number() over (partition by p.user_id order by m.kickoff desc) as rn
  from predictions p
  join matches m on m.id = p.match_id
  where p.points is not null
),
first_miss as (
  select user_id, min(rn) as miss_rn
  from ordered
  where is_exact = 0
  group by user_id
)
select
  o.user_id,
  count(*)::int as current_streak
from ordered o
left join first_miss fm on fm.user_id = o.user_id
where o.is_exact = 1
  and (fm.miss_rn is null or o.rn < fm.miss_rn)
group by o.user_id;

grant select on current_streak_view to anon, authenticated;

-- 9. STORAGE — bucket לאווטרים
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_select" on storage.objects;
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;

create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- נתוני דוגמה — מחזור 36 (לבדיקה)
-- שנה את התאריכים לתאריכים עתידיים
-- =====================================================
/*
insert into matches (round, home_team, away_team, kickoff) values
  (36, 'Barcelona',       'Atletico Madrid', '2026-05-03 21:00+03'),
  (36, 'Real Madrid',     'Real Betis',      '2026-05-03 18:30+03'),
  (36, 'Sevilla',         'Valencia',        '2026-05-04 16:15+03'),
  (36, 'Osasuna',         'Villarreal',      '2026-05-04 18:30+03'),
  (36, 'Athletic Club',   'Real Sociedad',   '2026-05-04 21:00+03'),
  (36, 'Celta Vigo',      'Mallorca',        '2026-05-05 18:30+03'),
  (36, 'Getafe',          'Rayo Vallecano',  '2026-05-05 18:30+03'),
  (36, 'Girona',          'Las Palmas',      '2026-05-05 18:30+03'),
  (36, 'Alaves',          'Espanyol',        '2026-05-05 18:30+03'),
  (36, 'Leganes',         'Valladolid',      '2026-05-05 18:30+03');
*/
