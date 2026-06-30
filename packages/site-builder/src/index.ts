export interface SiteTemplate {
  id: string;
  name: string;
  palette: string[];
  font_family: string;
  preview_url: string;
  created_at: string;
}

export interface SiteDraft {
  id: string;
  event_id: string;
  template_id: string | null;
  content: Record<string, string>;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiGeneratedText {
  id: string;
  event_id: string;
  prompt: string;
  generated: string;
  section: string;
  created_at: string;
}

export {
  getTemplates,
  getTemplateById,
  createDraft,
  getDraft,
  updateDraft,
  updateDraftTemplate,
  publishSite,
  generateText,
  getGeneratedTexts,
} from './service';
