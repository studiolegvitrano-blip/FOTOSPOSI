'use client';

import { useState } from 'react';

export interface RsvpGuestForm {
  name: string;
  type: 'adult' | 'minor';
  age: string;
  intolerances: string[];
  other: string;
}

export const RSVP_COMMON_INTOLERANCES = [
  'Glutine / Celiachia',
  'Lattosio',
  'Uova',
  'Arachidi',
  'Frutta a guscio',
  'Pesce',
  'Crostacei',
  'Molluschi',
  'Soia',
  'Sedano',
  'Senape',
  'Sesamo',
  'Solfiti',
  'Lupini',
];

interface Props {
  eventId: string;
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
  hostLabel?: string;
  hostNamePlaceholder?: string;
  addGuestLabel?: string;
  removeLabel?: string;
  guestNamePlaceholder?: string;
  adultLabel?: string;
  minorLabel?: string;
  ageLabel?: string;
  agePlaceholder?: string;
  intolerancesLabel?: string;
  intolerancesHint?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  dietLabel?: string;
  dietHint?: string;
  dietOnnivoro?: string;
  dietVegetariano?: string;
  dietVegano?: string;
  dietPescatariano?: string;
  dietAltro?: string;
  errorGeneric?: string;
  submittingLabel?: string;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function RsvpForm({
  eventId,
  submitLabel = 'Conferma presenza',
  successTitle = 'Grazie!',
  successMessage = 'Presenza confermata. A presto!',
  hostLabel = 'Il tuo nome',
  hostNamePlaceholder = 'Nome e cognome',
  addGuestLabel = 'Aggiungi accompagnatore',
  removeLabel = 'Rimuovi',
  guestNamePlaceholder = 'Nome e cognome',
  adultLabel = 'Adulto',
  minorLabel = 'Minore',
  ageLabel = 'Età',
  agePlaceholder = 'Es. 7',
  intolerancesLabel = 'Intolleranze alimentari',
  intolerancesHint = 'Seleziona tutte le intolleranze (per il menu).',
  otherLabel = 'Altro',
  otherPlaceholder = 'Scrivi la tua intolleranza',
  messageLabel = 'Messaggio (opzionale)',
  messagePlaceholder = 'Vuoi dire qualcosa agli sposi?',
  dietLabel = 'Tipo dieta',
  dietHint = 'Aiuta il catering a preparare il menu giusto.',
  dietOnnivoro = 'Onnivoro',
  dietVegetariano = 'Vegetariano',
  dietVegano = 'Vegano',
  dietPescatariano = 'Pescatariano',
  dietAltro = 'Altro',
  errorGeneric = 'Errore nell\'invio. Riprova.',
  submittingLabel = 'Invio in corso...',
}: Props) {
  const [hostName, setHostName] = useState('');
  const [hostIntolerances, setHostIntolerances] = useState<string[]>([]);
  const [hostOther, setHostOther] = useState('');
  const [dietType, setDietType] = useState<'onnivoro' | 'vegetariano' | 'vegano' | 'pescatariano' | 'altro'>('onnivoro');
  const [guests, setGuests] = useState<RsvpGuestForm[]>([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const addGuest = () =>
    setGuests((g) => [...g, { name: '', type: 'adult', age: '', intolerances: [], other: '' }]);

  const updateGuest = (i: number, patch: Partial<RsvpGuestForm>) =>
    setGuests((gs) => gs.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

  const removeGuest = (i: number) => setGuests((gs) => gs.filter((_, idx) => idx !== i));

  const hostIntolerancesAll = hostOther.trim() ? [...hostIntolerances, hostOther.trim()] : hostIntolerances;

  const submit = async () => {
    if (!hostName.trim()) {
      setError(hostLabel + ' è obbligatorio');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        eventId,
        hostName: hostName.trim(),
        hostIntolerances: hostIntolerancesAll,
        dietType,
        guests: guests
          .filter((g) => g.name.trim() !== '')
          .map((g) => ({
            name: g.name.trim(),
            type: g.type,
            age: g.type === 'minor' ? (g.age === '' || g.age == null ? null : Math.floor(Number(g.age))) : null,
            intolerances: g.other.trim() ? [...g.intolerances, g.other.trim()] : g.intolerances,
          })),
        message: message.trim() || null,
      };
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || errorGeneric);
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{successTitle}</p>
        <p style={{ fontSize: 14, opacity: 0.8 }}>{successMessage}</p>
      </div>
    );
  }

  const IntolerancePicker = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {RSVP_COMMON_INTOLERANCES.map((it) => (
        <label key={it} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value.includes(it)}
            onChange={() => onChange(toggleValue(value, it))}
            style={{ width: 16, height: 16 }}
          />
          {it}
        </label>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <label style={{ fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={value.includes(otherLabel)}
            onChange={() => onChange(toggleValue(value, otherLabel))}
            style={{ width: 16, height: 16 }}
          />
          {otherLabel}
        </label>
      </div>
    </div>
  );

  return (
    <div style={{ textAlign: 'left' }}>
      {error && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#fdecea', color: '#b00020', fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{hostLabel}</label>
        <input
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder={hostNamePlaceholder}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{dietLabel}</label>
        <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{dietHint}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {([
            ['onnivoro', dietOnnivoro],
            ['vegetariano', dietVegetariano],
            ['vegano', dietVegano],
            ['pescatariano', dietPescatariano],
            ['altro', dietAltro],
          ] as const).map(([key, label]) => {
            const active = dietType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDietType(key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 13,
                  border: active ? '1px solid #0b2e4f' : '1px solid rgba(0,0,0,0.2)',
                  background: active ? '#0b2e4f' : 'transparent',
                  color: active ? '#fff' : 'inherit',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{intolerancesLabel}</label>
        <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{intolerancesHint}</p>
        <IntolerancePicker value={hostIntolerances} onChange={setHostIntolerances} />
        <input
          value={hostOther}
          onChange={(e) => setHostOther(e.target.value)}
          placeholder={otherPlaceholder}
          style={{ ...inputStyle, marginTop: 8 }}
        />
      </div>

      {guests.map((g, i) => (
        <div key={i} style={{ marginBottom: 16, padding: 14, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Accompagnatore {i + 1}</span>
            <button type="button" onClick={() => removeGuest(i)} style={{ fontSize: 12, color: '#b00020', background: 'none', border: 'none', cursor: 'pointer' }}>
              {removeLabel}
            </button>
          </div>
          <input
            value={g.name}
            onChange={(e) => updateGuest(i, { name: e.target.value })}
            placeholder={guestNamePlaceholder}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input
                type="radio"
                name={`g-type-${i}`}
                checked={g.type === 'adult'}
                onChange={() => updateGuest(i, { type: 'adult', age: '' })}
              />
              {adultLabel}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input
                type="radio"
                name={`g-type-${i}`}
                checked={g.type === 'minor'}
                onChange={() => updateGuest(i, { type: 'minor' })}
              />
              {minorLabel}
            </label>
            {g.type === 'minor' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 13 }}>{ageLabel}:</span>
                <input
                  type="number"
                  min={0}
                  max={18}
                  value={g.age}
                  onChange={(e) => updateGuest(i, { age: e.target.value })}
                  placeholder={agePlaceholder}
                  style={{ ...inputStyle, width: 70 }}
                />
              </div>
            )}
          </div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{intolerancesLabel}</label>
          <IntolerancePicker value={g.intolerances} onChange={(v) => updateGuest(i, { intolerances: v })} />
          <input
            value={g.other}
            onChange={(e) => updateGuest(i, { other: e.target.value })}
            placeholder={otherPlaceholder}
            style={{ ...inputStyle, marginTop: 8 }}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addGuest}
        style={{ marginBottom: 16, padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(0,0,0,0.2)', background: 'transparent', cursor: 'pointer', fontSize: 14 }}
      >
        + {addGuestLabel}
      </button>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{messageLabel}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={messagePlaceholder}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        style={{
          width: '100%',
          padding: '14px 24px',
          borderRadius: 999,
          fontSize: 15,
          fontWeight: 600,
          background: '#0b2e4f',
          color: '#fff',
          border: 'none',
          cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.18)',
  fontSize: 14,
  boxSizing: 'border-box',
};
