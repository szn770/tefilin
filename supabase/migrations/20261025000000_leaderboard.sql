-- לוח השיאים: שחקנים, יומן תוצאות, ופונקציות שבודקות כל תוצאה לפני שהיא נשמרת.
-- הקבועים כאן (100 הנחות, 20 שניות, שלב 30) חייבים להתאים ל-src/online/rules.js

-- ---------- שחקנים ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  -- הכינוי לצורך השוואה: "Dudi" ו-"dudi" הם אותו כינוי
  nickname_key text generated always as (lower(nickname)) stored,
  total_served integer not null default 0 check (total_served >= 0),
  best_level integer not null default 0 check (best_level >= 0), -- השלב הכי גבוה ששוחק (מ-1), 0 = עוד לא שיחק
  last_submit_at timestamptz,
  created_at timestamptz not null default now(),
  -- 2–12 תווים: עברית, אנגלית, ספרות, ורווח בודד בין מילים
  constraint nickname_format check (
    char_length(nickname) between 2 and 12
    and nickname ~ '^[א-תa-zA-Z0-9]+( [א-תa-zA-Z0-9]+)*$'
  ),
  constraint nickname_key_unique unique (nickname_key)
);

create index profiles_board_idx on public.profiles (total_served desc, best_level desc, created_at);

-- ---------- יומן תוצאות (רק המנהל רואה אותו) ----------
create table public.level_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_index integer not null check (level_index between 0 and 999),
  served integer not null check (served between 0 and 100),
  created_at timestamptz not null default now()
);

create index level_results_user_idx on public.level_results (user_id, created_at desc);

-- ---------- המנעול: מי רשאי לעשות מה ----------
alter table public.profiles enable row level security;
alter table public.level_results enable row level security;

-- כולם (גם אורחים) רואים את לוח השיאים. אף אחד לא כותב ישירות: רק דרך הפונקציות למטה.
create policy "everyone reads the leaderboard" on public.profiles
  for select to anon, authenticated using (true);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
revoke all on public.level_results from anon, authenticated;

-- ---------- כינוי בהרשמה עם סיסמה: נוצר יחד עם המשתמש ----------
-- המשחק שולח את הכינוי ב-user metadata. כינוי תפוס או לא תקין מבטל את ההרשמה כולה.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nick text := new.raw_user_meta_data ->> 'nickname';
begin
  if v_nick is not null then
    insert into public.profiles (id, nickname)
    values (new.id, regexp_replace(btrim(v_nick), '\s+', ' ', 'g'));
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- כינוי למי שנכנס עם Google (אין לו כינוי מההרשמה) ----------
create function public.claim_nickname(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nick text := regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g');
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'already_has_profile';
  end if;
  begin
    insert into public.profiles (id, nickname) values (v_uid, v_nick);
  exception
    when unique_violation then raise exception 'nickname_taken';
    when check_violation then raise exception 'nickname_invalid';
  end;
  return jsonb_build_object('nickname', v_nick);
end;
$$;

-- ---------- שליחת תוצאה של שלב ----------
-- p_level: מספר השלב מ-0. מחזיר את הסכום החדש, השלב הכי גבוה והמקום בלוח.
create function public.submit_level(p_level integer, p_served integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_max_level integer;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'no_profile';
  end if;

  if p_served is null or p_served < 0 or p_served > 100 then
    raise exception 'bad_served';
  end if;

  -- בתוצאה הראשונה מותר עד שלב 30 (אולי שיחקו קודם כאורחים); אחר כך רק שלב אחד קדימה
  v_max_level := case when v_profile.best_level = 0 then 30 else v_profile.best_level + 1 end;
  if p_level is null or p_level < 0 or p_level + 1 > v_max_level then
    raise exception 'bad_level';
  end if;

  if v_profile.last_submit_at is not null and now() - v_profile.last_submit_at < interval '20 seconds' then
    raise exception 'too_fast';
  end if;

  insert into public.level_results (user_id, level_index, served) values (v_uid, p_level, p_served);

  update public.profiles
     set total_served = v_profile.total_served + p_served,
         best_level = greatest(v_profile.best_level, p_level + 1),
         last_submit_at = now()
   where id = v_uid
   returning * into v_profile;

  return jsonb_build_object(
    'total', v_profile.total_served,
    'best_level', v_profile.best_level,
    'rank', (select count(*) + 1 from public.profiles where total_served > v_profile.total_served)
  );
end;
$$;

-- רק שחקנים מחוברים יכולים לקרוא לפונקציות. את פונקציית ההרשמה מפעיל רק מסד הנתונים עצמו.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.claim_nickname(text) from public, anon;
revoke execute on function public.submit_level(integer, integer) from public, anon;
grant execute on function public.claim_nickname(text) to authenticated;
grant execute on function public.submit_level(integer, integer) to authenticated;
