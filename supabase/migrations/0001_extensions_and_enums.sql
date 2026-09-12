-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type user_role as enum ('admin', 'treasurer', 'seller');

create type campaign_status as enum ('RASCUNHO', 'ATIVA', 'PAUSADA', 'ENCERRADA', 'SORTEADA');

create type number_status as enum (
  'DISPONIVEL',
  'RESERVADO',
  'AGUARDANDO_PAGAMENTO',
  'PAGO',
  'CANCELADO'
);

create type order_status as enum (
  'RESERVADO',
  'AGUARDANDO_PAGAMENTO',
  'PAGO',
  'CANCELADO'
);

create type payment_method as enum ('PIX', 'DINHEIRO', 'OUTRO');
