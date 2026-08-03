import { NextRequest, NextResponse } from 'next/server';
import { submitSupplierApplication, SUPPLIER_CATEGORIES } from '@fotosposi/marketplace';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido.' }, { status: 400 });
  }

  const account_type = String(body.account_type ?? '');
  const category = String(body.category ?? '');
  const email = String(body.email ?? '').trim().toLowerCase();
  const full_name = body.full_name ? String(body.full_name).trim() : '';
  const business_name = body.business_name ? String(body.business_name).trim() : '';
  const phone = body.phone ? String(body.phone).trim() : '';
  const city = body.city ? String(body.city).trim() : '';
  const region = body.region ? String(body.region).trim() : '';
  const country = body.country ? String(body.country).trim() : 'IT';
  const website = body.website ? String(body.website).trim() : '';
  const instagram = body.instagram ? String(body.instagram).trim() : '';
  const description = body.description ? String(body.description).slice(0, 2000) : '';
  const years_experience_raw = Number(body.years_experience);
  const pricing_from_raw = Number(body.pricing_from);
  const agreed_terms = body.agreed_terms === true || body.agreed_terms === 'true';
  const marketing_consent = body.marketing_consent === true || body.marketing_consent === 'true';

  if (account_type !== 'commerciale' && account_type !== 'privato') {
    return NextResponse.json({ error: 'Tipo di account non valido.' }, { status: 400 });
  }
  if (!SUPPLIER_CATEGORIES.includes(category as (typeof SUPPLIER_CATEGORIES)[number])) {
    return NextResponse.json({ error: 'Categoria non valida.' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email non valida.' }, { status: 400 });
  }
  if (!full_name && !business_name) {
    return NextResponse.json({ error: 'Nome o nome azienda obbligatorio.' }, { status: 400 });
  }
  if (!agreed_terms) {
    return NextResponse.json({ error: 'Devi accettare i termini di servizio e la privacy policy.' }, { status: 400 });
  }

  const result = await submitSupplierApplication({
    account_type: account_type as 'commerciale' | 'privato',
    category: category as (typeof SUPPLIER_CATEGORIES)[number],
    full_name: full_name || null,
    business_name: business_name || null,
    email,
    phone: phone || null,
    city: city || null,
    region: region || null,
    country: country || 'IT',
    website: website || null,
    instagram: instagram || null,
    description: description || null,
    years_experience: Number.isFinite(years_experience_raw) ? years_experience_raw : null,
    pricing_from: Number.isFinite(pricing_from_raw) ? pricing_from_raw : null,
    agreed_terms,
    marketing_consent,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
