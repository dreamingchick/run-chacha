create table public.chacha_runs (
 id uuid primary key default gen_random_uuid(),
 player_hash text not null check (player_hash ~ '^[a-f0-9]{64}$'),
 started_at timestamptz not null default clock_timestamp(),
 submitted_at timestamptz
);
create index chacha_runs_player_started on public.chacha_runs(player_hash, started_at desc);
create index chacha_runs_started on public.chacha_runs(started_at);
create table public.chacha_scores (
 player_hash text primary key check (player_hash ~ '^[a-f0-9]{64}$'),
 nickname text not null check (char_length(nickname) between 2 and 12),
 distance integer not null check(distance between 0 and 300000),
 achieved_at timestamptz not null default clock_timestamp()
);
create index chacha_scores_ranking on public.chacha_scores(distance desc, achieved_at asc, player_hash asc);
alter table public.chacha_runs enable row level security;
alter table public.chacha_scores enable row level security;
revoke all on public.chacha_runs, public.chacha_scores from public, anon, authenticated;
grant select, insert, update, delete on public.chacha_runs, public.chacha_scores to service_role;

create function public.chacha_start_run(p_player_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_run public.chacha_runs; v_count integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_player_hash,0));
 select count(*) into v_count from public.chacha_runs
 where player_hash=p_player_hash and started_at>clock_timestamp()-interval '1 minute';
 if v_count>=12 then raise exception 'RUN_RATE_LIMIT'; end if;
 delete from public.chacha_runs where started_at<clock_timestamp()-interval '1 day';
 insert into public.chacha_runs(player_hash) values(p_player_hash) returning * into v_run;
 return jsonb_build_object('runId',v_run.id);
end $$;

create function public.chacha_ranking(p_player_hash text default '') returns jsonb
language sql stable security invoker set search_path = '' as $$
 with ranked as (
  select row_number() over(order by distance desc,achieved_at asc,player_hash asc) as rank,
   player_hash,nickname,distance,achieved_at from public.chacha_scores
 ), leaders as (select rank,nickname,distance,achieved_at from ranked order by rank limit 20)
 select jsonb_build_object(
  'leaders',coalesce((select jsonb_agg(to_jsonb(l) order by l.rank) from leaders l),'[]'::jsonb),
  'mine',(select jsonb_build_object('rank',rank,'nickname',nickname,'distance',distance) from ranked where player_hash=p_player_hash),
  'total',(select count(*) from public.chacha_scores));
$$;

