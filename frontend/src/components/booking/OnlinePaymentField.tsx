'use client';

import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { loadStripe, type StripeElementLocale } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export interface OnlinePaymentResult {
  paymentIntentId: string;
}
export type OnlinePaymentOutcome =
  | ({ success: true } & OnlinePaymentResult)
  | { success: false; error: string };

export interface OnlinePaymentFieldHandle {
  confirmPayment(): Promise<OnlinePaymentOutcome>;
}

interface Props {
  price: number;
  name?: string;
  email?: string;
  locale: string;
  notConfiguredText?: string;
}

interface InnerProps extends Props {
  paymentIntentId: string;
}

const OnlinePaymentFieldInner = forwardRef<OnlinePaymentFieldHandle, InnerProps>(
  function OnlinePaymentFieldInner({ name, email, paymentIntentId }, ref) {
    const stripe = useStripe();
    const elements = useElements();
    const [ready, setReady] = useState(false);

    useImperativeHandle(ref, () => ({
      async confirmPayment(): Promise<OnlinePaymentOutcome> {
        if (!stripe || !elements) {
          return { success: false, error: 'Zahlungsformular nicht bereit' };
        }
        const { error } = await stripe.confirmPayment({
          elements,
          redirect: 'if_required',
          confirmParams: {
            payment_method_data: {
              billing_details: {
                name: name || undefined,
                email: email || undefined,
              },
            },
          },
        });
        if (error) {
          return { success: false, error: error.message || 'Zahlung fehlgeschlagen' };
        }
        return { success: true, paymentIntentId: paymentIntentId };
      },
    }));

    return (
      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: 'accordion' }}
      />
    );
  }
);

// Outer component: fetches PaymentIntent client_secret, mounts Elements
const OnlinePaymentField = forwardRef<OnlinePaymentFieldHandle, Props>(
  function OnlinePaymentField(props, ref) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [error, setError] = useState('');
    const prevPriceRef = useRef<number | null>(null);
    const intentIdRef = useRef<string | null>(null);

    useEffect(() => {
      if (!stripePromise) return;
      if (props.price <= 0) return;

      if (intentIdRef.current === null) {
        // First mount — create intent
        fetch(`${API_URL}/bookings/payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_eur: props.price, name: props.name, email: props.email }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.client_secret) {
              setClientSecret(data.client_secret);
              intentIdRef.current = data.payment_intent_id;
              prevPriceRef.current = props.price;
            } else {
              setError(data.error || 'Fehler');
            }
          })
          .catch(() => setError('Verbindungsfehler'));
      } else if (prevPriceRef.current !== props.price && intentIdRef.current) {
        // Price changed — update amount (don't remount Elements)
        prevPriceRef.current = props.price;
        fetch(`${API_URL}/bookings/payment-intent/${intentIdRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_eur: props.price }),
        }).catch(() => {});
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.price]);

    if (!stripePromise) {
      return (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
          {props.notConfiguredText || 'Online-Zahlung ist noch nicht konfiguriert.'}
        </div>
      );
    }
    if (error) {
      return <p className="text-red-500 text-xs">{error}</p>;
    }
    if (!clientSecret) {
      return <p className="text-gray-400 text-xs animate-pulse">Zahlungsformular wird geladen…</p>;
    }

    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          locale: props.locale as StripeElementLocale,
          appearance: { theme: 'stripe', variables: { borderRadius: '12px', colorPrimary: '#1e3a5f' } },
        }}
      >
        <OnlinePaymentFieldInner ref={ref} {...props} paymentIntentId={intentIdRef.current!} />
      </Elements>
    );
  }
);

export default OnlinePaymentField;
