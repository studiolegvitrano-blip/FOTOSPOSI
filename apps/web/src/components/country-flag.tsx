/**
 * CountryFlag — bandiere nazionali come SVG inline.
 *
 * Necessario perché su Windows le emoji bandiere (regional indicator letters)
 * NON renderizzano graficamente: Windows mostra solo la sigla testuale "IT"/"US"
 * invece del tricolore o della bandiera a stelle. macOS/iOS/Android sì, ma per
 * coerenza cross-platform usiamo SVG inline identiche ovunque.
 *
 * Le SVG sono le versioni ufficiali semplificate (Wide-style 3:5 aspect ratio
 * per IT/FR) e 10:19 per US/UK, adattate a un viewBox 24x16 comodo inline.
 */
const flags: Record<string, { viewBox: string; body: React.ReactNode }> = {
  it: {
    viewBox: '0 0 24 16',
    body: (
      <>
        <rect width="8" height="16" x="0" fill="#009246" />
        <rect width="8" height="16" x="8" fill="#FFFFFF" />
        <rect width="8" height="16" x="16" fill="#CE2B37" />
      </>
    ),
  },
  'en-US': {
    viewBox: '0 0 24 13',
    body: (
      <>
        {/* Union Jack canton su campo stars & stripes, semplificato */}
        <rect width="24" height="13" fill="#FFFFFF" />
        {/* Strisce rosse orizzontali (7) */}
        <rect y="1" width="24" height="1" fill="#B22234" />
        <rect y="3" width="24" height="1" fill="#B22234" />
        <rect y="5" width="24" height="1" fill="#B22234" />
        <rect y="7" width="24" height="1" fill="#B22234" />
        <rect y="9" width="24" height="1" fill="#B22234" />
        <rect y="11" width="24" height="1" fill="#B22234" />
        {/* Canton blu 10x7 */}
        <rect width="10" height="7" fill="#3C3B6E" />
        {/* Stelle bianche — griglia 5 righe x 6+5 alternati, semplificate a pallini */}
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: row % 2 === 0 ? 6 : 5 }).map((__, col) => (
            <circle
              key={`${row}-${col}`}
              cx={col * (row % 2 === 0 ? 1.6 : 1.6) + (row % 2 === 0 ? 0.8 : 1.6)}
              cy={row * 1.3 + 0.7}
              r="0.35"
              fill="#FFFFFF"
            />
          )),
        )}
      </>
    ),
  },
  'en-GB': {
    viewBox: '0 0 24 12',
    body: (
      <>
        <rect width="24" height="12" fill="#012169" />
        {/* Croce di S. Giorgio + croci di S. Andrea e S. Patrizio (Union Jack) */}
        <rect x="10" y="0" width="4" height="12" fill="#FFFFFF" />
        <rect x="0" y="4" width="24" height="4" fill="#FFFFFF" />
        <rect x="11" y="0" width="2" height="12" fill="#C8102E" />
        <rect x="0" y="5" width="24" height="2" fill="#C8102E" />
        {/* Diagonali S. Andrea */}
        <path d="M0,0 L24,12 M24,0 L0,12" stroke="#FFFFFF" strokeWidth="2.4" />
        <path d="M0,0 L24,12 M24,0 L0,12" stroke="#C8102E" strokeWidth="1.2" />
        <clipPath id="uk-clip">
          <rect width="24" height="12" />
        </clipPath>
      </>
    ),
  },
  de: {
    viewBox: '0 0 24 16',
    body: (
      <>
        <rect width="24" height="5.33" y="0" fill="#000000" />
        <rect width="24" height="5.33" y="5.33" fill="#DD0000" />
        <rect width="24" height="5.34" y="10.66" fill="#FFCE00" />
      </>
    ),
  },
  fr: {
    viewBox: '0 0 24 16',
    body: (
      <>
        <rect width="8" height="16" x="0" fill="#0055A4" />
        <rect width="8" height="16" x="8" fill="#FFFFFF" />
        <rect width="8" height="16" x="16" fill="#EF4135" />
      </>
    ),
  },
  es: {
    viewBox: '0 0 24 16',
    body: (
      <>
        <rect width="24" height="4" y="0" fill="#AA151B" />
        <rect width="24" height="8" y="4" fill="#F1BF00" />
        <rect width="24" height="4" y="12" fill="#AA151B" />
        {/* Stemma semplificato: scudo rosso centrato */}
        <rect x="10.5" y="5.5" width="3" height="5" fill="#AA151B" opacity="0.85" />
      </>
    ),
  },
};

export default function CountryFlag({
  code,
  className = '',
}: {
  code: string;
  className?: string;
}) {
  const flag = flags[code] ?? flags.it ?? { viewBox: '0 0 24 16', body: null };
  if (!flag) {
    return null;
  }
  return (
    <svg
      viewBox={flag.viewBox}
      className={className}
      role="img"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {flag.body}
    </svg>
  );
}
