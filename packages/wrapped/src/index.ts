export interface GuestWrapped {
  guestName: string;
  coupleName: string;
  eventDate: string;
  brand: 'fotosposi' | 'weddingmoments';
  photoCount: number;
  voteCount: number;
  tagCount: number;
  jokeCount: number;
  videoCount: number;
  giftTotal: number;
  firstUpload: string | null;
  lastUpload: string | null;
  badges: string[];
}

export { getGuestWrapped } from './service';
