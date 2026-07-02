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

export type { AnalyticsSnapshot, ActivationMetrics, EngagementMetrics, ViralMetrics, B2BConversionMetrics } from './service';

export { getEventAnalytics, getB2BAnalytics, getActivationMetrics, getEngagementMetrics, getViralMetrics, getB2BConversionMetrics } from './service';
