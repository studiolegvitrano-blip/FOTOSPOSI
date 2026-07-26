'use client';

import { useTranslations } from 'next-intl';
import FacebookFeed, { type FeedPost } from './facebook-feed';

const SAMPLE_IMAGES = [
  '/demo/hero-wedding.jpg',
  '/demo/file_000000005d2071f4b308f4aade4b891f.png',
  '/demo/Gemini_Generated_Image_v3j8xuv3j8xuv3j8.png',
  '/demo/copertina_Facebook.png',
  '/demo/file_000000008fe071f4b9824835a1d2c487.png',
  '/demo/Gemini_Generated_Image_wrdzhuwrdzhuwrdz.png',
  '/demo/Gemini_Generated_Image_8ji5o98ji5o98ji5.png',
  '/demo/Gemini_Generated_Image_x96x8ax96x8ax96x.png',
  '/demo/Gemini_Generated_Image_v3j8xuv3j8xuv3j8.png',
  '/demo/Gemini_Generated_Image_x96x8ax96x8ax96x.png',
  '/demo/hero-wedding.jpg',
  '/demo/file_000000005d2071f4b308f4aade4b891f.png',
];

const SAMPLE_CAPTIONS = [
  'La cerimonia è stata bellissima! Auguri agli sposi ❤️',
  'Il primo ballo: tutti emozionati!',
  'Brindisi infinito al tavolo degli sposi',
  'Il taglio della torta, infine',
  'Selfie di gruppo a fine serata',
  'La confettata: un ricordo indelebile',
] as const;

const SAMPLE_AUTHORS = ['Marco Bianchi', 'Sofia Verdi', 'Luca Ferrari', 'Giulia Rossi'] as const;

type DemoPost = { offsetMin: number; offsetMs: number };

const POSTS: DemoPost[] = [
  { offsetMin: 40, offsetMs: 0 },
  { offsetMin: 60, offsetMs: 0 },
  { offsetMin: 120, offsetMs: 0 },
  { offsetMin: 120, offsetMs: 0 },
  { offsetMin: 180, offsetMs: 0 },
  { offsetMin: 240, offsetMs: 0 },
  { offsetMin: 240, offsetMs: 0 },
  { offsetMin: 300, offsetMs: 0 },
  { offsetMin: 360, offsetMs: 0 },
  { offsetMin: 360, offsetMs: 0 },
  { offsetMin: 420, offsetMs: 0 },
  { offsetMin: 480, offsetMs: 0 },
];

function imgPath(i: number): string {
  return SAMPLE_IMAGES[i % SAMPLE_IMAGES.length] ?? '/demo/hero-wedding.jpg';
}

export type WeddingDemoPost = FeedPost;

export default function WeddingFeedDemo() {
  const t = useTranslations('feed');

  const now = Date.now();
  const posts: FeedPost[] = POSTS.map((p, i) => {
    const likes = 19 + i * 7;
    const comments = [
      { author: 'Anna Conti', text: 'Auguri a entrambi!' },
      { author: 'Paolo Riva', text: 'Che foto pazzesca ❤️' },
    ];
    return {
      id: `wedding-demo-${i}`,
      author: SAMPLE_AUTHORS[i % SAMPLE_AUTHORS.length] ?? 'Ospite',
      timestamp: new Date(now - p.offsetMin * 60000 - p.offsetMs * 600000).toISOString(),
      caption: SAMPLE_CAPTIONS[i % SAMPLE_CAPTIONS.length] ?? '',
      imageUrl: imgPath(i),
      likes,
      comments: i % 2 === 0 ? [comments[0]!, comments[1]!] : [comments[0]!],
    };
  });

  return (
    <div style={{ background: '#f0f2f5', padding: '24px 0', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 16px' }}>
        <h2 style={{ fontSize: 18, textAlign: 'center', marginBottom: 4, color: '#050505', fontWeight: 600 }}>
          La giornata, raccontata dai vostri ospiti
        </h2>
        <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 14, color: '#65676b' }}>
          Foto e messaggi in diretta dalla galleria del matrimonio
        </p>
        <FacebookFeed
          posts={posts}
          loading={false}
          hasMore={false}
          containerClassName="bg-transparent"
        />
      </div>
    </div>
  );
}
