'use client';

import { useState } from 'react';
import { signUp } from '@fotosposi/core';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import LanguageSwitcher from '@/components/language-switcher';

export default function PartnerSignupPage() {
  const t = useTranslations('auth');
  const pt = useTranslations('partner');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!gdprConsent) {
      setError(t('signup_gdpr_required'));
      return;
    }
    const { data, error: err } = await signUp(email, password, name.trim(), {
      firstName: name.trim(),
    }, '/partner/dashboard');
    if (err) {
      setError(t('error_email_taken'));
    } else if (data?.user) {
      const res = await fetch('/api/partner/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user.id,
          email,
          name: name.trim(),
          company: company.trim() || null,
          gdprConsent,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t('error_email_taken'));
        return;
      }
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
            <p className="text-text-muted">{pt('confirm_message')}</p>
          </CardContent>
          <CardFooter className="justify-center">
            <a href="/partner/login" className="text-brand hover:underline text-sm">{pt('login_link_after_signup')}</a>
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
          <CardTitle className="text-xl text-center">{pt('signup_title')}</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{pt('name_label')}</Label>
              <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">{pt('company_label')}</Label>
              <Input id="company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={pt('company_placeholder')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('signup_email_label')}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('signup_email_placeholder')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('signup_password_label')}</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('signup_password_placeholder')} required minLength={6} />
            </div>
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="flex items-start gap-2 text-sm text-text-muted">
                <input type="checkbox" className="mt-1" checked={gdprConsent} onChange={(e) => setGdprConsent(e.target.checked)} required />
                <span>{t('signup_gdpr_label')} <a href="/privacy" className="underline">{t('signup_privacy_link')}</a></span>
              </label>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full">{pt('signup_submit')}</Button>
            <p className="text-sm text-text-muted text-center">
              {pt('has_account')} <a href="/partner/login" className="text-brand hover:underline">{pt('login_link')}</a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
