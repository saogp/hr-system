-- Allow contracts to exist without a template (uploaded legacy PDFs predating the system)
alter table contracts alter column template_id drop not null;
alter table contracts add column if not exists pdf_path text;

-- Private bucket for uploaded legacy contract PDFs; read only via signed URLs
-- generated server-side (admin/manager, or the employee the contract belongs to).
insert into storage.buckets (id, name, public)
values ('contract-pdfs', 'contract-pdfs', false)
on conflict (id) do nothing;
