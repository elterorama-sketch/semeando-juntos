# Semeando Juntos

Sistema de **venda assistida** de números de campanha/rifa para igreja. O
comprador nunca acessa o sistema — fala com um vendedor autorizado, que
reserva o(s) número(s) e registra o pagamento depois. Mobile-first, feito
para ser usado na saída de cultos, em poucos segundos por venda.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres, Auth, Realtime, Row Level Security
- Vercel (deploy + cron)

## Por que a concorrência é segura

Duas pessoas nunca conseguem vender o mesmo número. A garantia não está no
frontend — está em `supabase/migrations/0003_functions.sql`, na função
`reserve_numbers()`: ela usa `SELECT ... FOR UPDATE` para travar as linhas
da campanha antes de checar o status, então uma segunda tentativa de
reservar o mesmo número espera a primeira transação terminar e recebe
`NUMERO_INDISPONIVEL` assim que reler o status. Realtime (Supabase
Postgres Changes) propaga a mudança para todas as telas abertas na hora.

## Setup

1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode as migrations em `supabase/migrations/` na ordem numérica — pelo
   SQL Editor do painel, ou com a CLI:
   ```bash
   supabase link --project-ref SEU_PROJETO
   supabase db push
   ```
3. Copie `.env.example` para `.env.local` e preencha com os valores do seu
   projeto Supabase (Project Settings → API).
4. Instale as dependências e rode localmente:
   ```bash
   npm install
   npm run dev
   ```
5. Popule a campanha inicial (200 números, R$ 20,00, sorteio 15/11/2026) e,
   opcionalmente, convide o primeiro administrador:
   ```bash
   ADMIN_EMAIL=voce@igreja.org ADMIN_NAME="Seu Nome" npm run seed
   ```
   O convite chega por e-mail (fluxo padrão do Supabase Auth) com um link
   para o usuário definir a senha.
6. A partir daí, todo novo usuário é criado pelo próprio sistema, em
   **Configurações → Adicionar vendedor** (não existe cadastro público).

## Deploy (Vercel)

1. Importe o repositório no Vercel.
2. Configure as variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `CRON_SECRET`).
3. O `vercel.json` já registra um cron a cada 15 minutos batendo em
   `/api/cron/expire-reservations`, que libera reservas expiradas mesmo
   sem ninguém com o app aberto.

## Papéis

- **admin** — controla campanha, prêmios, usuários, sorteio, auditoria,
  relatórios; pode tudo que tesoureiro e vendedor podem.
- **treasurer** (tesoureiro) — confirma pagamentos, consulta vendas e
  arrecadação; não altera configurações estruturais.
- **seller** (vendedor) — reserva/vende números, só vê e libera as
  próprias vendas (números pagos só um admin libera).

Todas as regras acima existem em **duas camadas**: nas telas (para uma boa
experiência) e no Postgres via RLS + funções `SECURITY DEFINER` (para que
esconder um botão nunca seja a única proteção).

## Estrutura

```
supabase/migrations/   schema, RLS, funções (reservar, pagar, liberar, sortear)
src/app/                rotas (App Router); grupo (app) = área autenticada
src/components/         UI; numbers/ e admin/ agrupam telas maiores
src/lib/                clientes Supabase (browser/server/admin), tipos, helpers
scripts/seed.ts         popula a campanha SEMEANDO JUNTOS (001-200, R$20)
```

## O que fica para depois (fora do MVP, de propósito)

Checkout online, pagamento por cartão, login de comprador, chat,
gamificação — ver seção 35 do briefing do produto. O objetivo é permanecer
pequeno e extremamente funcional para o caso de uso real: vender um número
em poucos segundos, no celular, na saída do culto.
