/**
 * Hand-written row types mirroring supabase/migrations.
 * Regenerate-able with `npx supabase gen types typescript` once the project is
 * linked; kept by hand here so the app type-checks without a live database.
 */

export type Uuid = string;
/** numeric(12,2) arrives from PostgREST as a number or a string. Never do maths
 *  on it directly — run it through lib/money.ts. */
export type Numeric = number | string;
export type IsoDate = string;

export type PricingModel = "once_off" | "monthly" | "per_unit_monthly" | "quote";
export type OfferingKind = "service" | "product";
/** What shape of thing this is, orthogonal to service/product.
 *  standard: fixed scope at a list price. custom: scope and price per deal.
 *  addon:    bolted onto a standard or custom sale. */
export type OfferingType = "standard" | "custom" | "addon";
/** One showcase link on an offering. */
export interface PortfolioLink {
  label: string;
  url: string;
}
export type OfferingStatus = "active" | "archived";
export type DealStage = "lead" | "meeting" | "proposal" | "pilot" | "won" | "lost";
export type InvoiceStatus = "draft" | "sent" | "overdue" | "paid" | "void";
export type ClientRelationship = "retainer" | "project" | "employer";
export type ClientStatus = "active" | "paused" | "ended";
export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type CategoryGroup = "income" | "business" | "personal" | "internal";
export type GoalKind = "savings" | "mrr" | "spend_cap";
export type Severity = "low" | "med" | "high";
export type PathSource = "subscriptions" | "project_average" | "manual";
/** Admin work is split into Dan's client obligations and his own projects. */
export type AdminTrack = "client" | "business";
export type AdminStatus = "todo" | "doing" | "done";

