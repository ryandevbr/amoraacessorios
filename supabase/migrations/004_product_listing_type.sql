-- ============================================================================
-- Migração incremental 004: Modalidade do produto (Venda vs Aluguel)
-- Amora Acessórios — Seguro para executar em bancos já em produção.
-- ============================================================================

alter table public.products
  add column if not exists listing_type text not null default 'sale';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_listing_type_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_listing_type_check
      check (listing_type in ('sale', 'rent'));
  end if;
end
$$;

update public.products
set listing_type = 'rent'
where listing_type = 'sale'
  and (
    lower(btrim(category)) in ('aluguel', 'aluguel de bolsas')
    or lower(btrim(material)) in ('aluguel', 'aluguel de bolsas')
  );

notify pgrst, 'reload schema';
