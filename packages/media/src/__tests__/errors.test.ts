import { describe, it, expect } from 'vitest';
import {
  classifyError,
  FAILURE_CLASS_R2_DOWNLOAD,
  FAILURE_CLASS_WATERMARK,
  FAILURE_CLASS_DRIVE,
  FAILURE_CLASS_DETECT,
  FAILURE_CLASS_INVALID,
  FAILURE_CLASS_DB,
  FAILURE_CLASS_OTHER,
} from '../errors';

describe('classifyError (RIFONDAZIONE 14/08/2026)', () => {
  it('classifica errori R2 download', () => {
    expect(classifyError(new Error('Download R2 fallito (no presigned URL)'))).toBe(FAILURE_CLASS_R2_DOWNLOAD);
    expect(classifyError(new Error('File su R2 non trovato (HTTP 404)'))).toBe(FAILURE_CLASS_R2_DOWNLOAD);
    expect(classifyError('presigned url failed')).toBe(FAILURE_CLASS_R2_DOWNLOAD);
  });

  it('classifica errori watermark (sharp/ffmpeg)', () => {
    expect(classifyError(new Error('sharp composite failed'))).toBe(FAILURE_CLASS_WATERMARK);
    expect(classifyError(new Error('ffmpeg overlay error'))).toBe(FAILURE_CLASS_WATERMARK);
    expect(classifyError('watermark apply failed')).toBe(FAILURE_CLASS_WATERMARK);
  });

  it('classifica errori Drive/OAuth', () => {
    expect(classifyError(new Error('Drive sync fallito: HTTP 401'))).toBe(FAILURE_CLASS_DRIVE);
    expect(classifyError(new Error('oauth token expired'))).toBe(FAILURE_CLASS_DRIVE);
    expect(classifyError(new Error('googleapi 403'))).toBe(FAILURE_CLASS_DRIVE);
  });

  it('classifica errori detect watermark', () => {
    expect(classifyError(new Error('watermark ancora assente dopo repair'))).toBe(FAILURE_CLASS_DETECT);
    expect(classifyError(new Error('detect watermark missing'))).toBe(FAILURE_CLASS_DETECT);
  });

  it('classifica errori DB (constraint/duplicate)', () => {
    expect(classifyError(new Error('duplicate key value violates unique constraint'))).toBe(FAILURE_CLASS_DB);
    expect(classifyError(new Error('relation "media_uploads" does not exist'))).toBe(FAILURE_CLASS_DB);
  });

  it('classifica errori immagine invalida', () => {
    expect(classifyError(new Error('invalid_image decode failed'))).toBe(FAILURE_CLASS_INVALID);
    expect(classifyError('corrupt image')).toBe(FAILURE_CLASS_INVALID);
  });

  it('fallback su other per errori non riconosciuti', () => {
    expect(classifyError(new Error('qualcosa di totalmente ignoto'))).toBe(FAILURE_CLASS_OTHER);
    expect(classifyError(undefined)).toBe(FAILURE_CLASS_OTHER);
    expect(classifyError(12345)).toBe(FAILURE_CLASS_OTHER);
  });
});