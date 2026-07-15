'use client';

import { useState, useEffect, useCallback } from 'react';
import PortalShell from '@/components/portal/PortalShell';
import { portalApi } from '@/lib/portalApi';
import { KeyRound, Users, Trash2, Plus, CheckCircle, Building2, CreditCard } from 'lucide-react';
import PortalCardSetup from '@/components/portal/PortalCardSetup';

export default function SettingsPage() {
  const [me, setMe] = useState<any>(null);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [profile, setProfile] = useState({ company_name: '', contact_name: '', phone: '', address: '', ust_idnr: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'member' });
  const [userError, setUserError] = useState('');

  const [showCardSetup, setShowCardSetup] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardRemoving, setCardRemoving] = useState(false);

  const loadMe = useCallback(async () => {
    const res = await portalApi.me();
    if (res.ok) {
      const data = await res.json();
      setMe(data);
      setProfile({
        company_name: data.company_name || '',
        contact_name: data.contact_name || '',
        phone: data.company_phone || '',
        address: data.address || '',
        ust_idnr: data.ust_idnr || '',
      });
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await portalApi.users();
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => { if (me?.role === 'admin') loadUsers(); }, [me, loadUsers]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError('Passwörter stimmen nicht überein'); return; }
    if (newPw.length < 8) { setPwError('Passwort muss mindestens 8 Zeichen lang sein'); return; }
    setPwLoading(true);
    try {
      const res = await portalApi.changePassword(currentPw, newPw);
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || 'Fehler'); setPwLoading(false); return; }
      setPwSuccess(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      loadMe();
    } catch { setPwError('Verbindungsfehler'); }
    setPwLoading(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    const res = await portalApi.addUser(newUser);
    const data = await res.json();
    if (!res.ok) { setUserError(data.error || 'Fehler'); return; }
    setShowAddUser(false);
    setNewUser({ name: '', email: '', role: 'member' });
    loadUsers();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(''); setProfileSuccess(false); setProfileLoading(true);
    try {
      const res = await portalApi.updateProfile(profile);
      const data = await res.json();
      if (!res.ok) { setProfileError(data.error || 'Fehler'); setProfileLoading(false); return; }
      setProfileSuccess(true);
      loadMe();
    } catch { setProfileError('Verbindungsfehler'); }
    setProfileLoading(false);
  };

  const handleRemoveCard = async () => {
    if (!confirm('Hinterlegte Kreditkarte wirklich entfernen?')) return;
    setCardError(''); setCardRemoving(true);
    try {
      const res = await portalApi.removeCard();
      if (!res.ok) { const d = await res.json(); setCardError(d.error || 'Fehler'); setCardRemoving(false); return; }
      loadMe();
    } catch { setCardError('Verbindungsfehler'); }
    setCardRemoving(false);
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Benutzer wirklich löschen?')) return;
    const res = await portalApi.deleteUser(id);
    if (res.ok) loadUsers();
    else { const d = await res.json(); alert(d.error || 'Fehler'); }
  };

  return (
    <PortalShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Einstellungen</h1>

        {me?.must_change_password && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
            Bitte legen Sie ein neues Passwort fest, um fortzufahren.
          </div>
        )}

        {/* Company profile */}
        {me?.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900">Firmenprofil</h2>
            </div>

            {profileError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{profileError}</div>}
            {profileSuccess && (
              <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                <CheckCircle size={16} /> Firmenprofil gespeichert
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Firmenname *</label>
                  <input type="text" required value={profile.company_name} onChange={e => setProfile({ ...profile, company_name: e.target.value })}
                    className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Ansprechpartner *</label>
                  <input type="text" required value={profile.contact_name} onChange={e => setProfile({ ...profile, contact_name: e.target.value })}
                    className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Telefon *</label>
                  <input type="tel" required value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">USt-IdNr.</label>
                  <input type="text" value={profile.ust_idnr} onChange={e => setProfile({ ...profile, ust_idnr: e.target.value })}
                    className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="DE123456789" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Rechnungsadresse *</label>
                <textarea required value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} rows={2}
                  className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  placeholder="Straße, PLZ Ort" />
                <p className="text-xs text-gray-400 mt-1">Erscheint als Rechnungsempfänger auf allen Rechnungen und Sammelrechnungen.</p>
              </div>
              <button type="submit" disabled={profileLoading}
                className="bg-[#0c2d48] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#0a2540] transition-colors disabled:opacity-50">
                {profileLoading ? 'Speichern...' : 'Firmenprofil speichern'}
              </button>
            </form>
          </div>
        )}

        {/* Payment method (Stripe card on file) */}
        {me?.role === 'admin' && (me?.allowed_payment_methods || '').split(',').includes('card') && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900">Zahlungsmethode</h2>
            </div>

            {cardError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{cardError}</div>}

            {me?.has_saved_card ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 bg-white border border-gray-200 rounded flex items-center justify-center text-xs font-bold text-gray-500 uppercase">
                      {me.card_brand}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">•••• •••• •••• {me.card_last4}</p>
                      <p className="text-xs text-gray-500">Gültig bis {String(me.card_exp_month).padStart(2, '0')}/{me.card_exp_year}</p>
                    </div>
                  </div>
                  <button onClick={handleRemoveCard} disabled={cardRemoving}
                    className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                    Entfernen
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Abrechnung: {
                    me.charge_mode === 'on_confirm' ? 'Automatisch bei Buchungsbestätigung'
                    : me.charge_mode === 'on_completion' ? 'Automatisch nach Fahrtende'
                    : 'Manuell durch unser Team'
                  } — wird von Flughafen München Taxi festgelegt.
                </p>
              </div>
            ) : showCardSetup ? (
              <PortalCardSetup
                onSaved={() => { setShowCardSetup(false); loadMe(); }}
                onCancel={() => setShowCardSetup(false)}
              />
            ) : (
              <button onClick={() => setShowCardSetup(true)}
                className="bg-[#0c2d48] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#0a2540] transition-colors">
                Kreditkarte hinzufügen
              </button>
            )}
          </div>
        )}

        {/* Password change */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={18} className="text-primary-500" />
            <h2 className="font-semibold text-gray-900">Passwort ändern</h2>
          </div>

          {pwError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{pwError}</div>}
          {pwSuccess && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
              <CheckCircle size={16} /> Passwort erfolgreich geändert
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Aktuelles Passwort</label>
              <input type="password" required value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Neues Passwort</label>
              <input type="password" required value={newPw} onChange={e => setNewPw(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Neues Passwort bestätigen</label>
              <input type="password" required value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <button type="submit" disabled={pwLoading}
              className="bg-[#0c2d48] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#0a2540] transition-colors disabled:opacity-50">
              {pwLoading ? 'Speichern...' : 'Passwort speichern'}
            </button>
          </form>
        </div>

        {/* User management */}
        {me?.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-primary-500" />
                <h2 className="font-semibold text-gray-900">Mitarbeiter verwalten</h2>
              </div>
              <button onClick={() => setShowAddUser(s => !s)}
                className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                <Plus size={14} /> Hinzufügen
              </button>
            </div>

            {userError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{userError}</div>}

            {showAddUser && (
              <form onSubmit={handleAddUser} className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" required placeholder="Name" value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <input type="email" required placeholder="E-Mail" value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full">
                  <option value="member">Mitarbeiter</option>
                  <option value="admin">Administrator</option>
                </select>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">Erstellen</button>
                  <button type="button" onClick={() => setShowAddUser(false)} className="px-4 py-2 text-gray-500 text-sm">Abbrechen</button>
                </div>
              </form>
            )}

            <div className="divide-y divide-gray-50">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email} · {u.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}</p>
                  </div>
                  <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {users.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Keine weiteren Mitarbeiter</p>}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
