begin;
create extension if not exists pgcrypto with schema extensions;
create table public.workspaces(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 200), created_at timestamptz not null default now());
create table public.memberships(workspace_id uuid references public.workspaces on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('owner','member','client')), primary key(workspace_id,user_id));
create table public.projects(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces, name text not null check(length(name) between 1 and 200), client text not null default '', draft jsonb not null, version integer not null default 1 check(version > 0));
create table public.project_access(project_id uuid references public.projects on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('lead','member','client')), primary key(project_id,user_id));
create table public.baseline_revisions(project_id uuid references public.projects, revision integer check(revision > 0), plan jsonb not null, actor text not null, created_at timestamptz not null default now(), primary key(project_id,revision));
create table public.resources(project_id uuid, revision integer, resource_id text, name text not null, daily_hours numeric(5,2) check(daily_hours between 0 and 24), rate_minor bigint not null check(rate_minor >= 0), available_from date not null, primary key(project_id,revision,resource_id), foreign key(project_id,revision) references public.baseline_revisions);
create table public.deliverables(project_id uuid, revision integer, deliverable_id text, title text not null, acceptance text not null, effort numeric(8,2) not null check(effort > 0), resource_id text not null, primary key(project_id,revision,deliverable_id), foreign key(project_id,revision,resource_id) references public.resources);
create table public.dependencies(project_id uuid, revision integer, deliverable_id text, predecessor_id text, primary key(project_id,revision,deliverable_id,predecessor_id), foreign key(project_id,revision,deliverable_id) references public.deliverables, foreign key(project_id,revision,predecessor_id) references public.deliverables, check(deliverable_id <> predecessor_id));
create table public.change_requests(project_id uuid references public.projects, id text, data jsonb not null, created_at timestamptz not null default now(), primary key(project_id,id));
create table public.scenario_snapshots(id uuid primary key default gen_random_uuid(), project_id uuid not null, change_id text not null, baseline_revision integer not null, items jsonb not null, actor text not null, created_at timestamptz not null default now(), foreign key(project_id,change_id) references public.change_requests, foreign key(project_id,baseline_revision) references public.baseline_revisions);
create table public.proposals(project_id uuid references public.projects, id text, change_id text not null, revision integer not null check(revision > 0), base_revision integer not null, scenario jsonb not null, status text not null check(status in ('pending','approved','rejected','withdrawn','applied')), primary key(project_id,id), unique(project_id,change_id,revision), foreign key(project_id,change_id) references public.change_requests, foreign key(project_id,base_revision) references public.baseline_revisions);
create unique index once_applied on public.proposals(project_id,change_id) where status='applied';
create table public.approval_decisions(project_id uuid, proposal_id text, proposal_revision integer not null, actor text not null, approved boolean not null, note text not null check(length(note) between 1 and 4000), created_at timestamptz not null default now(), primary key(project_id,proposal_id), foreign key(project_id,proposal_id) references public.proposals);
create table public.audit_events(id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects, actor text not null, action text not null, detail text not null, created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects, proposal_id text not null, title text not null, read boolean not null default false, created_at timestamptz not null default now());
create table public.invitations(id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects, email text not null, role text not null check(role in ('lead','member','client')), token_hash bytea unique not null, expires_at timestamptz not null, accepted_at timestamptz, created_by uuid not null references auth.users);
create index projects_workspace on public.projects(workspace_id);
create index access_user on public.project_access(user_id);
create index memberships_user on public.memberships(user_id);
create index events_project on public.audit_events(project_id,created_at);
create index proposals_pending on public.proposals(project_id,status);
create index notifications_project on public.notifications(project_id,read);
create index invitations_expiry on public.invitations(expires_at);

create function public.ss_role(p_id uuid) returns text language sql stable security definer set search_path=public,pg_temp as $$
 select case when m.role='owner' then 'owner' else a.role end from projects p join memberships m on m.workspace_id=p.workspace_id and m.user_id=auth.uid() left join project_access a on a.project_id=p.id and a.user_id=auth.uid() where p.id=p_id
$$;
create function public.ss_immutable() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception 'Approved records are immutable; create a new revision'; end $$;
create trigger baseline_immutable before update or delete on public.baseline_revisions for each row execute function public.ss_immutable();
create trigger resource_immutable before update or delete on public.resources for each row execute function public.ss_immutable();
create trigger deliverable_immutable before update or delete on public.deliverables for each row execute function public.ss_immutable();
create trigger dependency_immutable before update or delete on public.dependencies for each row execute function public.ss_immutable();
create trigger decision_immutable before update or delete on public.approval_decisions for each row execute function public.ss_immutable();
create trigger audit_immutable before update or delete on public.audit_events for each row execute function public.ss_immutable();
create trigger scenario_immutable before update or delete on public.scenario_snapshots for each row execute function public.ss_immutable();

-- Typed, normalized baseline details accompany the immutable calculation snapshot.
create function public.ss_expand_baseline() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb; t jsonb; d jsonb;
begin
 perform ss_schedule_plan(new.plan);
 for r in select * from jsonb_array_elements(new.plan->'resources') loop
  insert into resources values(new.project_id,new.revision,r->>'id',r->>'name',(r->>'dailyHours')::numeric,(r->>'rateMinor')::bigint,(r->>'availableFrom')::date);
 end loop;
 for t in select * from jsonb_array_elements(new.plan->'tasks') loop
  insert into deliverables values(new.project_id,new.revision,t->>'id',t->>'title',t->>'acceptance',(t->>'hours')::numeric,t->>'resourceId');
 end loop;
 for t in select * from jsonb_array_elements(new.plan->'tasks') loop
  for d in select * from jsonb_array_elements(t->'dependencies') loop
   insert into dependencies values(new.project_id,new.revision,t->>'id',d#>>'{}');
  end loop;
 end loop;
 return new;
end $$;
create trigger expand_baseline after insert on public.baseline_revisions for each row execute function public.ss_expand_baseline();

-- RLS is defense in depth. All mutations use authorized transactional RPCs.
do $$ declare t text; begin
 foreach t in array array['workspaces','memberships','projects','project_access','baseline_revisions','resources','deliverables','dependencies','change_requests','scenario_snapshots','proposals','approval_decisions','audit_events','notifications','invitations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.projects to authenticated;
create policy internal_projects on public.projects for select to authenticated using (coalesce(public.ss_role(id) in ('owner','lead','member'),false));
-- Raw snapshots and rate-bearing tables have no client grants or client policies.
do $$ declare t text; begin
 foreach t in array array['baseline_revisions','resources','deliverables','dependencies','change_requests','scenario_snapshots','proposals','approval_decisions','audit_events','notifications'] loop
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy internal_read on public.%I for select to authenticated using (coalesce(public.ss_role(project_id) in (''owner'',''lead'',''member''),false))',t);
 end loop;
end $$;
commit;
