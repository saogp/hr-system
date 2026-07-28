-- Ties a survey to a restaurant/company for filtering on the Undersøkelser list.
alter table public.surveys add column if not exists company_id uuid references public.companies(id) on delete set null;
