-- ============================================================================
-- Migração incremental 005: Espaço dinâmico de promoções em public.store_settings
-- Amora Acessórios — Seguro para executar em bancos já em produção.
-- ============================================================================

alter table public.store_settings
  add column if not exists promo_active boolean not null default true,
  add column if not exists promo_badge text not null default 'CAMPANHA ESPECIAL DA SEMANA',
  add column if not exists promo_title text not null default 'Ganhe uma Consultoria de Automaquiagem!',
  add column if not exists promo_description text not null default E'Já pensou em aprender a escolher os produtos certos para você e ainda descobrir como se maquiar sozinha?\n\n• Nas compras a partir de R$ 150 em qualquer produto da loja, você ganha uma consultoria exclusiva.\n• Veio com uma amiga? Se cada uma comprar a partir de R$ 100, as duas ganham a consultoria!',
  add column if not exists promo_highlight text not null default 'Válido por tempo limitado',
  add column if not exists promo_cta_label text not null default '',
  add column if not exists promo_cta_type text not null default 'vitrine';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_settings_promo_cta_type_check'
      and conrelid = 'public.store_settings'::regclass
  ) then
    alter table public.store_settings
      add constraint store_settings_promo_cta_type_check
      check (promo_cta_type in ('vitrine', 'whatsapp'));
  end if;
end
$$;

notify pgrst, 'reload schema';
