import { CapsulePageServer } from './capsule-server';

type Params = { params: Promise<{ id: string }> };

export const metadata = {
  title: 'Capsula del Tempo — Sposi.live',
  robots: { index: false },
};

export default async function Page({ params }: Params) {
  const { id } = await params;
  return <CapsulePageServer eventId={id} />;
}
