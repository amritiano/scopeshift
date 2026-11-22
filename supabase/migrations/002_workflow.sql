begin;
create function public.ss_redact(p_value jsonb) returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare result jsonb; k text; v jsonb;
begin
 if jsonb_typeof(p_value)='object' then
  result='{}'; for k,v in select * from jsonb_each(p_value) loop
   if k not in ('rateMinor','costMinor','headroomMinor','budgetMinor') then result=result||jsonb_build_object(k,ss_redact(v)); end if;
  end loop; return result;
 elsif jsonb_typeof(p_value)='array' then
  select coalesce(jsonb_agg(ss_redact(value)),'[]') into result from jsonb_array_elements(p_value); return result;
 else return p_value; end if;
end $$;
create function public.ss_get_project(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p projects; r text; result jsonb;
begin
 r=ss_role(p_id); if r is null then raise exception 'Project access denied'; end if;
 select * into strict p from projects where id=p_id;
 result=jsonb_build_object('id',p.id,'name',p.name,'client',p.client,'version',p.version,'role',r,'draft',p.draft,
 'baselines',(select coalesce(jsonb_agg(jsonb_build_object('revision',b.revision,'plan',b.plan,'actor',b.actor,'at',b.created_at) order by b.revision),'[]') from baseline_revisions b where b.project_id=p_id),
 'changes',(select coalesce(jsonb_agg(c.data order by c.created_at),'[]') from change_requests c where c.project_id=p_id),
 'scenarios',case when r='client' then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('changeId',s.change_id,'items',s.items) order by s.created_at),'[]') from scenario_snapshots s where s.project_id=p_id) end,
 'proposals',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'changeId',q.change_id,'revision',q.revision,'baseRevision',q.base_revision,'scenario',q.scenario,'status',q.status)||case when d.proposal_id is not null then jsonb_build_object('decision',jsonb_build_object('actor',d.actor,'at',d.created_at,'note',d.note,'revision',d.proposal_revision)) else '{}'::jsonb end order by q.change_id,q.revision),'[]') from proposals q left join approval_decisions d on d.project_id=q.project_id and d.proposal_id=q.id where q.project_id=p_id),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'actor',a.actor,'at',a.created_at,'action',a.action,'detail',a.detail) order by a.created_at,a.id),'[]') from audit_events a where a.project_id=p_id),
 'notifications',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'read',n.read) order by n.created_at),'[]') from notifications n where n.project_id=p_id));
 if r='client' then return ss_redact(result); end if; return result;
