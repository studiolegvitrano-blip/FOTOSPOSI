// Modulo isolato, opt-in. Attivare solo dopo GDPR compliance.
export interface FaceRecognitionConsent {
  id: string;
  event_id: string;
  user_id: string;
  consented: boolean;
  consented_at: string | null;
  created_at: string;
}
