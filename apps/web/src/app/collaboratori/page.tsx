'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SUPPLIER_CATEGORIES } from '@fotosposi/marketplace';

interface FormState {
  account_type: 'commerciale' | 'privato';
  category: string;
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  address: string;
  vat_number: string;
  city: string;
  region: string;
  country: string;
  website: string;
  instagram: string;
  description: string;
  years_experience: string;
  pricing_from: string;
  agreed_terms: boolean;
  marketing_consent: boolean;
}

const INITIAL: FormState = {
  account_type: 'commerciale',
  category: 'fotografo',
  full_name: '',
  business_name: '',
  email: '',
  phone: '',
  address: '',
  vat_number: '',
  city: '',
  region: '',
  country: 'IT',
  website: '',
  instagram: '',
  description: '',
  years_experience: '',
  pricing_from: '',
  agreed_terms: false,
  marketing_consent: false,
};

const EURO_COUNTRIES = [
  { code: 'IT', label: 'Italia' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'DE', label: 'Deutschland' },
  { code: 'FR', label: 'France' },
  { code: 'ES', label: 'España' },
  { code: 'CH', label: 'Schweiz' },
  { code: 'AT', label: 'Österreich' },
  { code: 'PT', label: 'Portugal' },
  { code: 'NL', label: 'Nederland' },
  { code: 'BE', label: 'Belgique' },
  { code: 'IE', label: 'Ireland' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'OTHER', label: 'Altro / Other' },
];

const CATEGORY_LABEL_IT: Record<string, string> = {
  fotografo: 'Fotografo',
  video: 'Videomaker',
  catering: 'Catering / Ristorazione',
  location: 'Location / Venue',
  fiori: 'Fiorista / Decorazioni',
  musica: 'Musica / DJ / Live',
  abiti: 'Abiti da sposa / cerimonia',
  torte: 'Wedding cake / pasticceria',
  parrucchiere: 'Parrucchiere',
  estetista: 'Estetista',
  makeup: 'Makeup artist',
  autonoleggio: 'Autonoleggio',
  wedding_planner: 'Wedding planner',
  animazione: 'Animazione / Intrattenimento',
  servizio_consigliato: 'Servizio consigliato',
  altro: 'Altro',
};

