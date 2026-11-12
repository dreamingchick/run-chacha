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
