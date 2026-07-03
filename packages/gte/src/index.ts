export interface BrandConfig {
  id: string;
  slug: string;
  name: string;
  description?: string;
  tone_of_voice?: string;
  target_audience?: Record<string, unknown>;
  primary_language?: string;
  supported_languages?: string[];
  hashtag_pool?: string[];
  content_pillars?: Record<string, unknown>;
  social_accounts?: Record<string, unknown>;
  risk_policy?: string;
  created_at: string;
  updated_at: string;
}

export interface EngagementTriage {
  id: string;
  brand_id: string;
  platform: string;
  platform_message_id?: string;
  platform_user_id?: string;
  platform_account_id?: string;
  user_name?: string;
  user_profile_url?: string;
  message_text: string;
  language?: string;
  intent?: string;
  risk?: string;
  confidence?: number;
  needs_review?: boolean;
  suggested_auto_reply?: string;
  auto_reply_sent?: boolean;
  auto_reply_text?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface B2BLead {
  id: string;
  brand_id: string;
  source_platform: string;
  source_user_profile: string;
  source_post_url?: string;
  raw_text: string;
  ai_category?: string;
  ai_confidence?: number;
  ai_summary?: string;
  contact_method?: string;
  contact_status: string;
  marketplace_supplier_id?: string;
  crm_notes?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface TrendIntelligence {
  id: string;
  brand_id: string;
  trend_type: string;
  trend_value: Record<string, unknown>;
  performance_data?: Record<string, unknown>;
  source?: string;
  confidence?: number;
  expires_at?: string;
  created_at: string;
}

export interface ContentPerformance {
  id: string;
  brand_id: string;
  content_id?: string;
  platform: string;
  impressions: number;
  engagements: number;
  engagement_rate?: number;
  clicks: number;
  conversions: number;
  revenue?: number;
  metadata?: Record<string, unknown>;
  recorded_at: string;
}

export {
  getBrandConfig,
  recordEngagement,
  getB2BLeads,
  updateLeadStatus,
  getUGCForPipeline,
  recordPerformance,
} from './service';
