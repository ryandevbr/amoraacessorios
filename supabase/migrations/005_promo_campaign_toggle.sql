-- ============================================================================
-- Migração incremental 005: Controle da campanha Consultoria de Automaquiagem
-- Amora Acessórios — Seguro para executar em bancos já em produção.
-- ============================================================================

alter table public.store_settings
  add column if not exists promo_campaign_active boolean not null default true;

notify pgrst, 'reload schema';
