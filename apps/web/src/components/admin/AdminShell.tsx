import { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

/**
 * Wrapper RSC condiviso per tutte le pagine /admin/*.
 * Fornisce layout sidebar + main con larghezza consistente.
 * La sidebar è Client Component (usa usePathname per highlight attivo).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col md:flex-row gap-4">
      <AdminSidebar />
      <main className="flex-1 min-w-0 space-y-6">
        {children}
      </main>
    </div>
  );
}
