alter table public.uniform_issuances add column if not exists company_id uuid references public.companies(id);
