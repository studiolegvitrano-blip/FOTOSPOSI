'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  converted: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-gray-100 text-gray-800',
};

const CATEGORY_LABELS: Record<string, string> = {
  wedding_planner: 'Wedding Planner',
  photographer: 'Fotografo',
  location: 'Location',
  florist: 'Fioraio',
  other: 'Altro',
};

export default function AdminLeadsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
      setUser(u);
      loadLeads();
    });
  }, []);

  const loadLeads = async (status?: string) => {
    setLoading(true);
    const params = status && status !== 'all' ? `?status=${status}` : '';
    const res = await fetch(`/api/gte/leads${params}`);
    const json = await res.json();
    if (json.data) setLeads(json.data);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/gte/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    loadLeads(filter !== 'all' ? filter : undefined);
  };

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">B2B Leads</h1>
        <Button variant="outline" onClick={() => router.push('/admin')}>← Admin</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'new', 'contacted', 'qualified', 'converted', 'lost'].map(s => (
          <button key={s} onClick={() => { setFilter(s); loadLeads(s !== 'all' ? s : undefined); }}
            className={`px-3 py-1 rounded-full text-sm ${filter === s ? 'bg-brand text-white' : 'bg-muted hover:bg-muted/80'}`}>
            {s === 'all' ? 'Tutti' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-text-muted">Caricamento...</p>
      ) : leads.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-text-muted">Nessun lead trovato.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <Card key={lead.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={STATUS_COLORS[lead.contact_status] || ''}>{lead.contact_status}</Badge>
                      <Badge variant="outline">{CATEGORY_LABELS[lead.ai_category] || lead.ai_category}</Badge>
                      <span className="text-xs text-text-muted">{lead.source_platform}</span>
                    </div>
                    <p className="font-medium truncate">{lead.source_user_profile}</p>
                    {lead.ai_summary && <p className="text-sm text-text-muted mt-1 line-clamp-2">{lead.ai_summary}</p>}
                    {lead.raw_text && <p className="text-xs text-text-muted mt-1 line-clamp-1 opacity-70">{lead.raw_text}</p>}
                    <p className="text-xs text-text-muted mt-2">
                      {new Date(lead.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {lead.ai_confidence !== null && ` · Confidenza: ${(lead.ai_confidence * 100).toFixed(0)}%`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {lead.contact_status === 'new' && (
                      <Button size="sm" onClick={() => updateStatus(lead.id, 'contacted')}>Contattato</Button>
                    )}
                    {lead.contact_status === 'contacted' && (
                      <Button size="sm" onClick={() => updateStatus(lead.id, 'qualified')}>Qualificato</Button>
                    )}
                    {lead.contact_status === 'qualified' && (
                      <Button size="sm" onClick={() => updateStatus(lead.id, 'converted')}>Convertito</Button>
                    )}
                    {!['converted', 'lost'].includes(lead.contact_status) && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(lead.id, 'lost')}>Perso</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
