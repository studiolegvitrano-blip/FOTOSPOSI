export interface B2BReport {
  id: string;
  tenant_id: string;
  event_count: number;
  total_uploads: number;
  total_orders: number;
  total_revenue: number;
  period_start: string;
  period_end: string;
  created_at: string;
}
