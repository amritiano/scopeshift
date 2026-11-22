-- Run only against a disposable, migrated Supabase database as postgres.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database.sql
begin;
insert into auth.users(id,email) values('10000000-0000-0000-0000-000000000001','lead@example.invalid'),('10000000-0000-0000-0000-000000000002','other@example.invalid'),('10000000-0000-0000-0000-000000000003','client@example.invalid');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","email":"lead@example.invalid","role":"authenticated"}',true);
set local role authenticated;
select set_config('ss.workspace',public.ss_create_workspace('Isolation A')::text,true);
do $$ declare p jsonb; v jsonb; id uuid; s jsonb; q text; begin
 p='{"start":"2026-11-23","deadline":"2026-11-24","timezone":"UTC","currency":"INR","budgetMinor":100000,"weekdays":[1,2,3,4,5],"holidays":[],"resources":[{"id":"a","name":"Engineer","dailyHours":8,"rateMinor":101,"availableFrom":"2026-11-23"}],"tasks":[{"id":"one","title":"One","hours":8,"resourceId":"a","dependencies":[],"acceptance":"Reviewed"}]}'::jsonb;
 v=public.ss_create_project(current_setting('ss.workspace')::uuid,'Test','Synthetic',p); id=(v->>'id')::uuid; perform set_config('ss.project',id::text,true);
 v=public.ss_save_project(id,1,jsonb_build_object('action','baseline','plan',p));
 v=public.ss_save_project(id,2,'{"action":"request","change":{"id":"c1","title":"Add scope","reason":"Test","requester":"Lead","requestedDate":"2026-11-24","priority":"medium","assumptions":"Synthetic","edits":[]}}');
 p=jsonb_set(p,'{tasks}',(p->'tasks')||'[{"id":"two","title":"Two","hours":8,"resourceId":"a","dependencies":["one"],"acceptance":"Reviewed"}]');
 s=jsonb_build_object('id','extend','title','Extend','tradeoff','More work','plan',p,'result','{}'::jsonb,'inputRevision',1,'assumptions',jsonb_build_array('Synthetic'));
 v=public.ss_save_project(id,3,jsonb_build_object('action','submit','proposalId','c1','scenario',s));
 assert (v#>>'{proposals,0,scenario,result,costMinor}')::int=1616,'SQL canonical cost';
 assert v#>>'{proposals,0,scenario,result,finish}'='2026-11-24','SQL sequential forecast';
 begin perform public.ss_save_project(id,3,'{"action":"withdraw","proposalId":"c1-r1"}'); raise exception 'Missing concurrency check'; exception when serialization_failure then null; end;
 -- Editing creates revision 2 and invalidates revision 1.
 v=public.ss_save_project(id,4,jsonb_build_object('action','submit','proposalId','c1','scenario',s));
 assert v#>>'{proposals,0,status}'='withdrawn';
 begin perform public.ss_save_project(id,5,'{"action":"decide","proposalId":"c1-r1","proposalRevision":1,"approve":true,"note":"Stale"}'); raise exception 'Old revision was approved'; exception when raise_exception then if sqlerrm='Old revision was approved' then raise; end if; end;
 perform set_config('ss.token',public.ss_invite(id,'client@example.invalid','client')->>'token',true);
end $$;
-- Another tenant cannot read the project or cost rows.
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","email":"other@example.invalid","role":"authenticated"}',true);
set local role authenticated;
select public.ss_create_workspace('Isolation B');
do $$ begin
 assert (select count(*) from public.resources)=0,'Cross-tenant raw rate read';
 begin perform public.ss_get_project(current_setting('ss.project')::uuid); raise exception 'Cross-tenant project leaked'; exception when raise_exception then if sqlerrm='Cross-tenant project leaked' then raise; end if; end;
end $$;
-- Pending invite grants nothing; accepted invite exposes only a redacted DTO.
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003","email":"client@example.invalid","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v jsonb; id uuid=current_setting('ss.project')::uuid; begin
 assert public.ss_role(id) is null,'Pending invitation grants access';
 perform public.ss_accept_invite(current_setting('ss.token'));
 v=public.ss_get_project(id);
 assert v::text not like '%rateMinor%' and v::text not like '%costMinor%' and v::text not like '%budgetMinor%','Client cost disclosure';
 assert (select count(*) from public.resources)=0,'Client raw cost access';
 begin perform public.ss_save_project(id,5,'{"action":"apply","proposalId":"c1-r2"}'); raise exception 'Client applied change'; exception when raise_exception then if sqlerrm='Client applied change' then raise; end if; end;
 v=public.ss_client_command(id,'{"action":"decide","expectedVersion":5,"proposalId":"c1-r2","proposalRevision":2,"approve":true,"note":"Accept exact revision"}');
 assert v#>>'{proposals,1,status}'='approved';
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","email":"lead@example.invalid","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v jsonb; id uuid=current_setting('ss.project')::uuid; begin
 v=public.ss_save_project(id,6,'{"action":"apply","proposalId":"c1-r2"}');
 assert jsonb_array_length(v->'baselines')=2,'Old baseline lost';
 begin perform public.ss_save_project(id,7,'{"action":"apply","proposalId":"c1-r2"}'); raise exception 'Double application'; exception when raise_exception then if sqlerrm='Double application' then raise; end if; end;
end $$;
reset role;
do $$ begin
 begin update public.baseline_revisions set actor='tampered'; raise exception 'Baseline mutable'; exception when raise_exception then if sqlerrm='Baseline mutable' then raise; end if; end;
end $$;
rollback;
\echo 'Database isolation, revision, canonical calculation and atomic application checks passed.'
