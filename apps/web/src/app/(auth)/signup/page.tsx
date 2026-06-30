'use client';

import { useState } from 'react';
import { signUp } from '@fotosposi/core';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error: err } = await signUp(email, password, name);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <main style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
        <h1>Registrazione completata</h1>
        <p>Controlla la tua email per confermare l'account.</p>
        <a href="/login">Vai al login</a>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Registrati su FotoSposi</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" style={{ padding: '0.5rem 2rem', fontSize: '1rem', cursor: 'pointer' }}>
          Registrati
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Hai già un account? <a href="/login">Accedi</a>
      </p>
    </main>
  );
}
