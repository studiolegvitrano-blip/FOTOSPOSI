// Design system condiviso tra FotoSposi e WeddingMoments
// Solo testi/lingua cambiano tra i due brand

export const brandColors = {
  fotosposi: {
    primary: '#d4a574',
    secondary: '#8b5e3c',
    accent: '#f5e6d3',
    background: '#fafafa',
    text: '#1a1a2e',
  },
  weddingmoments: {
    primary: '#c9a96e',
    secondary: '#7a5c3a',
    accent: '#f0e4d0',
    background: '#fcfcfc',
    text: '#2d2d44',
  },
} as const;

export type Brand = keyof typeof brandColors;

export { ShareButton } from './share-button';
