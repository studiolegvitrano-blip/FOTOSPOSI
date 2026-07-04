'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleHash = async () => {
      if (window.location.hash) {
        const { createClient } = await import('@fotosposi/core');
        const supabase = createClient();
        await supabase.auth.getSession();
      }
      router.push('/dashboard');
    };
    handleHash();
  }, [router]);

  return <main className="min-h-screen flex items-center justify-center p-4"><p>Reindirizzamento in corso...</p></main>;
}
