export interface MediaUpload {
  id: string;
  event_id: string;
  sub_event_id: string | null;
  uploaded_by: string;
  type: 'photo' | 'video';
  url: string;
  drive_file_id: string | null;
  drive_sync_status: 'pending' | 'synced' | 'failed';
  created_at: string;
}

export interface VideoMessage {
  id: string;
  event_id: string;
  from_user: string;
  type: 'welcome' | 'guestbook';
  url: string;
  created_at: string;
}

export type UploadProgressCallback = (progress: number) => void;

export async function compressImage(file: File, maxWidth = 2048): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not available')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob);
        else reject(new Error('Compression failed'));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

export {
  createMediaRecord,
  getMediaByEvent,
  getMediaBySubEvent,
  uploadToStorage,
  createVideoMessage,
  getVideoMessages,
  updateDriveSyncStatus,
} from './service';
