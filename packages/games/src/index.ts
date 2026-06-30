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
