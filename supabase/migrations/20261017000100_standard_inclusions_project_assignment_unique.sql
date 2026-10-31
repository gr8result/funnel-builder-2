-- Prevent duplicate active assignments of the same Standard Inclusions schedule to a project.
-- Review and apply through the normal migration process; this file does not modify any live database by itself.
create unique index if not exists builder_project_documents_standard_schedule_assignment_uidx
  on public.builder_project_documents (workspace_id, project_id, related_record_id)
  where related_table = 'standard_inclusions_schedules'
    and document_type = 'other'
    and status = 'active'
    and related_record_id is not null;
