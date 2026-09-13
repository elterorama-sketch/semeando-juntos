// Hand-written types mirroring supabase/migrations/*.sql.
// Regenerate with `supabase gen types typescript` once the project is
// linked, and replace this file with the generated output.

export type UserRole = "admin" | "treasurer" | "seller";
export type CampaignStatus = "RASCUNHO" | "ATIVA" | "PAUSADA" | "ENCERRADA" | "SORTEADA";
export type NumberStatus =
  | "DISPONIVEL"
  | "RESERVADO"
  | "AGUARDANDO_PAGAMENTO"
  | "PAGO"
  | "CANCELADO";
export type OrderStatus = "RESERVADO" | "AGUARDANDO_PAGAMENTO" | "PAGO" | "CANCELADO";
export type PaymentMethod = "PIX" | "DINHEIRO" | "OUTRO";

export interface Congregation {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
  congregation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  number_count: number;
  number_start: number;
  draw_date: string | null;
  status: CampaignStatus;
  reservation_hours: number | null;
  payment_due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignPrize {
  id: string;
  campaign_id: string;
  position: number;
  title: string;
  description: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  whatsapp: string | null;
  congregation_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  campaign_id: string;
  customer_id: string;
  seller_id: string;
  status: OrderStatus;
  total_cents: number;
  note: string | null;
  intended_payment_method: PaymentMethod | null;
  reserved_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignNumber {
  id: string;
  campaign_id: string;
  number: number;
  status: NumberStatus;
  order_id: string | null;
  reserved_by: string | null;
  reserved_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderNumber {
  id: string;
  order_id: string;
  campaign_number_id: string;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount_cents: number;
  method: PaymentMethod;
  confirmed_by: string;
  confirmed_at: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface Draw {
  id: string;
  campaign_id: string;
  executed_by: string;
  executed_at: string;
  created_at: string;
}

export interface DrawResult {
  id: string;
  draw_id: string;
  prize_id: string;
  campaign_number_id: string;
  customer_id: string;
  created_at: string;
}

export interface ReserveNumbersResult {
  order_id: string;
  total_cents: number;
  expires_at: string | null;
}

export interface ExecuteDrawResult {
  campaign_number_id: string;
  number: number;
  customer_id: string;
  customer_name: string;
}

// Not actually consumed by the Supabase clients (see lib/supabase/client.ts
// for why) -- kept as a reference shape for what `supabase gen types` should
// produce once a real project is linked, and for typing `.rpc()` call sites
// manually where useful.
// Wrapping named interfaces in a mapped type gives TypeScript a fresh
// object-literal-shaped type, which (unlike a plain named interface) is
// treated as assignable to `Record<string, unknown>`. Without this,
// @supabase/postgrest-js's internal `Schema extends GenericSchema` checks
// silently fail (no visible error -- they're evaluated inside a conditional
// type) and every table/rpc call quietly types as `never`.
type Widen<T> = { [K in keyof T]: T[K] };

interface TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> {
  Row: Widen<Row>;
  Insert: Widen<Insert>;
  Update: Widen<Update>;
  // Must be assignable to GenericRelationship[] (a specific object shape),
  // not just unknown[] -- postgrest-js's `Schema extends GenericSchema`
  // check silently fails otherwise and every query resolves to `never`.
  Relationships: any[];
}

export interface Database {
  public: {
    Tables: {
      congregations: TableDef<Congregation>;
      profiles: TableDef<Profile>;
      campaigns: TableDef<Campaign>;
      campaign_prizes: TableDef<CampaignPrize>;
      customers: TableDef<Customer>;
      orders: TableDef<Order>;
      campaign_numbers: TableDef<CampaignNumber>;
      order_numbers: TableDef<OrderNumber>;
      payments: TableDef<Payment>;
      audit_logs: TableDef<AuditLog>;
      draws: TableDef<Draw>;
      draw_results: TableDef<DrawResult>;
    };
    Views: { [_ in never]: never };
    Functions: {
      reserve_numbers: {
        Args: {
          p_campaign_id: string;
          p_numbers: number[];
          p_customer_name: string;
          p_customer_whatsapp?: string | null;
          p_note?: string | null;
          p_congregation_id?: string | null;
          p_payment_method?: PaymentMethod | null;
        };
        Returns: ReserveNumbersResult[];
      };
      confirm_payment: {
        Args: { p_order_id: string; p_amount_cents: number; p_method: PaymentMethod };
        Returns: undefined;
      };
      release_order: { Args: { p_order_id: string }; Returns: undefined };
      execute_draw: {
        Args: { p_campaign_id: string; p_prize_id: string };
        Returns: ExecuteDrawResult[];
      };
      generate_campaign_numbers: { Args: { p_campaign_id: string }; Returns: undefined };
      expire_stale_reservations: { Args: { [_ in never]: never }; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      campaign_status: CampaignStatus;
      number_status: NumberStatus;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
