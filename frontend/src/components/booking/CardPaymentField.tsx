'use client';

import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { loadStripe, type StripeElementLocale } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Lock } from 'lucide-react';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: true,
  style: {
    base: { fontSize: '14px', color: '#1f2937', '::placeholder': { color: '#9ca3af' } },
    invalid: { color: '#dc2626' },
  },
};

export interface CardPaymentResult {
  customerId: string;
  paymentMethodId: string;
  brand: string;
  last4: string;
}

export type CardConfirmOutcome = ({ success: true } & CardPaymentResult) | { success: false; error: string };

export interface CardPaymentFieldHandle {
  confirmCard(): Promise<CardConfirmOutcome>;
}

interface Props {
  locale: string;
  name?: string;
  email?: string;
  errorText?: string;
  notConfiguredText?: string;
  trustText?: string;
}

const CardPaymentFieldInner = forwardRef<CardPaymentFieldHandle, Props>(function CardPaymentFieldInner(
  { name, email, errorText, trustText },
  ref
) {
  const stripe = useStripe();
  const elements = useElements();
  const clientSecretRef = useRef<string | null>(null);
  const customerIdRef = useRef<string | null>(null);
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/bookings/card-setup-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.client_secret) {
          clientSecretRef.current = data.client_secret;
          customerIdRef.current = data.stripe_customer_id;
        } else {
          setSetupError(data.error || 'Fehler');
        }
      })
      .catch(() => { if (!cancelled) setSetupError('Verbindungsfehler'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    async confirmCard(): Promise<CardConfirmOutcome> {
      if (!stripe || !elements) return { success: false, error: 'Kartenformular nicht bereit' };
      if (!clientSecretRef.current || !customerIdRef.current) {
        return { success: false, error: setupError || 'Kartenformular nicht bereit' };
      }
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) return { success: false, error: 'Kartenformular nicht bereit' };

      const result = await stripe.confirmCardSetup(clientSecretRef.current, {
        payment_method: { card: cardElement, billing_details: name ? { name } : undefined },
      });
      if (result.error) return { success: false, error: result.error.message || 'Karte konnte nicht bestätigt werden' };

      const pm = result.setupIntent?.payment_method;
      const paymentMethodId = typeof pm === 'string' ? pm : pm?.id;
      if (!paymentMethodId) return { success: false, error: 'Unerwartete Antwort von Stripe' };

      let brand = 'card';
      let last4 = '';
      try {
        const infoRes = await fetch(`${API_URL}/bookings/card-setup-confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_method_id: paymentMethodId }),
        });
        const info = await infoRes.json();
        if (infoRes.ok) { brand = info.brand; last4 = info.last4; }
      } catch { /* display-only lookup — a failure here doesn't block the booking */ }

      return { success: true, customerId: customerIdRef.current, paymentMethodId, brand, last4 };
    },
  }));

  return (
    <div className="space-y-3">
      <div className="border border-gray-300 rounded-xl px-4 py-3 bg-white">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>
      {errorText && <p className="text-red-500 text-xs">{errorText}</p>}
      {trustText && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Lock size={11} /> {trustText}
        </p>
      )}
    </div>
  );
});

const CardPaymentField = forwardRef<CardPaymentFieldHandle, Props>(function CardPaymentField(props, ref) {
  if (!stripePromise) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
        {props.notConfiguredText || 'Kartenzahlung ist noch nicht konfiguriert.'}
      </div>
    );
  }
  return (
    <Elements stripe={stripePromise} options={{ locale: props.locale as StripeElementLocale }}>
      <CardPaymentFieldInner ref={ref} {...props} />
    </Elements>
  );
});

export default CardPaymentField;