end $$;
create function public.ss_workspace() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare w workspaces;
begin
 select x.* into w from workspaces x join memberships m on m.workspace_id=x.id where m.user_id=auth.uid() order by x.created_at limit 1;
 if w.id is null then return null; end if;
 return jsonb_build_object('id',w.id,'name',w.name,'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'pending',(select count(*) from proposals q where q.project_id=p.id and q.status='pending'),'needsEstimate',(select count(*) from change_requests c where c.project_id=p.id and not exists(select 1 from scenario_snapshots s where s.project_id=p.id and s.change_id=c.id))) order by p.name),'[]') from projects p where p.workspace_id=w.id and ss_role(p.id) is not null));
end $$;
create function public.ss_create_workspace(p_name text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare w uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if (select count(*) from memberships where user_id=auth.uid() and role='owner')>=5 then raise exception 'Workspace limit reached'; end if;
 insert into workspaces(name) values(trim(p_name)) returning id into w;
 insert into memberships values(w,auth.uid(),'owner'); return w;
end $$;

-- Structural validation also runs for direct RPC callers. Scheduling is always recalculated in the server.
create function public.ss_validate_plan(p jsonb) returns void language plpgsql set search_path=public,pg_temp as $$
declare t jsonb; r jsonb; d jsonb;
begin
 if jsonb_typeof(p->'tasks') is distinct from 'array' or jsonb_typeof(p->'resources') is distinct from 'array' or jsonb_typeof(p->'weekdays') is distinct from 'array' or jsonb_typeof(p->'holidays') is distinct from 'array' then raise exception 'Invalid plan arrays'; end if;
 if jsonb_array_length(p->'tasks')>200 or jsonb_array_length(p->'resources')>50 or jsonb_array_length(p->'weekdays')=0 then raise exception 'Plan limits exceeded'; end if;
 if (p->>'budgetMinor') is null or (p->>'budgetMinor')::numeric < 0 or (p->>'budgetMinor')::numeric > 1000000000000 or mod((p->>'budgetMinor')::numeric,1)<>0 then raise exception 'Invalid budget'; end if;
 if p->>'currency' is null or (p->>'currency') not in ('INR','USD','GBP','EUR','AUD','CAD','SGD') or not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Invalid currency or timezone'; end if;
 if (p->>'start')::date > (p->>'deadline')::date or p->>'start' is null or p->>'deadline' is null then raise exception 'Invalid dates'; end if;
 if exists(select 1 from jsonb_array_elements(p->'weekdays') v where (v#>>'{}')::int not between 0 and 6) then raise exception 'Invalid working day'; end if;
 if exists(select 1 from jsonb_array_elements(p->'tasks') x group by x->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(p->'resources') x group by x->>'id' having count(*)>1) then raise exception 'Duplicate identifiers'; end if;
 for r in select * from jsonb_array_elements(p->'resources') loop
  if coalesce(length(r->>'id'),0)=0 or coalesce(length(r->>'name'),0)=0 or (r->>'dailyHours') is null or (r->>'rateMinor') is null or (r->>'dailyHours')::numeric not between 0 and 24 or mod((r->>'dailyHours')::numeric*4,1)<>0 or (r->>'rateMinor')::numeric not between 0 and 100000000 or mod((r->>'rateMinor')::numeric,1)<>0 then raise exception 'Invalid resource'; end if;
  perform (r->>'availableFrom')::date;
 end loop;
 for t in select * from jsonb_array_elements(p->'tasks') loop
  if coalesce(length(trim(t->>'title')),0)=0 or coalesce(length(trim(t->>'acceptance')),0)=0 or coalesce(length(t->>'id'),0)=0 or (t->>'hours') is null or (t->>'hours')::numeric <=0 or (t->>'hours')::numeric>10000 or mod((t->>'hours')::numeric*4,1)<>0 then raise exception 'Missing estimate or acceptance'; end if;
  if not exists(select 1 from jsonb_array_elements(p->'resources') x where x->>'id'=t->>'resourceId' and (x->>'dailyHours')::numeric>0) then raise exception 'Missing or zero-capacity assignee'; end if;
  if jsonb_typeof(t->'dependencies') is distinct from 'array' then raise exception 'Invalid dependencies'; end if;
  for d in select * from jsonb_array_elements(t->'dependencies') loop
   if not exists(select 1 from jsonb_array_elements(p->'tasks') x where x->>'id'=d#>>'{}') then raise exception 'Missing dependency'; end if;
  end loop;
 end loop;
 if exists(with recursive edges as (select x->>'id' a, d#>>'{}' b from jsonb_array_elements(p->'tasks') x cross join lateral jsonb_array_elements(x->'dependencies') d), walk(a,b,path,cycle) as (select a,b,array[a,b],a=b from edges union all select w.a,e.b,w.path||e.b,e.b=any(w.path) from walk w join edges e on w.b=e.a where not w.cycle) select 1 from walk where cycle) then raise exception 'Dependency cycle'; end if;
end $$;
create function public.ss_create_project(p_workspace uuid,p_name text,p_client text,p_draft jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare id uuid;
begin
 if not exists(select 1 from memberships where workspace_id=p_workspace and user_id=auth.uid() and role='owner') then raise exception 'No permission to create project'; end if;
 if (select count(*) from projects where workspace_id=p_workspace)>50 then raise exception 'Project limit reached'; end if;
 perform ss_validate_plan(p_draft);
 insert into projects(workspace_id,name,client,draft) values(p_workspace,p_name,p_client,p_draft) returning projects.id into id;
 insert into project_access values(id,auth.uid(),'lead'); return ss_get_project(id);
end $$;

-- One locked project row serializes all state transitions. Never trust a client-supplied next state.
create function public.ss_save_project(p_id uuid,p_version integer,p_command jsonb,p_next jsonb default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects; r text; a text; actor text; q proposals; b integer; rev integer; cid text; scenario jsonb; decision boolean; note text; qid text; items jsonb;
begin
 select * into strict p from projects where id=p_id for update;
 r=ss_role(p_id); a=p_command->>'action'; actor=coalesce(auth.jwt()->>'email',auth.uid()::text);
 if r is null then raise exception 'Project access denied'; end if;
 if p.version<>p_version then raise exception using errcode='40001',message='Concurrent project update'; end if;
 if a in ('baseline','submit','withdraw','apply') and r not in ('owner','lead') then raise exception 'No permission'; end if;
 if a='decide' and r not in ('owner','lead','client') then raise exception 'No permission'; end if;
 if a='estimate' and r not in ('owner','lead','member') then raise exception 'No permission'; end if;
 if a not in ('baseline','request','estimate','submit','withdraw','decide','apply') or a is null then raise exception 'Unknown action'; end if;
 select coalesce(max(revision),0) into b from baseline_revisions where project_id=p_id;
 if a='baseline' then
  if b<>0 then raise exception 'Initial baseline already approved'; end if;
  perform ss_validate_plan(p_command->'plan');
  insert into baseline_revisions values(p_id,1,p_command->'plan',actor,now());
 elsif a='request' then
  if b=0 then raise exception 'Approve a baseline first'; end if;
  if (select count(*) from change_requests where project_id=p_id)>500 then raise exception 'Request limit reached'; end if;
  if coalesce(length(trim(p_command#>>'{change,title}')),0) not between 1 and 200 or coalesce(length(trim(p_command#>>'{change,reason}')),0) not between 1 and 4000 or coalesce(length(trim(p_command#>>'{change,assumptions}')),0) not between 1 and 4000 or coalesce(length(trim(p_command#>>'{change,requester}')),0) not between 1 and 200 then raise exception 'Incomplete change request'; end if;
  perform (p_command#>>'{change,requestedDate}')::date;
  if jsonb_typeof(p_command#>'{change,edits}') is distinct from 'array' or p_command#>>'{change,priority}' not in ('low','medium','high') then raise exception 'Invalid request'; end if;
  insert into change_requests(project_id,id,data) values(p_id,p_command#>>'{change,id}',p_command->'change');
 elsif a='estimate' then
  items='[]';
  if jsonb_typeof(p_command->'scenarios') is distinct from 'array' or jsonb_array_length(p_command->'scenarios') not between 1 and 3 then raise exception 'Calculate one to three scenarios'; end if;
  for scenario in select * from jsonb_array_elements(p_command->'scenarios') loop
   if (scenario->>'inputRevision')::int is distinct from b or b=0 then raise exception 'Stale baseline'; end if;
   items=items||jsonb_build_array(jsonb_set(scenario,'{result}',ss_schedule_plan(scenario->'plan')));
  end loop;
  insert into scenario_snapshots(project_id,change_id,baseline_revision,items,actor) values(p_id,p_command->>'proposalId',b,items,actor);
 elsif a='submit' then
  cid=p_command->>'proposalId'; scenario=p_command->'scenario';
  if (scenario->>'inputRevision')::int is distinct from b or b=0 then raise exception 'Stale baseline'; end if;
  if exists(select 1 from proposals where project_id=p_id and change_id=cid and status in ('approved','applied')) then raise exception 'Withdraw approved proposal before editing; applied changes cannot be repeated'; end if;
  perform ss_validate_plan(scenario->'plan');
  if jsonb_typeof(scenario->'result') is distinct from 'object' or jsonb_typeof(scenario->'assumptions') is distinct from 'array' then raise exception 'Missing scenario snapshot'; end if;
  select coalesce(max(revision),0)+1 into rev from proposals where project_id=p_id and change_id=cid;
  update proposals set status='withdrawn' where project_id=p_id and change_id=cid and status='pending';
  update notifications set read=true where project_id=p_id and proposal_id in (select id from proposals where project_id=p_id and change_id=cid);
  qid=cid||'-r'||rev;
  insert into proposals values(p_id,qid,cid,rev,b,scenario,'pending');
  insert into notifications(project_id,proposal_id,title) values(p_id,qid,'Approval requested: proposal revision '||rev);
 else
  select * into strict q from proposals where project_id=p_id and id=p_command->>'proposalId';
  if a='decide' then
   if q.status<>'pending' or q.revision is distinct from (p_command->>'proposalRevision')::int or q.base_revision<>b then raise exception 'Exact proposal revision is no longer pending'; end if;
   note=trim(p_command->>'note'); decision=(p_command->>'approve')::boolean;
   if note is null or decision is null then raise exception 'Decision and note required'; end if;
   insert into approval_decisions values(p_id,q.id,q.revision,actor,decision,note,now());
   update proposals set status=case when decision then 'approved' else 'rejected' end where project_id=p_id and id=q.id;
   update notifications set read=true where project_id=p_id and proposal_id=q.id;
  elsif a='withdraw' then
   if q.status not in ('pending','approved') then raise exception 'Proposal cannot be withdrawn'; end if;
   update proposals set status='withdrawn' where project_id=p_id and id=q.id;
   update notifications set read=true where project_id=p_id and proposal_id=q.id;
  elsif a='apply' then
   if q.status<>'approved' or q.base_revision<>b or not exists(select 1 from approval_decisions where project_id=p_id and proposal_id=q.id and proposal_revision=q.revision and approved) then raise exception 'Only a current approved revision can be applied once'; end if;
   perform ss_validate_plan(q.scenario->'plan');
   insert into baseline_revisions values(p_id,b+1,q.scenario->'plan',actor,now());
   update proposals set status='applied' where project_id=p_id and id=q.id;
   update proposals set status='withdrawn' where project_id=p_id and status in ('approved','pending');
   update notifications set read=true where project_id=p_id;
  end if;
 end if;
 update projects set version=version+1 where id=p_id;
 insert into audit_events(project_id,actor,action,detail) values(p_id,actor,a,coalesce(p_command->>'note',p_command#>>'{change,title}','Project version '||(p.version+1)));
 return ss_get_project(p_id);
end $$;
create function public.ss_client_command(p_id uuid,p_command jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if ss_role(p_id) is distinct from 'client' or p_command->>'action' not in ('request','decide') then raise exception 'No permission'; end if;
 return ss_save_project(p_id,(p_command->>'expectedVersion')::int,p_command);
end $$;
create function public.ss_invite(p_project uuid,p_email text,p_role text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare token text;
begin
 if ss_role(p_project) not in ('owner','lead') or ss_role(p_project) is null then raise exception 'No permission'; end if;
 if p_email !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' or length(p_email)>250 then raise exception 'Invalid email'; end if;
 if (select count(*) from invitations where project_id=p_project and expires_at>now())>=50 then raise exception 'Invitation limit reached'; end if;
 token=encode(extensions.gen_random_bytes(32),'hex');
 insert into invitations(project_id,email,role,token_hash,expires_at,created_by) values(p_project,lower(p_email),p_role,extensions.digest(token,'sha256'),now()+interval '48 hours',auth.uid());
 return jsonb_build_object('token',token,'expiresInHours',48);
end $$;
create function public.ss_accept_invite(p_token text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare inv invitations; w uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into inv from invitations where token_hash=extensions.digest(p_token,'sha256') for update;
 if inv.id is null or inv.accepted_at is not null or inv.expires_at<=now() or lower(auth.jwt()->>'email') is distinct from inv.email then raise exception 'Invitation is invalid, expired, used or for another email'; end if;
 select workspace_id into w from projects where id=inv.project_id;
 insert into memberships values(w,auth.uid(),case when inv.role='client' then 'client' else 'member' end) on conflict do nothing;
 insert into project_access values(inv.project_id,auth.uid(),inv.role) on conflict(project_id,user_id) do update set role=excluded.role;
 update invitations set accepted_at=now() where id=inv.id; return inv.project_id;
end $$;
-- Supabase grants functions to PUBLIC by default. Explicitly close every function first.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ss_%' loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.ss_role(uuid),public.ss_get_project(uuid),public.ss_workspace(),public.ss_create_workspace(text),public.ss_create_project(uuid,text,text,jsonb),public.ss_save_project(uuid,integer,jsonb,jsonb),public.ss_client_command(uuid,jsonb),public.ss_invite(uuid,text,text),public.ss_accept_invite(text) to authenticated;
commit;
