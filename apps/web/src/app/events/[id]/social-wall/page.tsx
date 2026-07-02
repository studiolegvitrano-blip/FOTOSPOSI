'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSocialPosts, type SocialPost } from '@fotosposi/social-sharing';
import { getEventById } from '@fotosposi/events';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Camera, Music2, Link as LinkIcon, Loader2 } from 'lucide-react';

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera className="w-4 h-4" />,
  tiktok: <Music2 className="w-4 h-4" />,
  facebook: <Camera className="w-4 h-4" />,
  other: <LinkIcon className="w-4 h-4" />,
};

export default function SocialWallPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [eventHashtag, setEventHashtag] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSocialPosts(eventId).then(({ posts: p }) => { if (p) setPosts(p); });
    getEventById(eventId).then(({ event: e }) => {
      if (e?.hashtag) setEventHashtag(e.hashtag);
    });
  }, [eventId]);

  const handleSubmit = async () => {
    if (!postUrl.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, post_url: postUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); } else if (data.post) {
        setPosts(prev => [data.post, ...prev]);
        setPostUrl('');
      }
    } catch { setError('Errore durante l\'invio'); }
    setSubmitting(false);
  };

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social Wall</h1>
        {eventHashtag && (
          <p className="text-text-muted mt-1">
            Posta con <strong>#{eventHashtag}</strong> o condividi il link dei tuoi post
          </p>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Incolla link Instagram / TikTok / Facebook / Spotify..."
              value={postUrl}
              onChange={e => setPostUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aggiungi'}
            </Button>
          </div>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </CardContent>
      </Card>

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {posts.map(post => (
          <div key={post.id} className="break-inside-avoid">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {PLATFORM_ICONS[post.platform] ?? <LinkIcon className="w-4 h-4" />}
                    <span className="text-sm font-medium truncate">{post.author_name || post.platform}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{post.platform}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {post.embed_html ? (
                  <div className="[&>iframe]:w-full [&>iframe]:max-w-full" dangerouslySetInnerHTML={{ __html: post.embed_html }} />
                ) : post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt="" className="w-full rounded object-cover max-h-96" />
                ) : post.caption ? (
                  <p className="text-sm">{post.caption}</p>
                ) : null}
                {post.caption && (
                  <p className="text-xs text-text-muted line-clamp-2">{post.caption}</p>
                )}
                <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline block">
                  Vedi originale ↗
                </a>
              </CardContent>
            </Card>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="col-span-3 text-center py-12 text-text-muted">
            Nessun post ancora. Condividi su Instagram con l'hashtag dell'evento e aggiungi il link qui sopra!
          </div>
        )}
      </div>
    </main>
  );
}
