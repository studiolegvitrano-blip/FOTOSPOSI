'use client';

import { useState } from 'react';
import { signUp } from '@fotosposi/core';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import LanguageSwitcher from '@/components/language-switcher';

export default function SignupPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { data, error: err } = await signUp(email, password, name);
    if (err) {
      setError(t('error_email_taken'));
    } else if (data?.user) {
      await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id, email, name }),
      });
      setSuccess(true);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle className="text-xl">{t('confirm_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-muted">{t('confirm_message')}</p>
          </CardContent>
          <CardFooter className="justify-center">
            <a href="/login" className="text-brand hover:underline text-sm">{t('signup_login_link')}</a>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-center">{t('signup_title')}</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('signup_name_label')}</Label>
              <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('signup_name_placeholder')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('signup_email_label')}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('signup_email_placeholder')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('signup_password_label')}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('signup_password_placeholder')} required minLength={6} />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full">{t('signup_submit')}</Button>
            <p className="text-sm text-text-muted text-center">
              {t('signup_has_account')} <a href="/login" className="text-brand hover:underline">{t('signup_login_link')}</a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
