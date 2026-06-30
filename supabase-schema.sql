-- =====================================================
-- LaLiga Predictions — Supabase Schema
-- הרץ את כל הקובץ הזה ב-Supabase SQL Editor
-- =====================================================

-- 1. PROFILES (משתמשים)
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) >= 1 and char_length(display_name) <= 50),
  avatar_url    text,
  created_at    timestamptz default now()
);
alter table profiles add column if not exists avatar_url text;
alter table profiles add constraint if not exists display_name_length
  check (char_length(display_name) >= 1 and char_length(display_name) <= 50);

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
alter table matches add column if not exists external_id    bigint unique;
alter table matches add column if not exists status         text default 'NS';
alter table matches add column if not exists is_special     boolean default false;
alter table matches add column if not exists penalty_minute int;
alter table matches add column if not exists penalty_events jsonb default '[]'::jsonb;

-- פונקציה לבדיקה אם משחק נעול (שעה לפני קיקאוף)
create or replace function is_match_locked(kickoff timestamptz)
returns boolean language sql stable as $$
  select kickoff - interval '1 hour' <= now();
$$;

create index if not exists matches_round_idx on matches(round);

-- 3. PREDICTIONS (ניחושים)
create table if not exists predictions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  match_id      uuid not null references matches(id) on delete cascade,
  home_guess    int not null,
  away_guess    int not null,
  points        int,
  is_joker      boolean default false,
  round         int,
  penalty_min   int,
  penalty_max   int,
  penalty_bonus int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
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
-- Phase scoring: rounds 1-19: exact=3,dir=1 | 20-33: exact=5,dir=2 | 34+: exact=7,dir=3
create or replace function calculate_points(
  home_guess int, away_guess int,
  home_real  int, away_real  int,
  p_round    int default 1
) returns int language plpgsql as $$
declare
  exact_pts int;
  dir_pts   int;
begin
  if home_real is null then return null; end if;
  exact_pts := case when p_round >= 34 then 7 when p_round >= 20 then 5 else 3 end;
  dir_pts   := case when p_round >= 34 then 3 when p_round >= 20 then 2 else 1 end;
  if home_guess = home_real and away_guess = away_real then return exact_pts; end if;
  if sign(home_guess - away_guess) = sign(home_real - away_real) then return dir_pts; end if;
  return 0;
end;
$$;

-- עדכון נקודות אחרי עדכון תוצאת משחק (כולל בונוס סטרייק + phase scoring)
create or replace function update_match_points()
returns trigger language plpgsql security definer as $$
declare
  rec           record;
  streak_count  int;
  is_exact_pred boolean;
  final_pts     int;
  base_exact    int;
  base_dir      int;
begin
  if new.home_score is not null then
    -- Phase-based scoring
    base_exact := case when new.round >= 34 then 7 when new.round >= 20 then 5 else 3 end;
    base_dir   := case when new.round >= 34 then 3 when new.round >= 20 then 2 else 1 end;

    for rec in select * from predictions where match_id = new.id loop
      is_exact_pred := (rec.home_guess = new.home_score and rec.away_guess = new.away_score);

      -- סטרייק לפני המשחק הנוכחי (מכבד מגן סטרייק — ראו 20. למטה)
      with ordered_preds as (
        select
          case when p.home_guess = m.home_score and p.away_guess = m.away_score then 1 else 0 end as is_exact,
          row_number() over (order by m.kickoff desc) as rn
        from predictions p
        join matches m on m.id = p.match_id
        left join profiles pr on pr.id = p.user_id
        where p.user_id = rec.user_id
          and m.kickoff < new.kickoff
          and m.home_score is not null
          and not (
            pr.streak_shield_round = m.round
            and not (p.home_guess = m.home_score and p.away_guess = m.away_score)
          )
      ),
      first_miss as (
        select min(rn) as miss_rn from ordered_preds where is_exact = 0
      )
      select coalesce(count(*)::int, 0) into streak_count
      from ordered_preds
      left join first_miss on true
      where is_exact = 1
        and (first_miss.miss_rn is null or ordered_preds.rn < first_miss.miss_rn);

      if rec.is_joker then
        if is_exact_pred then
          -- joker = base_exact × 2, streak bonus +2/+3
          if    streak_count >= 5 then final_pts := base_exact * 2 + 3;
          elsif streak_count >= 4 then final_pts := base_exact * 2 + 1;
          else                         final_pts := base_exact * 2;
          end if;
        else
          final_pts := case when streak_count >= 4 then -3 else -1 end;
        end if;
      elsif new.is_special then
        -- Special match: ×2 of phase scoring (no streak stacking)
        final_pts := calculate_points(rec.home_guess, rec.away_guess, new.home_score, new.away_score, new.round) * 2;
      else
        if is_exact_pred then
          if    streak_count >= 5 then final_pts := base_exact + 3;
          elsif streak_count >= 4 then final_pts := base_exact + 2;
          else                         final_pts := base_exact;
          end if;
        else
          final_pts := calculate_points(rec.home_guess, rec.away_guess, new.home_score, new.away_score, new.round);
        end if;
      end if;

      update predictions set points = final_pts where id = rec.id;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists on_match_result on matches;
