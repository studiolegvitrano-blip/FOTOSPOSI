import { NextRequest, NextResponse } from 'next/server';
import { addSocialPost, fetchOEmbed } from '@fotosposi/social-sharing';

export async function POST(req: NextRequest) {
  try {
    const { event_id, post_url } = await req.json();
    if (!event_id || !post_url) {
      return NextResponse.json({ error: 'event_id and post_url required' }, { status: 400 });
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
