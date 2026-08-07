'use client';

import { useState } from 'react';
import { signIn, signInWithOAuth } from '@fotosposi/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import LanguageSwitcher from '@/components/language-switcher';
import { GoogleIcon, FacebookIcon } from '@/components/oauth-icons';

export default function LoginPage() {
  const t = useTranslations('auth');
  const c = useTranslations('common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  // Se si arriva qui da una pagina che richiedeva login (es. l'evento di un invito QR), torna lì
  // dopo il login invece di finire sempre su /dashboard — vedi apps/web/src/app/events/[id]/upload.
  const redirect = searchParams.get('redirect') || '';
  const signupHref = redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error: err } = await signIn(email, password);
    if (err) setError(t('error_invalid_credentials'));
    else router.push(redirect || '/dashboard');
  };

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setError('');
    const { error: err } = await signInWithOAuth(provider, redirect || undefined);
    if (err) setError(t('error_invalid_credentials'));
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-center">{t('login_title')}</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('login_email_label')}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login_email_placeholder')} autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('login_password_label')}</Label>
                <a href="/forgot-password" className="text-xs text-brand hover:underline">Password dimenticata?</a>
              </div>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('login_password_placeholder')} autoComplete="current-password" required />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full">{t('login_submit')}</Button>
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-surface px-2 text-text-muted">{c('or_continue_with')}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button type="button" variant="outline" onClick={() => handleOAuth('google')} className="w-full" aria-label="Google">
                <GoogleIcon className="h-5 w-5" />
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOAuth('facebook')} className="w-full" aria-label="Facebook">
                <FacebookIcon className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-sm text-text-muted text-center">
              {t('login_no_account')} <a href={signupHref} className="text-brand hover:underline">{t('login_signup_link')}</a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