create trigger on_match_result
  after update of home_score, away_score on matches
  for each row execute function update_match_points();

-- 5. VIEW: טבלת דירוג עונה שלמה (כולל בונוס פנדל)
create or replace view leaderboard_view as
select
  p.user_id,
  pr.display_name,
  pr.avatar_url,
  coalesce(sum(p.points), 0) + coalesce(sum(p.penalty_bonus), 0)                                 as total_points,
  count(*) filter (where p.home_guess = m.home_score and p.away_guess = m.away_score)            as exact_count,
  count(*) filter (where p.points > 0
                     and not (p.home_guess = m.home_score and p.away_guess = m.away_score))      as direction_count,
  count(*) filter (where p.points <= 0)                                                          as miss_count,
  count(*)                                                                                       as total_predictions
from predictions p
join profiles pr on pr.id = p.user_id
join matches   m  on m.id  = p.match_id
where p.points is not null
group by p.user_id, pr.display_name, pr.avatar_url;

-- 6. VIEW: טבלת דירוג לפי מחזור (כולל בונוס פנדל)
create or replace view round_leaderboard_view as
select
  p.user_id,
  pr.display_name,
  pr.avatar_url,
  m.round,
  coalesce(sum(p.points), 0) + coalesce(sum(p.penalty_bonus), 0)                                as round_points,
  count(*) filter (where p.home_guess = m.home_score and p.away_guess = m.away_score)           as round_exact,
  count(*) filter (where p.points > 0
                     and not (p.home_guess = m.home_score and p.away_guess = m.away_score))     as round_direction
from predictions p
join profiles pr on pr.id = p.user_id
join matches m   on m.id  = p.match_id
where p.points is not null
group by p.user_id, pr.display_name, pr.avatar_url, m.round;

-- 7. ROW LEVEL SECURITY
alter table profiles    enable row level security;
alter table matches     enable row level security;
alter table predictions enable row level security;

-- Profiles: כל אחד יכול לקרוא, רק את עצמו לשנות
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Matches: כולם יכולים לקרוא
create policy "matches_select" on matches for select using (true);

-- Predictions: גלוי לבעלים בלבד לפני נעילה, לכולם אחרי נעילה
create policy "predictions_select" on predictions for select using (
  auth.uid() = user_id
  or (select is_match_locked(kickoff) from matches where id = match_id)
);
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

