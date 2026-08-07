import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES = ['it', 'en-US', 'en-GB', 'de', 'fr', 'es'];

function loadMessages(locale: string) {
  return JSON.parse(readFileSync(join(process.cwd(), 'apps/web/messages', `${locale}.json`), 'utf8'));
}

const EXPECTED_RSVP_KEYS = [
  'submit_label',
  'success_title',
  'success_message',
  'host_label',
  'host_name_placeholder',
  'add_guest_label',
  'remove_label',
  'guest_name_placeholder',
  'adult_label',
  'minor_label',
  'age_label',
  'age_placeholder',
  'intolerances_label',
  'intolerances_hint',
  'other_label',
  'other_placeholder',
  'message_label',
  'message_placeholder',
  'diet_label',
  'diet_hint',
  'diet_onnivoro',
  'diet_vegetariano',
  'diet_vegano',
  'diet_pescatariano',
  'diet_altro',
  'error_generic',
  'submitting_label',
  'host_required',
  'guest_label',
  'section_title',
  'section_confirm',
  'deadline_prefix',
  'email_contact',
  'whatsapp_contact',
];

describe('i18n rsvp namespace', () => {
  it('esiste in tutte le 6 lingue con lo stesso set di chiavi', () => {
    for (const locale of LOCALES) {
      const messages = loadMessages(locale);
      const rsvp = messages.rsvp;
      expect(rsvp, `locale ${locale} manca namespace rsvp`).toBeDefined();
      expect(Object.keys(rsvp).sort(), `locale ${locale}`).toEqual([...EXPECTED_RSVP_KEYS].sort());
    }
  });

  it('ha tutte le chiavi dieta non vuote e diverse dalla chiave (per lingue diverse da it)', () => {
    for (const locale of LOCALES) {
      const rsvp = loadMessages(locale).rsvp;
      for (const key of ['diet_label', 'diet_hint', 'diet_onnivoro', 'diet_vegetariano', 'diet_vegano', 'diet_pescatariano', 'diet_altro']) {
        expect(rsvp[key], `locale ${locale} chiave ${key}`).toBeTruthy();
      }
      if (locale !== 'it') {
        expect(rsvp.diet_onnivoro, `locale ${locale} dieta non tradotta`).not.toBe('Onnivoro');
      }
    }
  });

  it('host_required e guest_label tradotti per tutte le lingue non-italiane', () => {
    const notItalian = LOCALES.filter((l) => l !== 'it');
    for (const locale of notItalian) {
      const rsvp = loadMessages(locale).rsvp;
      expect(rsvp.host_required, `locale ${locale} host_required`).not.toBe('è obbligatorio');
      expect(rsvp.guest_label, `locale ${locale} guest_label`).not.toBe('Accompagnatore');
    }
  });
});