interface Owned {
  id: Uuid;
  owner_id: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface Settings extends Owned {
  vat_enabled: boolean;
  vat_rate: Numeric;
  invoice_prefix: string;
  next_invoice_number: number;
  business_name: string;
  business_details: string | null;
  mrr_target_zar: Numeric;
  spend_cap_zar: Numeric;
}

export interface PathSegment extends Owned {
  slug: string;
  label: string;
  target_zar: Numeric;
  source: PathSource;
  offering_slug: string | null;
  category: string | null;
  target_units: number | null;
  color: string | null;
  sort: number;
}

export interface Category {
  slug: string;
  label: string;
  group: CategoryGroup;
  color: string | null;
  recurring: boolean;
  sort: number;
  owner_id: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRule extends Owned {
  pattern: string;
  category: string;
  priority: number;
  note: string | null;
}

export interface Client extends Owned {
  slug: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  relationship: ClientRelationship;
  status: ClientStatus;
  notes: string | null;
  /** null means "not chosen" — the UI falls back to the relationship colour. */
  color: string | null;
  billing_email: string | null;
  billing_address: string | null;
  vat_number: string | null;
  registration_number: string | null;
  payment_terms_days: number;
}

/** Revenue is entered by hand now, not derived from an imported statement. */
export interface RevenueEntry extends Owned {
  date: IsoDate;
  description: string;
  amount_zar: Numeric;
  recurring: boolean;
  client_id: Uuid | null;
  offering_id: Uuid | null;
  invoice_id: Uuid | null;
  notes: string | null;
}

export interface AdminItem extends Owned {
  track: AdminTrack;
  title: string;
  detail: string | null;
  status: AdminStatus;
  client_id: Uuid | null;
  due_date: IsoDate | null;
  sort: number;
}

export interface Offering extends Owned {
  slug: string;
  name: string;
  kind: OfferingKind;
  offering_type: OfferingType;
  /** The service line the catalogue groups by. */
  category: string;
  pricing_model: PricingModel;
  setup_fee_zar: Numeric | null;
  monthly_fee_zar: Numeric | null;
  unit_label: string | null;
  unit_cost_monthly_zar: Numeric | null;
  delivery_days: number | null;
  description: string | null;
  deliverables: string[];
  /** What is not included — the line that stops scope creep. */
  excludes: string[];
  portfolio: PortfolioLink[];
  ideal_for: string | null;
  status: OfferingStatus;
  sort: number;
  color: string | null;
}

export interface OfferingTier extends Owned {
  offering_id: Uuid;
  name: string;
  pricing_model: PricingModel;
  setup_fee_zar: Numeric | null;
  monthly_fee_zar: Numeric | null;
  description: string | null;
  deliverables: string[];
  sort: number;
}

export interface Subscription extends Owned {
  client_id: Uuid;
  offering_id: Uuid;
  tier_id: Uuid | null;
  units: number;
  monthly_fee_zar: Numeric;
  started_at: IsoDate;
  ended_at: IsoDate | null;
  status: SubscriptionStatus;
  notes: string | null;
}

export interface Invoice extends Owned {
  client_id: Uuid;
  number: string;
  issued_at: IsoDate | null;
  due_at: IsoDate | null;
  paid_at: IsoDate | null;
  status: InvoiceStatus;
  notes: string | null;
}

export interface InvoiceLine extends Owned {
  invoice_id: Uuid;
  offering_id: Uuid | null;
  tier_id: Uuid | null;
  description: string;
  /** Copied off the deal when a custom build is won, so the invoice still
   *  reads correctly after the deal is edited. */
  scope: string | null;
  qty: Numeric;
  unit_price_zar: Numeric;
  sort: number;
}

/** public.v_invoices */
export interface InvoiceView extends Invoice {
  client_name: string;
  client_slug: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  subtotal_zar: Numeric;
  vat_zar: Numeric;
  total_zar: Numeric;
  effective_status: InvoiceStatus;
}

/** public.v_receivables */
export interface ReceivableView extends InvoiceView {
  days_overdue: number | null;
}

export interface Transaction extends Owned {
  date: IsoDate;
  description: string;
  amount_zar: Numeric;
  category: string;
  is_internal: boolean;
  client_id: Uuid | null;
  invoice_id: Uuid | null;
  source: string;
  import_batch_id: Uuid | null;
  occurrence: number;
}

export interface Deal extends Owned {
  offering_id: Uuid | null;
  tier_id: Uuid | null;
  client_id: Uuid | null;
  title: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  stage: DealStage;
  units: number;
  monthly_value_zar: Numeric | null;
  once_off_value_zar: Numeric | null;
  next_step: string | null;
  next_step_at: IsoDate | null;
  won_at: IsoDate | null;
  lost_reason: string | null;
  notes: string | null;
  /** The typed brief for custom work. Required when the offering is custom. */
  scope: string | null;
  sort: number;
}

/** An extra attached to a deal: a Care Plan, an extra page, a second seat. */
export interface DealAddon extends Owned {
  deal_id: Uuid;
  offering_id: Uuid;
  tier_id: Uuid | null;
  qty: number;
  /** null means "use the add-on's list price". */
  price_zar: Numeric | null;
  pricing_model: PricingModel;
}

export interface Goal extends Owned {
  slug: string;
  name: string;
  kind: GoalKind;
  target_zar: Numeric;
  current_zar: Numeric;
  deadline: IsoDate | null;
  notes: string | null;
  sort: number;
}

export interface GoalEntry extends Owned {
  goal_id: Uuid;
  date: IsoDate;
  amount_zar: Numeric;
  note: string | null;
}

export interface WeeklyTarget {
  metric: string;
  owner_id: Uuid | null;
  label: string;
  target: number;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyScore extends Owned {
  week_start: IsoDate;
  metric: string;
  value: number;
}

export interface DailyTask extends Owned {
  date: IsoDate;
  label: string;
  done: boolean;
  sort: number;
}

export interface Alert extends Owned {
  severity: Severity;
  title: string;
  body: string | null;
  resolved_at: string | null;
}

/** public.v_offering_stats */
export interface OfferingStats {
  offering_id: Uuid;
  owner_id: Uuid | null;
  slug: string;
  name: string;
  category: string;
  active_subscriptions: number;
  active_units: number;
  mrr_zar: Numeric;
  open_deals: number;
  pipeline_value_zar: Numeric;
  won_deals: number;
  lost_deals: number;
  win_rate_pct: number | null;
  invoiced_zar: Numeric;
  revenue_ytd_zar: Numeric;
}

/** public.v_monthly_income */
export interface MonthlyIncome {
  owner_id: Uuid | null;
  month: IsoDate;
  total_zar: Numeric;
  recurring_zar: Numeric | null;
  once_off_zar: Numeric | null;
}

/** public.v_monthly_spend */
export interface MonthlySpend {
  owner_id: Uuid | null;
  month: IsoDate;
  category_group: CategoryGroup;
  category: string;
  spend_zar: Numeric;
  tx_count: number;
}

export const PRICING_MODEL_LABEL: Record<PricingModel, string> = {
  once_off: "Once-off",
  monthly: "Monthly",
  per_unit_monthly: "Per unit / month",
  quote: "Quote",
};

export const OFFERING_TYPE_LABEL: Record<OfferingType, string> = {
  standard: "Standard",
  custom: "Custom",
  addon: "Add-on",
};

/** Catalogue order within a service line: packages, then bespoke, then extras. */
export const OFFERING_TYPE_ORDER: Record<OfferingType, number> = {
  standard: 0,
  custom: 1,
  addon: 2,
};

export const ADMIN_TRACK_LABEL: Record<AdminTrack, string> = {
  client: "Clients",
  business: "Business",
};

export const ADMIN_STATUSES: AdminStatus[] = ["todo", "doing", "done"];

export const ADMIN_STATUS_LABEL: Record<AdminStatus, string> = {
  todo: "To do",
  doing: "In progress",
  done: "Done",
};

export const DEAL_STAGES: DealStage[] = ["lead", "meeting", "proposal", "pilot", "won", "lost"];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  lead: "Lead",
  meeting: "Meeting",
  proposal: "Proposal",
  pilot: "Pilot",
  won: "Won",
  lost: "Lost",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

export const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  income: "Income",
  business: "Business",
  personal: "Personal",
  internal: "Internal",
};

export const CATEGORY_SUGGESTIONS = ["Web", "AI", "Systems", "Retainer", "SaaS", "Content", "Other"];
