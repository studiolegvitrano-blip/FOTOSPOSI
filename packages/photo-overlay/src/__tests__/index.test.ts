import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSharp = vi.fn(() => {
  const chain: any = {
    metadata: vi.fn(),
    resize: vi.fn(() => chain),
    composite: vi.fn(() => chain),
    jpeg: vi.fn(() => chain),
    toBuffer: vi.fn(),
  };
  return chain;
});

vi.mock('sharp', () => ({
  default: mockSharp,
}));

const { applyOverlay } = await import('../index');

describe('applyOverlay', () => {
  const baseBranding = {
    coupleNames: 'Mario & Lucia',
    date: '15 Giugno 2026',
    primaryColor: '#d4a574',
    wordmark: 'JustMarry.live',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applica overlay formato square', async () => {
    const mockChain = {
      metadata: vi.fn().mockResolvedValue({ width: 1200, height: 800 }),
      resize: vi.fn().mockReturnThis(),
      composite: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('result')),
    };
    mockSharp.mockReturnValue(mockChain);

    const result = await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: baseBranding,
    });

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(mockChain.jpeg).toHaveBeenCalledWith({ quality: 92 });
  });

  it('applica overlay formato story', async () => {
    const mockChain = {
      metadata: vi.fn().mockResolvedValue({ width: 1080, height: 1920 }),
      resize: vi.fn().mockReturnThis(),
      composite: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('result-story')),
    };
    mockSharp.mockReturnValue(mockChain);

    const result = await applyOverlay(Buffer.from('test'), {
      format: 'story',
      branding: baseBranding,
    });

    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('usa colori e font personalizzati', async () => {
    const mockChain = {
      metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
      resize: vi.fn().mockReturnThis(),
      composite: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('custom')),
    };
    mockSharp.mockReturnValue(mockChain);

    const result = await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: {
        ...baseBranding,
        textColor: '#ff0000',
        fontFamily: 'Arial',
      },
    });

    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('gestisce nomi con caratteri speciali XML', async () => {
    const mockChain = {
      metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
      resize: vi.fn().mockReturnThis(),
      composite: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('safe')),
    };
    mockSharp.mockReturnValue(mockChain);

    const result = await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: { ...baseBranding, coupleNames: 'Marco & Anna <3' },
    });

    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('usa metadati immagine per calcoli', async () => {
    const mockChain = {
      metadata: vi.fn().mockResolvedValue({ width: 640, height: 480 }),
      resize: vi.fn().mockReturnThis(),
      composite: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized')),
    };
    mockSharp.mockReturnValue(mockChain);

    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: baseBranding,
    });

    expect(mockChain.metadata).toHaveBeenCalled();
  });
});
