'use client';

import dynamic from 'next/dynamic';

const RsvpForm = dynamic(() => import('./rsvp-form'), {
  ssr: false,
  loading: () => <div style={{ minHeight: 320 }} aria-busy="true" />,
});

export default function RsvpFormClient(props: {
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
}) {
  return <RsvpForm {...props} />;
}
