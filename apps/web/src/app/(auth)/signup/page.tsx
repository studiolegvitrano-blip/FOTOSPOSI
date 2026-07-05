'use client';

import { useState } from 'react';
import { signUp, signInWithOAuth } from '@fotosposi/core';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import LanguageSwitcher from '@/components/language-switcher';
import { PhoneInput, usePhoneDefaultDial } from '@/components/phone-input';
import { GoogleIcon, FacebookIcon, AppleIcon } from '@/components/oauth-icons';

export default function SignupPage() {
  const t = useTranslations('auth');
  const c = useTranslations('common');
  const defaultDial = usePhoneDefaultDial();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneDial, setPhoneDial] = useState(defaultDial);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!gdprConsent) {
      setError(t('signup_gdpr_required'));
      return;
    }
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    const phone = phoneNumber.trim() ? `${phoneDial} ${phoneNumber.trim()}` : '';
    const { data, error: err } = await signUp(email, password, name, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone,
      marketingConsent,
    });
    if (err) {
      setError(t('error_email_taken'));
    } else if (data?.user) {
      await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user.id,
          email,
          name,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone,
          gdprConsent,
          marketingConsent,
        }),
      });
      setSuccess(true);
    } else {
      setSuccess(true);
    }
  };

  const handleOAuth = async (provider: 'google' | 'facebook' | 'apple') => {
    setError('');
    const { error: err } = await signInWithOAuth(provider);
    if (err) setError(t('error_email_taken'));
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('signup_firstname_label')}</Label>
                <Input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('signup_lastname_label')}</Label>
                <Input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('signup_email_label')}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('signup_email_placeholder')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('signup_phone_label')}</Label>
              <PhoneInput
                dial={phoneDial}
                onDialChange={setPhoneDial}
                number={phoneNumber}
                onNumberChange={setPhoneNumber}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('signup_password_label')}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('signup_password_placeholder')} required minLength={6} />
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <label className="flex items-start gap-2 text-sm text-text-muted">
                <input type="checkbox" className="mt-1" checked={gdprConsent} onChange={(e) => setGdprConsent(e.target.checked)} required />
                <span>{t('signup_gdpr_label')} <a href="/privacy" className="underline">{t('signup_privacy_link')}</a></span>
              </label>
              <label className="flex items-start gap-2 text-sm text-text-muted">
                <input type="checkbox" className="mt-1" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />
                <span>{t('signup_marketing_label')}</span>
              </label>
            </div>

            {error && <p className="text-sm text-error">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full">{t('signup_submit')}</Button>
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-surface px-2 text-text-muted">{c('or_continue_with')}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full">
              <Button type="button" variant="outline" onClick={() => handleOAuth('google')} className="w-full" aria-label="Google">
                <GoogleIcon className="h-5 w-5" />
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOAuth('facebook')} className="w-full" aria-label="Facebook">
                <FacebookIcon className="h-5 w-5" />
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOAuth('apple')} className="w-full" aria-label="Apple">
                <AppleIcon className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-sm text-text-muted text-center">
              {t('signup_has_account')} <a href="/login" className="text-brand hover:underline">{t('signup_login_link')}</a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
