import { NextRequest, NextResponse } from 'next/server';
import { addSocialPost, fetchOEmbed } from '@fotosposi/social-sharing';
import { rateLimit } from '@fotosposi/core';

const ALLOWED_POST_DOMAINS = ['instagram.com', 'www.instagram.com', 'tiktok.com', 'www.tiktok.com', 'facebook.com', 'www.facebook.com', 'spotify.com', 'open.spotify.com'];

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rl = rateLimit(`social-post:${ip}`, 10, 60000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra qualche secondo.' }, { status: 429 });
    }

    const { event_id, post_url } = await req.json();
    if (!event_id || !post_url) {
      return NextResponse.json({ error: 'event_id and post_url required' }, { status: 400 });
    }

    let urlObj: URL;
    try { urlObj = new URL(post_url); } catch {
      return NextResponse.json({ error: 'URL non valido' }, { status: 400 });
    }
    if (!ALLOWED_POST_DOMAINS.includes(urlObj.hostname)) {
      return NextResponse.json({ error: 'Dominio non consentito. Solo Instagram, TikTok, Facebook, Spotify.' }, { status: 400 });
    }

    const platform = (
      post_url.includes('instagram.com') ? 'instagram' :
      post_url.includes('tiktok.com') ? 'tiktok' :
      post_url.includes('facebook.com') ? 'facebook' :
      'other'
    ) as 'instagram' | 'tiktok' | 'facebook' | 'other';

    const oembed = await fetchOEmbed(post_url);

    const { post, error } = await addSocialPost({
      event_id,
      platform,
      post_url,
      thumbnail_url: oembed.thumbnail_url ?? undefined,
      caption: oembed.title ?? undefined,
      author_name: oembed.author_name ?? undefined,
      embed_html: oembed.html ?? undefined,
    });

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ post });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
