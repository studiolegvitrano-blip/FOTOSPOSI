export interface FaceRecognitionConsent {
  id: string;
  event_id: string;
  user_id: string;
  consented: boolean;
  consented_at: string | null;
  created_at: string;
}

export { getConsent, setConsent, getConsentList, createFaceTag, getFaceTagsByMedia } from './service';
