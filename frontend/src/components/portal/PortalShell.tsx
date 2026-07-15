'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { portalApi, clearToken } from '@/lib/portalApi';
import { LayoutDashboard, PlusCircle, FileText, Settings, LogOut, Car } from 'lucide-react';

interface UserData {
  id: number; name: string; email: string; role: string;
  must_change_password: boolean; company_name: string; company_id: number;
  discount_percent: number; allowed_payment_methods: string;
  portal_tracking_enabled: boolean;
}

export default function PortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const res = await portalApi.me();
      if (!res.ok) { clearToken(); router.push('/portal'); return; }
      const data = await res.json();
      setUser(data);
      if (data.must_change_password && pathname !== '/portal/settings') {
        router.push('/portal/settings');
      }
    } catch {
      clearToken(); router.push('/portal');
    }
    setLoading(false);
  }, [router, pathname]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const handleLogout = () => { clearToken(); router.push('/portal'); };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { path: '/portal/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/portal/book', icon: PlusCircle, label: 'Neue Buchung' },
    { path: '/portal/invoices', icon: FileText, label: 'Rechnungen' },
    { path: '/portal/settings', icon: Settings, label: 'Einstellungen' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-[#0c2d48] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Car size={24} className="text-amber-400" />
            <div>
              <p className="font-bold text-sm leading-tight">Firmenkundenportal</p>
              <p className="text-xs text-blue-200">{user.company_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user.discount_percent > 0 && (
              <span className="bg-amber-500/20 text-amber-300 text-xs font-medium px-2.5 py-1 rounded-full">
                {user.discount_percent}% Rabatt
              </span>
            )}
            <span className="text-sm text-blue-200 hidden sm:block">{user.name}</span>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Nav links */}
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {navItems.map(({ path, icon: Icon, label }) => (
            <button key={path} onClick={() => router.push(path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                pathname === path ? 'bg-white/20 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </header>

      {/* Force password change */}
      {user.must_change_password && pathname !== '/portal/settings' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center text-sm text-amber-800 font-medium">
          Bitte ändern Sie Ihr Passwort, bevor Sie fortfahren.
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