const INPUT_CLASS = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export default function CollaboratoriPage() {
  const t = useTranslations('collaboratori');
  const nav = useTranslations('nav');
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!form.agreed_terms) {
      setError(t('agreed_terms') + ' — ' + t('required_field'));
      return;
    }
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(t('required_field') + ': email');
      return;
    }
    if (!form.full_name && !form.business_name) {
      setError(t('required_field') + ': nome o azienda');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/suppliers/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || t('error_generic'));
        return;
      }
      setSubmitted(true);
    } catch {
      setError(t('error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(INITIAL);
    setSubmitted(false);
    setError(null);
  };

  if (submitted) {
    return (
      <main className="max-w-3xl mx-auto p-4 sm:p-8 min-h-[80vh] flex items-center">
        <Card className="w-full text-center">
          <CardContent className="pt-10 pb-10 px-6 space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-3xl">
              ✓
            </div>
            <h1 className="text-2xl font-bold">{t('success_title')}</h1>
            <p className="text-text-muted max-w-md mx-auto">{t('success_message')}</p>
            <Button onClick={resetForm} variant="outline">{t('submit_another')}</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="space-y-3 mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-text-muted max-w-2xl">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo account */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('account_type_label')}</label>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer rounded-md border border-input px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="account_type"
                    value="commerciale"
                    checked={form.account_type === 'commerciale'}
                    onChange={() => update('account_type', 'commerciale')}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t('account_type_commerciale')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer rounded-md border border-input px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="account_type"
                    value="privato"
                    checked={form.account_type === 'privato'}
                    onChange={() => update('account_type', 'privato')}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t('account_type_privato')}</span>
                </label>
              </div>
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium">{t('category_label')} *</label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className={INPUT_CLASS}
              >
                {SUPPLIER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL_IT[c] ?? c}</option>
                ))}
              </select>
            </div>

            {/* Nome */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="full_name" className="text-sm font-medium">{t('full_name_label')} *</label>
                <input
                  id="full_name"
                  type="text"
                  value={form.full_name}
                  onChange={(e) => update('full_name', e.target.value)}
                  placeholder={t('full_name_placeholder')}
                  className={INPUT_CLASS}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="business_name" className="text-sm font-medium">{t('business_name_label')}</label>
                <input
                  id="business_name"
                  type="text"
                  value={form.business_name}
                  onChange={(e) => update('business_name', e.target.value)}
                  placeholder={t('business_name_placeholder')}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Email + Telefono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">{t('email_label')} *</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="mario@rossi.com"
                  className={INPUT_CLASS}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">{t('phone_label')}</label>
                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="+39 333 1234567"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Indirizzo (per entrambi) */}
            <div className={form.account_type === 'commerciale' ? 'space-y-2' : 'space-y-2'}>
              <label htmlFor="address" className="text-sm font-medium">{t('address_label')}</label>
              <input
                id="address"
                type="text"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder={t('address_placeholder')}
                className={INPUT_CLASS}
              />
            </div>

            {/* Partita IVA (solo commerciale) */}
            {form.account_type === 'commerciale' && (
              <div className="space-y-2">
                <label htmlFor="vat_number" className="text-sm font-medium">{t('vat_label')}</label>
                <input
                  id="vat_number"
                  type="text"
                  value={form.vat_number}
                  onChange={(e) => update('vat_number', e.target.value.trim())}
                  placeholder="IT01234567890"
                  className={INPUT_CLASS}
                />
              </div>
            )}

            {/* Città + Regione */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="city" className="text-sm font-medium">{t('city_label')}</label>
                <input
                  id="city"
                  type="text"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="Roma"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="region" className="text-sm font-medium">{t('region_label')}</label>
                <input
                  id="region"
                  type="text"
                  value={form.region}
                  onChange={(e) => update('region', e.target.value)}
                  placeholder="RM / Lazio"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Paese */}
            <div className="space-y-2">
              <label htmlFor="country" className="text-sm font-medium">{t('country_label')}</label>
              <select
                id="country"
                value={form.country}
                onChange={(e) => update('country', e.target.value)}
                className={INPUT_CLASS}
              >
                {EURO_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Website + Instagram */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="website" className="text-sm font-medium">{t('website_label')}</label>
                <input
                  id="website"
                  type="url"
                  value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                  placeholder="https://mario-rossi-photo.com"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="instagram" className="text-sm font-medium">{t('instagram_label')}</label>
                <input
                  id="instagram"
                  type="text"
                  value={form.instagram}
                  onChange={(e) => update('instagram', e.target.value)}
                  placeholder="@mario_rossi_photo"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Esperienza + Prezzo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="years_experience" className="text-sm font-medium">{t('years_experience_label')}</label>
                <input
                  id="years_experience"
                  type="number"
                  min="0"
                  max="80"
                  value={form.years_experience}
                  onChange={(e) => update('years_experience', e.target.value)}
                  placeholder="10"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pricing_from" className="text-sm font-medium">{t('pricing_from_label')}</label>
                <input
                  id="pricing_from"
                  type="number"
                  min="0"
                  step="10"
                  value={form.pricing_from}
                  onChange={(e) => update('pricing_from', e.target.value)}
                  placeholder="1200"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Descrizione */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">{t('description_label')}</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder={t('description_placeholder')}
                rows={5}
                maxLength={2000}
                className={INPUT_CLASS}
              />
              <p className="text-xs text-text-muted">{form.description.length}/2000</p>
            </div>

            {/* Consensi */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agreed_terms}
                  onChange={(e) => update('agreed_terms', e.target.checked)}
                  className="mt-1 accent-primary"
                  required
                />
                <span className="text-sm">{t('agreed_terms')} *</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.marketing_consent}
                  onChange={(e) => update('marketing_consent', e.target.checked)}
                  className="mt-1 accent-primary"
                />
                <span className="text-sm">{t('marketing_consent')}</span>
              </label>
            </div>

            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? t('submitting') : t('submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
