export interface GameCategory {
  id: string;
  event_id: string;
  name: string;
  created_at: string;
}

export interface Vote {
  id: string;
  event_id: string;
  category_id: string;
  media_id: string;
  voter_id: string;
  created_at: string;
}

export interface JokeEntry {
  id: string;
  event_id: string;
  from_user: string;
  content: string;
  reveal_at: string;
  created_at: string;
}

export interface PhotoHuntRegistration {
  id: string;
  event_id: string;
  guest_name: string;
  role: 'amico' | 'parente' | 'collega' | 'altro';
  guest_token: string;
  score: number;
  created_at: string;
}

export interface PhotoHuntTask {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  points: number;
  created_at: string;
}

export interface PhotoHuntSubmission {
  id: string;
  event_id: string;
  task_id: string;
  registration_id: string;
  media_id: string | null;
  media_url: string;
  status: 'approved' | 'rejected';
  points_awarded: number;
  created_at: string;
}

export interface DressVote {
  id: string;
  event_id: string;
  voter_id: string;
  vote_type: 'sposo' | 'sposa';
  rating: number;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  event_id: string;
  question_text: string;
  options: string[];
  correct_index: number | null;
  theme_tags: string[][];
  sort_order: number;
  created_at: string;
}

export interface QuizAnswer {
  id: string;
  event_id: string;
  question_id: string;
  guest_token: string;
  guest_name: string | null;
  selected_index: number;
  score: number;
  created_at: string;
}

export interface QuizResult {
  score: number;
  total: number;
  percentage: number;
  theme: string | null;
  answers: QuizAnswer[];
}

export interface EventFeature {
  id: string;
  event_id: string;
  feature_key: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface AvailableFeature {
  key: string;
  label: string;
  description: string;
  icon: string;
  requires_setup: boolean;
  tier: 'free' | 'premium' | 'deluxe';
}

export const AVAILABLE_FEATURES: AvailableFeature[] = [
  { key: 'photo_vote', label: 'Vota le foto', description: 'Gli invitati votano le loro foto preferite per categoria', icon: '📸', requires_setup: false, tier: 'free' },
  { key: 'wall', label: 'Wall Display', description: 'Galleria a rotazione per maxischermo o proiettore', icon: '🖥️', requires_setup: false, tier: 'free' },
  { key: 'quiz', label: 'Quiz sugli Sposi', description: 'Gli invitati rispondono a domande sulla coppia. Scoprono il loro tema matrimonio ideale!', icon: '🎯', requires_setup: true, tier: 'premium' },
  { key: 'photo_hunt', label: 'Caccia alla Foto', description: 'Gli invitati completano missioni fotografiche e guadagnano punti', icon: '🔍', requires_setup: false, tier: 'premium' },
  { key: 'dress_vote', label: 'Vota il Vestito', description: 'Vota l\'abito degli sposi e il meglio vestito tra gli invitati', icon: '👔', requires_setup: false, tier: 'premium' },
  { key: 'video_guestbook', label: 'Video Guestbook', description: 'Messaggi video degli invitati con teleprompter AI', icon: '🎥', requires_setup: false, tier: 'premium' },
  { key: 'photo_overlay', label: 'Photo Overlay', description: 'Foto con frame brandizzato da condividere sui social', icon: '🖼️', requires_setup: false, tier: 'premium' },
  { key: 'wedding_wrapped', label: 'Wedding Wrapped', description: 'Riepilogo personalizzato dell\'evento per ogni invitato', icon: '🎁', requires_setup: false, tier: 'premium' },
  { key: 'kiosk', label: 'Tavolo Selfie', description: 'Chiosco selfie brandizzato con countdown e scatto', icon: '📷', requires_setup: false, tier: 'deluxe' },
  { key: 'wow_walk', label: 'Wow Walk', description: 'Video before/after del walking degli sposi', icon: '🚶', requires_setup: false, tier: 'deluxe' },
  { key: 'video_challenges', label: 'Sfide Addio al Celibato/Nubilato', description: 'Sfide video per addio al celibato e nubilato', icon: '🎬', requires_setup: false, tier: 'deluxe' },
  { key: 'ai_concierge', label: 'AI Concierge', description: 'Assistente AI per gli sposi', icon: '🤖', requires_setup: false, tier: 'deluxe' },
  { key: 'reel_riassunto', label: 'Reel Riassunto', description: 'Video riassunto AI dell\'evento', icon: '🎞️', requires_setup: false, tier: 'deluxe' },
];

export {
  createCategory, getCategories, castVote, getLeaderboard,
  createJoke, getJokes, deleteJoke,
  registerForPhotoHunt, getPhotoHuntTasks, ensureDefaultTasks,
  submitPhotoTask, getPhotoHuntLeaderboard,
  castDressVote, getDressVoteStats, getMyDressVote,
  createQuizQuestion, getQuizQuestions, updateQuizQuestion, deleteQuizQuestion,
  submitQuizAnswers, getQuizLeaderboard, getMyQuizResult,
  getEventFeatures, setEventFeature, seedDefaultQuizQuestions,
} from './service';