-- Column-level: מניעת כתיבה ישירה לנקודות (מחושב ע"י trigger בלבד)
revoke update on predictions from authenticated;
grant  update (home_guess, away_guess, is_joker, penalty_min, penalty_max)
  on predictions to authenticated;
revoke insert on predictions from authenticated;
grant  insert (user_id, match_id, home_guess, away_guess, is_joker, penalty_min, penalty_max)
  on predictions to authenticated;

-- 8. VIEW: רצף נוכחי — לפי דיוק אמיתי (לא לפי נקודות, כי ניחוש בסטרייק שווה 5/6)
create or replace view current_streak_view as
with ordered as (
  select
    p.user_id,
    m.kickoff,
    case when p.home_guess = m.home_score and p.away_guess = m.away_score then 1 else 0 end as is_exact,
    row_number() over (partition by p.user_id order by m.kickoff desc) as rn
  from predictions p
  join matches m on m.id = p.match_id
  left join profiles pr on pr.id = p.user_id
  where m.home_score is not null
    -- מגן סטרייק: ניחוש שגוי במחזור המוגן לא שובר את הרצף (פשוט מדולג)
    and not (
      pr.streak_shield_round = m.round
      and not (p.home_guess = m.home_score and p.away_guess = m.away_score)
    )
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

-- 9. פונקציה לחישוב סטרייק מקסימלי לשחקן (SQL מובטח לפי סדר kickoff)
create or replace function get_max_streak(p_user_id uuid)
returns int language plpgsql stable security definer as $$
declare
  max_streak int := 0;
  cur_streak int := 0;
  rec        record;
begin
  for rec in
    select
      case when p.home_guess = m.home_score and p.away_guess = m.away_score then true else false end as is_exact
    from predictions p
    join matches m on m.id = p.match_id
    where p.user_id = p_user_id
      and m.home_score is not null
    order by m.kickoff asc
  loop
    if rec.is_exact then
      cur_streak := cur_streak + 1;
      if cur_streak > max_streak then max_streak := cur_streak; end if;
    else
      cur_streak := 0;
    end if;
  end loop;
  return max_streak;
end;
$$;

grant execute on function get_max_streak(uuid) to anon, authenticated;

-- 10. STORAGE — bucket לאווטרים
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
-- 13. PENALTY BONUS — כשמוגדר penalty_events על משחק ריאל מדריד
-- =====================================================
alter table predictions add column if not exists penalty_min   int;
alter table predictions add column if not exists penalty_max   int;
alter table predictions add column if not exists penalty_bonus int default 0;

-- Helper: האם פנדל בדקה p_elapsed (עם תוספת p_extra) נמצא בטווח שבחר המשתמש?
-- max=45  → "33-45+" = כולל תוספת זמן מחצית ראשונה (elapsed≤45 בכל extra)
-- max=90  → "78-90+" = כולל תוספת זמן + מאריכים (elapsed≥78 ללא הגבלה)
-- שאר הטווחים: בדיקה רגילה של elapsed
create or replace function penalty_in_range(
  p_elapsed int, p_extra int, range_min int, range_max int
) returns boolean language plpgsql immutable as $$
begin
  if range_max = 45 then
    return p_elapsed >= range_min and p_elapsed <= 45;
  end if;
  if range_max = 90 then
    return p_elapsed >= range_min;
  end if;
  return p_elapsed >= range_min and p_elapsed <= range_max;
end;
$$;

-- טריגר: מחשב penalty_bonus לכל ניחוש כשמתעדכן penalty_events (או penalty_minute לאחורה)
-- penalty_events כולל כל פנדל שניתן לריאל מדריד, נכבש או הוחמץ — הנקודות לא תלויות בתוצאה
create or replace function update_penalty_bonus()
returns trigger language plpgsql security definer as $$
declare
  pred       record;
  ev         jsonb;
  p_elapsed  int;
  p_extra    int;
  hits       int;
  eff_events jsonb;
begin
  -- eff_events: מועדף penalty_events; fallback ל-penalty_minute (אחורה תאימות)
  if jsonb_array_length(coalesce(new.penalty_events, '[]'::jsonb)) > 0 then
    eff_events := new.penalty_events;
  elsif new.penalty_minute is not null then
    eff_events := jsonb_build_array(jsonb_build_object('e', new.penalty_minute, 'x', null::int));
  else
    eff_events := '[]'::jsonb;
  end if;

  for pred in
    select id, penalty_min, penalty_max from predictions where match_id = new.id
  loop
    if pred.penalty_min is null or pred.penalty_max is null then
      update predictions set penalty_bonus = 0 where id = pred.id;
      continue;
    end if;

    hits := 0;
    for ev in select * from jsonb_array_elements(eff_events) loop
      p_elapsed := (ev->>'e')::int;
      p_extra   := nullif(ev->>'x', 'null')::int;
      if penalty_in_range(p_elapsed, p_extra, pred.penalty_min, pred.penalty_max) then
        hits := hits + 1;
      end if;
    end loop;

    update predictions set penalty_bonus = hits * 3 where id = pred.id;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_penalty_scored on matches;
create trigger on_penalty_scored
  after update of penalty_minute, penalty_events on matches
  for each row execute function update_penalty_bonus();

-- =====================================================
-- 14. SECURITY: ג'וקר אחד בלבד למחזור
-- =====================================================
create or replace function check_joker_uniqueness()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existing_count int;
begin
  if new.is_joker then
    select count(*) into existing_count
    from predictions p
    join matches m on m.id = p.match_id
    where p.user_id = new.user_id
      and p.is_joker = true
      and p.id != new.id
      and m.round = (select round from matches where id = new.match_id);
    if existing_count > 0 then
      raise exception 'ג''וקר כבר נוצל במחזור זה';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_joker_uniqueness on predictions;
create trigger enforce_joker_uniqueness
  before insert or update on predictions
  for each row execute function check_joker_uniqueness();

-- =====================================================
-- 15. SECURITY: סינכרון round + unique index לג'וקר
-- =====================================================
-- שומר את round בשורת predictions (נחוץ לindex)
-- שם הטריגר מתחיל ב-'aa_' כדי לרוץ לפני enforce_joker_uniqueness
create or replace function sync_prediction_round()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.round := (select round from matches where id = new.match_id);
  return new;
end;
$$;

drop trigger if exists aa_sync_prediction_round on predictions;
create trigger aa_sync_prediction_round
  before insert or update on predictions
  for each row execute function sync_prediction_round();

-- partial unique index — אטומי, חוסם race condition של 2 כרטיסיות בו-זמנית
drop index if exists predictions_one_joker_per_round;
create unique index predictions_one_joker_per_round
  on predictions (user_id, round)
  where is_joker = true;

-- =====================================================
-- 10. ROUND MESSAGES (טראש טוק)
-- =====================================================
create table if not exists round_messages (
  user_id    uuid references profiles(id) on delete cascade,
  round      int  not null,
  message    text not null check (char_length(message) <= 20),
  created_at timestamptz default now(),
  primary key (user_id, round)
);

alter table round_messages enable row level security;

create policy "anyone can read messages"
  on round_messages for select using (true);

create policy "users manage own message"
  on round_messages for all using (auth.uid() = user_id);

-- =====================================================
-- 11. PUSH SUBSCRIPTIONS
-- =====================================================
create table if not exists push_subscriptions (
  user_id    uuid primary key references profiles(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "users manage own subscription"
  on push_subscriptions for all using (auth.uid() = user_id);

create policy "service_role_reads_all_subscriptions"
  on push_subscriptions for select to service_role using (true);

-- =====================================================
-- 12. NOTIFICATION LOG
-- =====================================================
create table if not exists notification_log (
  id       uuid default gen_random_uuid() primary key,
  user_id  uuid references profiles(id) on delete cascade,
  type     text not null,
  round    int,
  metadata jsonb,
  sent_at  timestamptz default now(),
  unique(user_id, type, round)
);

alter table notification_log enable row level security;

create policy "service_role_only_notification_log"
  on notification_log for all to service_role using (true) with check (true);

-- =====================================================
-- 16. FEEDBACK (HIGH-1 + MED-4 fix)
-- =====================================================
create table if not exists feedback (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references profiles(id) on delete cascade,
  display_name text,
  user_email   text,
  message      text not null check (char_length(message) <= 1000),
  read         boolean default false,
  created_at   timestamptz default now()
);

alter table feedback enable row level security;

-- trigger ממלא user_id/user_email/display_name מהשרת — המשתמש לא יכול לזייף
create or replace function fill_feedback_user_info()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id      := auth.uid();
  new.user_email   := auth.jwt() ->> 'email';
  new.display_name := (select display_name from profiles where id = auth.uid());
  return new;
end;
$$;

drop trigger if exists fill_feedback_info on feedback;
create trigger fill_feedback_info
  before insert on feedback
  for each row execute function fill_feedback_user_info();

-- משתמש יכול רק להכניס — user_id/email/display_name ממולאים ע"י trigger
create policy "feedback_insert" on feedback
  for insert with check (true);

-- רק אדמין יכול לקרוא (server-side enforcement ע"י JWT claim)
create policy "feedback_admin_select" on feedback
  for select using (auth.jwt() ->> 'email' = 'mikaswiftt@gmail.com');

-- רק אדמין יכול לעדכן (markFeedbackRead)
create policy "feedback_admin_update" on feedback
  for update using (auth.jwt() ->> 'email' = 'mikaswiftt@gmail.com');

-- =====================================================
-- 17. STORAGE — avatar file type restriction (MED-5 + MED-20)
-- =====================================================
drop policy if exists "avatars_insert"           on storage.objects;
drop policy if exists "avatars_insert_validated" on storage.objects;
create policy "avatars_insert_validated" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'gif', 'webp')
  );

-- update policy גם מוודא סיומת (MED-20 fix)
drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'gif', 'webp')
  );

-- =====================================================
-- 18. display_name constraint (LOW-4)
-- =====================================================
alter table profiles add constraint if not exists display_name_length
  check (char_length(display_name) >= 1 and char_length(display_name) <= 50);

-- =====================================================
-- 19. penalty_min/max whitelist constraint (MED-8)
-- =====================================================
alter table predictions drop constraint if exists valid_penalty_range;
alter table predictions add constraint valid_penalty_range
  check (
    (penalty_min is null and penalty_max is null)
    or (penalty_min, penalty_max) in ((1,17),(18,32),(33,45),(46,62),(63,77),(78,90))
  );

-- =====================================================
-- 20. Streak shield (one per season per user)
-- =====================================================
alter table profiles add column if not exists streak_shield boolean default true;
alter table profiles add column if not exists streak_shield_round int;

-- Column-level: מניעת כתיבה ישירה למגן/ניקוד דרך עדכון פרופיל רגיל —
-- ההפעלה עוברת רק דרך activate_streak_shield() כדי למנוע איפוס עצמי
revoke update on profiles from authenticated;
grant  update (display_name, avatar_url) on profiles to authenticated;

-- הפעלת מגן הסטרייק: RPC מאובטח (SECURITY DEFINER) — המשתמש לא יכול
-- לכתוב ישירות לעמודות streak_shield / streak_shield_round
create or replace function activate_streak_shield(p_round int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  round_locked boolean;
  activated    boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select exists(
    select 1 from matches where round = p_round and is_match_locked(kickoff)
  ) into round_locked;

  if round_locked then
    return false;
  end if;

  update profiles
  set streak_shield = false, streak_shield_round = p_round
  where id = auth.uid() and streak_shield = true
  returning true into activated;

  return coalesce(activated, false);
end;
$$;

grant execute on function activate_streak_shield(int) to authenticated;

-- 21. ENGAGEMENT — count_round_predictions RPC
-- =====================================================
-- Returns count of distinct users who have at least one prediction in the round
-- Used for social proof ("X players already predicted")
-- SECURITY DEFINER: readable without exposing actual prediction values
create or replace function count_round_predictions(p_round int)
returns int language sql security definer set search_path = public as $$
  select count(distinct p.user_id)::int
  from predictions p
  join matches m on m.id = p.match_id
  where m.round = p_round;
$$;

grant execute on function count_round_predictions(int) to authenticated, anon;

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
