import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>FotoSposi</h1>
      <p style={{ fontSize: '1.2rem', color: '#555', marginBottom: '2rem' }}>
        La piattaforma che accompagna sposi e invitati per tutta la settimana dell'evento.
        Raccolta foto, video, giochi e regali in un unico posto.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link href="/login"
          style={{ padding: '0.75rem 2rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 8 }}>
          Accedi
        </Link>
        <Link href="/signup"
          style={{ padding: '0.75rem 2rem', border: '2px solid #d4a574', color: '#d4a574', textDecoration: 'none', borderRadius: 8 }}>
          Registrati
        </Link>
      </div>
      <div style={{ marginTop: '4rem', textAlign: 'left' }}>
        <h2>Come funziona</h2>
        <ul style={{ lineHeight: 2 }}>
          <li>Creazione evento con template e palette</li>
          <li>QR code a finestra estesa (9 giorni prima + 1 dopo)</li>
          <li>Upload foto/video organizzati per momento</li>
          <li>Giochi, classifiche e wall interattivo</li>
          <li>Stampe e gadget print-on-demand</li>
        </ul>
      </div>
    </main>
  );
}
