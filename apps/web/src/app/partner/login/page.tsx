'use client';

import { useState } from 'react';
import { signIn } from '@fotosposi/core';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import LanguageSwitcher from '@/components/language-switcher';

export default function PartnerLoginPage() {
  const t = useTranslations('auth');
  const pt = useTranslations('partner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(t('error_invalid_credentials'));
      return;
    }
    // Dopo il login verifica che l'account sia un partner registrato; se no,
    // invita a registrarsi come partner (stesso account, se già collaboratore).
    const me = await fetch('/api/partner/me').then((r) => r.json());
    if (me?.partner) {
      router.push('/partner/dashboard');
    } else if (me?.error) {
      setError(me.error);
    } else {
      router.push('/partner/signup');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-center">{pt('login_title')}</CardTitle>
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
                <a href="/forgot-password" className="text-xs text-brand hover:underline">{pt('forgot_password')}</a>
              </div>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('login_password_placeholder')} autoComplete="current-password" required />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full">{pt('login_submit')}</Button>
            <p className="text-sm text-text-muted text-center">
              {pt('no_account')} <a href="/partner/signup" className="text-brand hover:underline">{pt('signup_link')}</a>
            </p>
            <p className="text-xs text-text-muted text-center">
              <a href="/login" className="hover:underline">{pt('sposi_login_link')}</a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