create function public.chacha_submit_score(p_player_hash text,p_run_id uuid,p_nickname text,p_ticks integer,p_distance integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_run public.chacha_runs; v_elapsed double precision;
begin
 select * into v_run from public.chacha_runs where id=p_run_id and player_hash=p_player_hash for update;
 if not found or v_run.submitted_at is not null then raise exception 'INVALID_RUN'; end if;
 v_elapsed=extract(epoch from clock_timestamp()-v_run.started_at);
 if p_ticks<1 or p_ticks>432000 or p_ticks/120.0>v_elapsed+3 or v_elapsed>86400 then raise exception 'INVALID_DURATION'; end if;
 if char_length(p_nickname)<2 or char_length(p_nickname)>12 or p_distance<0 or p_distance>300000 then raise exception 'INVALID_SCORE'; end if;
 update public.chacha_runs set submitted_at=clock_timestamp() where id=p_run_id;
 insert into public.chacha_scores as s(player_hash,nickname,distance)
 values(p_player_hash,p_nickname,p_distance)
 on conflict(player_hash) do update set nickname=excluded.nickname,distance=excluded.distance,achieved_at=clock_timestamp()
 where excluded.distance>s.distance;
 return public.chacha_ranking(p_player_hash);
end $$;
revoke all on function public.chacha_start_run(text),public.chacha_ranking(text),public.chacha_submit_score(text,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.chacha_start_run(text),public.chacha_ranking(text),public.chacha_submit_score(text,uuid,text,integer,integer) to service_role;

create policy chacha_runs_no_direct_access on public.chacha_runs for all to anon,authenticated using(false) with check(false);
create policy chacha_scores_no_direct_access on public.chacha_scores for all to anon,authenticated using(false) with check(false);


-- v2 leaderboard is separate; the original v1 scores remain unchanged.
create table public.chacha_scores_v2 (
 player_hash text primary key check (player_hash ~ '^[a-f0-9]{64}$'),
 nickname text not null check (char_length(nickname) between 2 and 12),
 distance integer not null check(distance between 0 and 2000000),
 achieved_at timestamptz not null default clock_timestamp()
);
create index chacha_scores_v2_ranking on public.chacha_scores_v2(distance desc,achieved_at asc,player_hash asc);
alter table public.chacha_scores_v2 enable row level security;
revoke all on public.chacha_scores_v2 from public, anon, authenticated;
grant select, insert, update, delete on public.chacha_scores_v2 to service_role;

create function public.chacha_ranking_v2(p_player_hash text default '') returns jsonb
language sql stable security invoker set search_path = '' as $$
 with ranked as (
  select row_number() over(order by distance desc,achieved_at asc,player_hash asc) as rank,
   player_hash,nickname,distance,achieved_at from public.chacha_scores_v2
 ), leaders as (select rank,nickname,distance,achieved_at from ranked order by rank limit 20)
 select jsonb_build_object(
  'leaders',coalesce((select jsonb_agg(to_jsonb(l) order by l.rank) from leaders l),'[]'::jsonb),
  'mine',(select jsonb_build_object('rank',rank,'nickname',nickname,'distance',distance) from ranked where player_hash=p_player_hash),
  'total',(select count(*) from public.chacha_scores_v2));
$$;

create function public.chacha_submit_score_v2(p_player_hash text,p_run_id uuid,p_nickname text,p_ticks integer,p_distance integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_run public.chacha_runs; v_elapsed double precision;
begin
 select * into v_run from public.chacha_runs where id=p_run_id and player_hash=p_player_hash for update;
 if not found or v_run.submitted_at is not null then raise exception 'INVALID_RUN'; end if;
 v_elapsed=extract(epoch from clock_timestamp()-v_run.started_at);
 if p_ticks<1 or p_ticks>432000 or p_ticks/120.0>v_elapsed+3 or v_elapsed>86400 then raise exception 'INVALID_DURATION'; end if;
 if char_length(p_nickname)<2 or char_length(p_nickname)>12 or p_distance<0 or p_distance>2000000 then raise exception 'INVALID_SCORE'; end if;
 update public.chacha_runs set submitted_at=clock_timestamp() where id=p_run_id;
 insert into public.chacha_scores_v2 as s(player_hash,nickname,distance)
 values(p_player_hash,p_nickname,p_distance)
 on conflict(player_hash) do update set nickname=excluded.nickname,distance=excluded.distance,achieved_at=clock_timestamp()
 where excluded.distance>s.distance;
 return public.chacha_ranking_v2(p_player_hash);
end $$;
revoke all on function public.chacha_ranking_v2(text),public.chacha_submit_score_v2(text,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.chacha_ranking_v2(text),public.chacha_submit_score_v2(text,uuid,text,integer,integer) to service_role;
create policy chacha_scores_v2_no_direct_access on public.chacha_scores_v2 for all to anon,authenticated using(false) with check(false);

-- v3: preserve old seasons and bind new runs to the v3 leaderboard.
alter table public.chacha_runs add column ranking_version integer not null default 1;
create table public.chacha_scores_v3 (
 player_hash text primary key check (player_hash ~ '^[a-f0-9]{64}$'),
 nickname text not null check (char_length(nickname) between 2 and 12),
 distance integer not null check(distance between 0 and 2000000),
 achieved_at timestamptz not null default clock_timestamp()
);
create index chacha_scores_v3_ranking on public.chacha_scores_v3(distance desc,achieved_at asc,player_hash asc);
alter table public.chacha_scores_v3 enable row level security;
revoke all on public.chacha_scores_v3 from public, anon, authenticated;
grant select, insert, update, delete on public.chacha_scores_v3 to service_role;

create function public.chacha_ranking_v3(p_player_hash text default '') returns jsonb
language sql stable security invoker set search_path = '' as $$
 with ranked as (
  select row_number() over(order by distance desc,achieved_at asc,player_hash asc) as rank,
   player_hash,nickname,distance,achieved_at from public.chacha_scores_v3
 ), leaders as (select rank,nickname,distance,achieved_at from ranked order by rank limit 20)
 select jsonb_build_object(
  'leaders',coalesce((select jsonb_agg(to_jsonb(l) order by l.rank) from leaders l),'[]'::jsonb),
  'mine',(select jsonb_build_object('rank',rank,'nickname',nickname,'distance',distance) from ranked where player_hash=p_player_hash),
  'total',(select count(*) from public.chacha_scores_v3));
$$;

create function public.chacha_submit_score_v3(p_player_hash text,p_run_id uuid,p_nickname text,p_ticks integer,p_distance integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_run public.chacha_runs; v_elapsed double precision;
begin
 select * into v_run from public.chacha_runs where id=p_run_id and player_hash=p_player_hash for update;
 if not found or v_run.submitted_at is not null or v_run.ranking_version<>3 then raise exception 'INVALID_RUN'; end if;
 v_elapsed=extract(epoch from clock_timestamp()-v_run.started_at);
 if p_ticks<1 or p_ticks>432000 or p_ticks/120.0>v_elapsed+3 or v_elapsed>86400 then raise exception 'INVALID_DURATION'; end if;
 if char_length(p_nickname)<2 or char_length(p_nickname)>12 or p_distance<0 or p_distance>2000000 then raise exception 'INVALID_SCORE'; end if;
 update public.chacha_runs set submitted_at=clock_timestamp() where id=p_run_id;
 insert into public.chacha_scores_v3 as s(player_hash,nickname,distance)
 values(p_player_hash,p_nickname,p_distance)
 on conflict(player_hash) do update set nickname=excluded.nickname,distance=excluded.distance,achieved_at=clock_timestamp()
 where excluded.distance>s.distance;
 return public.chacha_ranking_v3(p_player_hash);
end $$;
revoke all on function public.chacha_ranking_v3(text),public.chacha_submit_score_v3(text,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.chacha_ranking_v3(text),public.chacha_submit_score_v3(text,uuid,text,integer,integer) to service_role;
create policy chacha_scores_v3_no_direct_access on public.chacha_scores_v3 for all to anon,authenticated using(false) with check(false);
create function public.chacha_start_run_v3(p_player_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_run public.chacha_runs; v_count integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_player_hash,0));
 select count(*) into v_count from public.chacha_runs
 where player_hash=p_player_hash and started_at>clock_timestamp()-interval '1 minute';
 if v_count>=12 then raise exception 'RUN_RATE_LIMIT'; end if;
 delete from public.chacha_runs where started_at<clock_timestamp()-interval '1 day';
 insert into public.chacha_runs(player_hash,ranking_version) values(p_player_hash,3) returning * into v_run;
 return jsonb_build_object('runId',v_run.id);
end $$;


revoke all on function public.chacha_start_run_v3(text) from public,anon,authenticated;
grant execute on function public.chacha_start_run_v3(text) to service_role;

create table public.chacha_scores_v4 (
 player_hash text primary key check (player_hash ~ '^[a-f0-9]{64}$'),
 nickname text not null check (char_length(nickname) between 2 and 12),
 distance integer not null check(distance between 0 and 2000000),
 achieved_at timestamptz not null default clock_timestamp()
);
create index chacha_scores_v4_ranking on public.chacha_scores_v4(distance desc,achieved_at asc,player_hash asc);
alter table public.chacha_scores_v4 enable row level security;
revoke all on public.chacha_scores_v4 from public, anon, authenticated;
grant select, insert, update, delete on public.chacha_scores_v4 to service_role;

create function public.chacha_ranking_v4(p_player_hash text default '') returns jsonb
language sql stable security invoker set search_path = '' as $$
 with ranked as (
  select row_number() over(order by distance desc,achieved_at asc,player_hash asc) as rank,
   player_hash,nickname,distance,achieved_at from public.chacha_scores_v4
 ), leaders as (select rank,nickname,distance,achieved_at from ranked order by rank limit 20)
 select jsonb_build_object(
  'leaders',coalesce((select jsonb_agg(to_jsonb(l) order by l.rank) from leaders l),'[]'::jsonb),
  'mine',(select jsonb_build_object('rank',rank,'nickname',nickname,'distance',distance) from ranked where player_hash=p_player_hash),
  'total',(select count(*) from public.chacha_scores_v4));
$$;

create function public.chacha_submit_score_v4(p_player_hash text,p_run_id uuid,p_nickname text,p_ticks integer,p_distance integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_run public.chacha_runs; v_elapsed double precision;
begin
 select * into v_run from public.chacha_runs where id=p_run_id and player_hash=p_player_hash for update;
 if not found or v_run.submitted_at is not null or v_run.ranking_version<>4 then raise exception 'INVALID_RUN'; end if;
 v_elapsed=extract(epoch from clock_timestamp()-v_run.started_at);
 if p_ticks<1 or p_ticks>432000 or p_ticks/120.0>v_elapsed+3 or v_elapsed>86400 then raise exception 'INVALID_DURATION'; end if;
 if char_length(p_nickname)<2 or char_length(p_nickname)>12 or p_distance<1 or p_distance>2000000 then raise exception 'INVALID_SCORE'; end if;
 update public.chacha_runs set submitted_at=clock_timestamp() where id=p_run_id;
 insert into public.chacha_scores_v4 as s(player_hash,nickname,distance)
 values(p_player_hash,p_nickname,p_distance)
 on conflict(player_hash) do update set nickname=excluded.nickname,distance=excluded.distance,achieved_at=clock_timestamp()
 where excluded.distance>s.distance;
 if not found then raise exception 'SCORE_NOT_IMPROVED'; end if;
 return public.chacha_ranking_v4(p_player_hash);
end $$;
revoke all on function public.chacha_ranking_v4(text),public.chacha_submit_score_v4(text,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.chacha_ranking_v4(text),public.chacha_submit_score_v4(text,uuid,text,integer,integer) to service_role;
create policy chacha_scores_v4_no_direct_access on public.chacha_scores_v4 for all to anon,authenticated using(false) with check(false);
create function public.chacha_start_run_v4(p_player_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_run public.chacha_runs; v_count integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_player_hash,0));
 select count(*) into v_count from public.chacha_runs
 where player_hash=p_player_hash and started_at>clock_timestamp()-interval '1 minute';
 if v_count>=12 then raise exception 'RUN_RATE_LIMIT'; end if;
 delete from public.chacha_runs where started_at<clock_timestamp()-interval '1 day';
 insert into public.chacha_runs(player_hash,ranking_version) values(p_player_hash,4) returning * into v_run;
 return jsonb_build_object('runId',v_run.id,'bestDistance',
  coalesce((select distance from public.chacha_scores_v4 where player_hash=p_player_hash),0));
end $$;


revoke all on function public.chacha_start_run_v4(text) from public,anon,authenticated;
grant execute on function public.chacha_start_run_v4(text) to service_role;
