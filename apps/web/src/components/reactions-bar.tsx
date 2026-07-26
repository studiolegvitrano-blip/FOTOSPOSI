'use client';

import { useTranslations } from 'next-intl';

export type ReactionType = 'like' | 'love' | 'adore' | 'wow' | 'sigh' | 'grrr';

type Props = {
  onPick: (r: ReactionType) => void;
  size?: number;
};

const REACTIONS: { type: ReactionType; emoji: string }[] = [
  { type: 'like', emoji: '👍' },
  { type: 'love', emoji: '❤️' },
  { type: 'adore', emoji: '😍' },
  { type: 'wow', emoji: '😮' },
  { type: 'sigh', emoji: '😢' },
  { type: 'grrr', emoji: '😡' },
];

export default function ReactionsBar({ onPick, size = 40 }: Props) {
  const t = useTranslations('reactions');
  return (
    <div className="fb-reactions absolute -top-12 left-0 flex gap-1 bg-white rounded-full shadow-lg border border-border px-1.5 py-1">
      {REACTIONS.map((r) => (
        <button
          key={r.type}
          type="button"
          aria-label={t(r.type)}
          title={t(r.type)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPick(r.type);
          }}
          className="transition-transform hover:scale-125 focus:scale-125"
          style={{ fontSize: size * 0.6 }}
        >
          <span
            className="block rounded-full"
            style={{ width: size, height: size, lineHeight: `${size}px`, textAlign: 'center' }}
          >
            {r.emoji}
          </span>
        </button>
      ))}
    </div>
  );
}
