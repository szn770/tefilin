-- מסנן כינויים: מילים שאסור שיופיעו בכינוי בלוח השיאים.
-- מוסיפים מילים במסך של Supabase: Table Editor ← blocked_words ← Insert row.
-- כינוי שמכיל מילה אסורה לא נשמר בהרשמה. שחקן שכבר נרשם עם מילה שנוספה לרשימה אחר כך נעלם מהלוח (רק הוא עצמו רואה את עצמו).

create table public.blocked_words (
  word text primary key check (char_length(btrim(word)) >= 2),
  -- true: נחסם רק כשזו מילה שלמה בכינוי ("כוס" נחסם, "כוסמת" מותר).
  -- false: נחסם בכל מקום בכינוי, גם בתוך מילה אחרת או עם רווחים בין האותיות.
  whole_word boolean not null default false,
  created_at timestamptz not null default now()
);

-- רק המנהל רואה את הרשימה
alter table public.blocked_words enable row level security;
revoke all on public.blocked_words from anon, authenticated;

-- הצורה שבה משווים: אותיות קטנות, אותיות סופיות כרגילות, וספרות שמחליפות אותיות (sh1t, s3x)
create function public.nickname_skeleton(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(coalesce(p_text, '')), 'ךםןףץ013457', 'כמנפצoieast')
$$;

create function public.nickname_allowed(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with n as (
    select public.nickname_skeleton(p_nickname) as s
  ), f as (
    select replace(s, ' ', '') as flat,
           -- בלי אותיות שחוזרות: "חרררא" = "חרא"
           regexp_replace(replace(s, ' ', ''), '(.)\1+', '\1', 'g') as squeezed,
           string_to_array(s, ' ') as tokens
      from n
  )
  select not exists (
    select 1
      from public.blocked_words w
     cross join f
     cross join lateral (select public.nickname_skeleton(replace(w.word, ' ', '')) as k) b
     where case
             when w.whole_word then b.k = any (f.tokens) or b.k = f.flat
             else strpos(f.flat, b.k) > 0 or strpos(f.squeezed, b.k) > 0
           end
  )
$$;

-- לפני ההרשמה המשחק בודק אם אפשר לבחור את הכינוי: 'ok', 'taken' או 'blocked'
create function public.nickname_status(p_nickname text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.nickname_allowed(p_nickname) then 'blocked'
    when exists (
      select 1 from public.profiles
       where nickname_key = lower(regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g'))
    ) then 'taken'
    else 'ok'
  end
$$;

-- ---------- הלוח: שחקן עם כינוי אסור לא מוצג לאחרים ----------
drop policy "everyone reads the leaderboard" on public.profiles;
create policy "everyone reads the leaderboard" on public.profiles
  for select to anon, authenticated
  using (public.nickname_allowed(nickname) or id = (select auth.uid()));

-- ---------- ההרשמה: כינוי אסור מבטל אותה ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nick text := new.raw_user_meta_data ->> 'nickname';
begin
  if v_nick is not null then
    v_nick := regexp_replace(btrim(v_nick), '\s+', ' ', 'g');
    if not public.nickname_allowed(v_nick) then
      raise exception 'nickname_blocked';
    end if;
    insert into public.profiles (id, nickname) values (new.id, v_nick);
  end if;
  return new;
end;
$$;

create or replace function public.claim_nickname(p_nickname text)
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
  if not public.nickname_allowed(v_nick) then
    raise exception 'nickname_blocked';
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

-- המקום בלוח נספר רק מול מי שמוצג בלוח
create or replace function public.submit_level(p_level integer, p_served integer)
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
    'rank', (select count(*) + 1 from public.profiles
              where total_served > v_profile.total_served and public.nickname_allowed(nickname))
  );
end;
$$;

revoke execute on function public.nickname_allowed(text) from public;
grant execute on function public.nickname_allowed(text) to anon, authenticated; -- נדרש למנעול של הלוח
revoke execute on function public.nickname_status(text) from public;
grant execute on function public.nickname_status(text) to anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- הרשימה הראשונה ----------
-- whole_word = true למילים שמופיעות גם בתוך מילים רגילות (למשל "תחת" בתוך "מתחת").
insert into public.blocked_words (word, whole_word) values
  -- עברית: מילים גסות ולא צנועות
  ('זונה', false), ('שרמוטה', false), ('שרמוט', false), ('זדיינ', false), ('זיינ', false), ('זיון', true),
  ('זין', true), ('כוס', true), ('כוסית', true), ('כוסאמ', false), ('כוסעמ', false), ('תחת', true), ('תחתונ', false),
  ('חרא', true), ('חזיה', false), ('ציצי', true), ('ציצים', true), ('בולבול', true), ('ביצים', true), ('סקס', false),
  ('פורנו', false), ('עירום', true), ('ערומ', true), ('נשיקות', true), ('מנשק', true),
  ('קקי', true), ('פיפי', true), ('פלוץ', false), ('נוד', true),
  -- עברית: קללות ועלבונות
  ('מניאק', false), ('שמוק', false), ('מטומטמ', false), ('אידיוט', false), ('דביל', false), ('טמבל', false),
  ('מפגר', false), ('אהבל', true), ('סתומ', true), ('דפוק', true), ('זבל', true), ('מסריח', false),
  ('בהמה', true), ('יאזבל', false), ('לךתמות', false),
  -- עברית: שמות שלא מתאימים לדוכן תפילין
  ('ישו', true), ('נוצרי', false), ('היטלר', false), ('נאצי', false), ('שטן', true),
  -- אנגלית
  ('fuck', false), ('fuk', false), ('fck', false), ('shit', false), ('bitch', false), ('porn', false),
  ('pussy', false), ('penis', false), ('vagina', false), ('slut', false), ('whore', false), ('nigg', false),
  ('sex', false), ('xxx', false), ('boob', false), ('nude', false), ('naked', false), ('asshol', false),
  ('dick', true), ('cock', true), ('tits', true), ('cum', true), ('ass', true), ('fag', true),
  ('idiot', false), ('stupid', false), ('dumb', true), ('hitler', false), ('nazi', false),
  ('jesus', true), ('christ', false), ('666', true), ('devil', false), ('satan', false);
