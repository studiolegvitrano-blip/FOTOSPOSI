import { createServiceClient } from '@fotosposi/core';

export interface FaceRecognitionConsent {
  id: string;
  event_id: string;
  user_id: string;
  consented: boolean;
  consented_at: string | null;
  created_at: string;
}

export interface FaceTag {
  id: string;
  media_id: string;
  user_id: string;
  face_box: any;
  created_at: string;
}

export async function getConsent(eventId: string, userId: string): Promise<{ consent?: FaceRecognitionConsent; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('face_recognition_consent').select('*').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
  if (error) return { error: error.message };
  return { consent: data ?? undefined };
}

export async function setConsent(eventId: string, userId: string, consented: boolean): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('face_recognition_consent').upsert({
    event_id: eventId,
    user_id: userId,
    consented,
    consented_at: consented ? new Date().toISOString() : null,
  }, { onConflict: 'event_id,user_id' });
  if (error) return { error: error.message };
  return {};
}

export async function getConsentList(eventId: string): Promise<{ consents?: FaceRecognitionConsent[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('face_recognition_consent').select('*').eq('event_id', eventId);
  if (error) return { error: error.message };
  return { consents: data ?? [] };
}

export async function createFaceTag(mediaId: string, userId: string, faceBox?: any): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('face_tags').insert({ media_id: mediaId, user_id: userId, face_box: faceBox ?? null });
  if (error) return { error: error.message };
  return {};
}

export async function getFaceTagsByMedia(mediaId: string): Promise<{ tags?: FaceTag[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('face_tags').select('*').eq('media_id', mediaId);
  if (error) return { error: error.message };
  return { tags: data ?? [] };
}
