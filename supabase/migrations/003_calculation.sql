begin;
-- Canonical server-independent calculation prevents an RPC caller from forging displayed forecasts.
create function public.ss_schedule_plan(p jsonb) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare todo jsonb; done jsonb='{}'; ledger jsonb='{}'; output jsonb='[]'; warnings jsonb='[]'; utilization jsonb='[]'; t jsonb; r jsonb; dep jsonb; days jsonb; start_day date; day date; finish date; remaining numeric; used numeric; take numeric; capacity numeric; effort numeric=0; cost bigint=0; task_cost bigint; available numeric; assigned numeric; key text; found_task boolean; contention boolean; i integer;
begin
 perform ss_validate_plan(p); todo=p->'tasks'; finish=(p->>'start')::date;
 while jsonb_array_length(todo)>0 loop
  found_task=false;
  for t in select value from jsonb_array_elements(todo) loop
   if not exists(select 1 from jsonb_array_elements_text(t->'dependencies') as deps(dep_id) where not (done ? dep_id)) then found_task=true; exit; end if;
  end loop;
  if not found_task then raise exception 'Dependency cycle'; end if;
  select value into strict r from jsonb_array_elements(p->'resources') where value->>'id'=t->>'resourceId';
  capacity=(r->>'dailyHours')::numeric;
  if capacity<=0 then raise exception 'Zero capacity'; end if;
  day=greatest((p->>'start')::date,(r->>'availableFrom')::date);
  for dep in select * from jsonb_array_elements(t->'dependencies') loop day=greatest(day,(done->>(dep#>>'{}'))::date+1); end loop;
  remaining=(t->>'hours')::numeric; days='[]'; contention=false;
  while remaining>0 loop
   if day>(p->>'start')::date+3650 then raise exception 'Ten-year horizon exceeded'; end if;
   if p->'weekdays' @> to_jsonb(array[extract(dow from day)::int]) and not p->'holidays' @> to_jsonb(array[day::text]) then
    key=(r->>'id')||':'||day; used=coalesce((ledger->>key)::numeric,0); take=least(remaining,capacity-used);
    if used>0 then contention=true; end if;
    if take>0 then days=days||jsonb_build_array(jsonb_build_object('date',day,'hours',take)); ledger=ledger||jsonb_build_object(key,used+take); remaining=remaining-take; end if;
   end if;
   if remaining>0 then day=day+1; end if;
  end loop;
  task_cost=floor(((t->>'hours')::numeric*4*(r->>'rateMinor')::bigint+2)/4)::bigint;
  if contention then warnings=warnings||jsonb_build_array((t->>'title')||': shared capacity with other work; no overbooking permitted.'); end if;
  output=output||jsonb_build_array(jsonb_build_object('id',t->>'id','start',days->0->>'date','finish',day,'hours',(t->>'hours')::numeric,'costMinor',task_cost,'days',days));
  effort=effort+(t->>'hours')::numeric; cost=cost+task_cost; finish=greatest(finish,day);
  done=done||jsonb_build_object(t->>'id',day);
  select coalesce(jsonb_agg(value order by ord),'[]') into todo from jsonb_array_elements(todo) with ordinality x(value,ord) where value->>'id'<>t->>'id';
 end loop;
 if finish>(p->>'deadline')::date then warnings=warnings||jsonb_build_array('Deadline infeasible: forecast '||finish||' exceeds '||(p->>'deadline')||'.'); end if;
 if cost>(p->>'budgetMinor')::bigint then warnings=warnings||jsonb_build_array('Estimated labor cost exceeds the project budget.'); end if;
 for r in select value from jsonb_array_elements(p->'resources') loop
  available=0; day=(p->>'start')::date;
  while day<=finish loop
   if day>=(r->>'availableFrom')::date and p->'weekdays' @> to_jsonb(array[extract(dow from day)::int]) and not p->'holidays' @> to_jsonb(array[day::text]) then available=available+(r->>'dailyHours')::numeric; end if;
   day=day+1;
  end loop;
  select coalesce(sum((value->>'hours')::numeric),0) into assigned from jsonb_array_elements(p->'tasks') where value->>'resourceId'=r->>'id';
  utilization=utilization||jsonb_build_array(jsonb_build_object('id',r->>'id','hours',assigned,'available',available));
 end loop;
 return jsonb_build_object('effort',effort,'costMinor',cost,'headroomMinor',(p->>'budgetMinor')::bigint-cost,'finish',finish,'feasible',finish<=(p->>'deadline')::date,'warnings',warnings,'tasks',output,'utilization',utilization);
end $$;
revoke all on function public.ss_schedule_plan(jsonb) from public,anon,authenticated;
-- Scenario inputs and results cannot diverge even when written directly through the data API.
create function public.ss_canonical_scenario() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 new.scenario=jsonb_set(new.scenario,'{result}',ss_schedule_plan(new.scenario->'plan'));
 if tg_op='UPDATE' and (new.scenario is distinct from old.scenario or new.revision<>old.revision or new.base_revision<>old.base_revision or new.change_id<>old.change_id) then raise exception 'Proposal inputs are immutable; submit a new revision'; end if;
 return new;
end $$;
revoke all on function public.ss_canonical_scenario() from public,anon,authenticated;
create trigger canonical_scenario before insert or update on public.proposals for each row execute function public.ss_canonical_scenario();
commit;
