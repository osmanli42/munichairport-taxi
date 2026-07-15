'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { portalApi } from '@/lib/portalApi';
import { Lock } from 'lucide-react';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: true,
  style: {
    base: {
      fontSize: '14px',
      color: '#1f2937',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#dc2626' },
  },
};

function CardForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(''); setLoading(true);
    try {
      const intentRes = await portalApi.createCardSetupIntent();
      const intentData = await intentRes.json();
      if (!intentRes.ok) { setError(intentData.error || 'Fehler'); setLoading(false); return; }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) { setError('Kartenformular nicht bereit'); setLoading(false); return; }

      const result = await stripe.confirmCardSetup(intentData.client_secret, {
        payment_method: { card: cardElement },
      });
      if (result.error) { setError(result.error.message || 'Karte konnte nicht gespeichert werden'); setLoading(false); return; }

      const pmId = result.setupIntent?.payment_method;
      if (!pmId || typeof pmId !== 'string') { setError('Unerwartete Antwort von Stripe'); setLoading(false); return; }

      const confirmRes = await portalApi.confirmCardSetup(pmId);
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) { setError(confirmData.error || 'Fehler beim Speichern'); setLoading(false); return; }

      onSaved();
    } catch {
      setError('Verbindungsfehler');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
      <div className="border border-gray-300 rounded-xl px-4 py-3">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Lock size={11} /> Ihre Kartendaten werden direkt und verschlüsselt an Stripe übertragen — sie erreichen nie unseren Server.
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={!stripe || loading}
          className="bg-[#0c2d48] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#0a2540] transition-colors disabled:opacity-50">
          {loading ? 'Speichern...' : 'Karte speichern'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-gray-500 text-sm">Abbrechen</button>
      </div>
    </form>
  );
}

export default function PortalCardSetup({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  if (!stripePromise) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
        Kartenzahlung ist noch nicht konfiguriert (fehlender Stripe-Schlüssel). Bitte Administrator kontaktieren.
      </div>
    );
  }
  return (
    <Elements stripe={stripePromise}>
      <CardForm onSaved={onSaved} onCancel={onCancel} />
    </Elements>
  );
}
