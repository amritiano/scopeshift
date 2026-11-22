begin;
create function public.ss_members(p_project uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if coalesce(ss_role(p_project),'') not in ('owner','lead') then raise exception 'No permission to view project members'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'role',case when m.role='owner' then 'owner' else a.role end) order by u.email),'[]') from projects p join memberships m on m.workspace_id=p.workspace_id join auth.users u on u.id=m.user_id left join project_access a on a.project_id=p.id and a.user_id=u.id where p.id=p_project and (m.role='owner' or a.role is not null));
end $$;
create function public.ss_revoke_access(p_project uuid,p_user uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects;
begin
 select * into strict p from projects where id=p_project for update;
 if coalesce(ss_role(p_project),'') not in ('owner','lead') then raise exception 'No permission to revoke project access'; end if;
 if p_user=auth.uid() or exists(select 1 from memberships where workspace_id=p.workspace_id and user_id=p_user and role='owner') then raise exception 'Cannot revoke your own access or a workspace owner'; end if;
 delete from project_access where project_id=p_project and user_id=p_user;
 insert into audit_events(project_id,actor,action,detail) values(p_project,coalesce(auth.jwt()->>'email',auth.uid()::text),'revoke-access','Project membership revoked');
 update projects set version=version+1 where id=p_project; return true;
end $$;
revoke all on function public.ss_members(uuid),public.ss_revoke_access(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ss_members(uuid),public.ss_revoke_access(uuid,uuid) to authenticated;
commit;
