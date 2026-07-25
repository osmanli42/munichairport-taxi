import Stripe from 'stripe';
import { query, run } from '../db';
import { roundGrossPrice } from './rechnung';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' as any })
  : null;

function requireStripe(): InstanceType<typeof Stripe> {
  if (!stripe) throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
  return stripe;
}

export interface CompanyRow {
  id: number;
  company_name: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  charge_mode: 'manual' | 'on_confirm' | 'on_completion';
}

export interface ChargeableCard {
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
}

export async function getOrCreateStripeCustomer(company: CompanyRow): Promise<string> {
  if (company.stripe_customer_id) return company.stripe_customer_id;
  const s = requireStripe();
  const customer = await s.customers.create({
    name: company.company_name,
    email: company.email || undefined,
    metadata: { company_id: String(company.id) },
  });
  await run('UPDATE companies SET stripe_customer_id = ? WHERE id = ?', [customer.id, company.id]);
  return customer.id;
}

export async function createSetupIntent(company: CompanyRow): Promise<{ client_secret: string }> {
  const s = requireStripe();
  const customerId = await getOrCreateStripeCustomer(company);
  const intent = await s.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });
  if (!intent.client_secret) throw new Error('Stripe did not return a client_secret');
  return { client_secret: intent.client_secret };
}

export async function attachPaymentMethod(company: CompanyRow, paymentMethodId: string) {
  const s = requireStripe();
  const customerId = await getOrCreateStripeCustomer(company);

  await s.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await s.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });

  const pm = await s.paymentMethods.retrieve(paymentMethodId);
  const card = pm.card;
  if (!card) throw new Error('Attached payment method has no card details');

  await run(
    `UPDATE companies SET stripe_payment_method_id = ?, card_brand = ?, card_last4 = ?, card_exp_month = ?, card_exp_year = ? WHERE id = ?`,
    [paymentMethodId, card.brand, card.last4, card.exp_month, card.exp_year, company.id]
  );

  return { brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year };
}

export async function detachPaymentMethod(company: CompanyRow) {
  const s = requireStripe();
  if (company.stripe_payment_method_id) {
    try { await s.paymentMethods.detach(company.stripe_payment_method_id); }
    catch { /* already detached / gone on Stripe's side — still clear our reference */ }
  }
  await run(
    `UPDATE companies SET stripe_payment_method_id = NULL, card_brand = NULL, card_last4 = NULL, card_exp_month = NULL, card_exp_year = NULL WHERE id = ?`,
    [company.id]
  );
}

export async function chargeSavedCard(bookingId: number, card: ChargeableCard, amountEur: number): Promise<{ success: boolean; error?: string }> {
  if (!card.stripe_customer_id || !card.stripe_payment_method_id) {
    const err = 'No saved card on file for this booking';
    await run('UPDATE bookings SET charge_status = ?, charge_error = ? WHERE id = ?', ['failed', err, bookingId]);
    return { success: false, error: err };
  }

  const s = requireStripe();
  await run('UPDATE bookings SET charge_status = ? WHERE id = ?', ['pending', bookingId]);

  // Round up to the nearest 0.50 — matches formatPrice()/roundGrossPrice() used
  // everywhere the price is DISPLAYED (admin lists, invoices). bookings.price stores
  // the raw calculated value, so charging it as-is silently undercharges by up to 0.49€
  // relative to what the admin actually sees on screen.
  const chargeAmount = roundGrossPrice(amountEur);

  try {
    const intent = await s.paymentIntents.create({
      customer: card.stripe_customer_id,
      payment_method: card.stripe_payment_method_id,
      amount: Math.round(chargeAmount * 100),
      currency: 'eur',
      off_session: true,
      confirm: true,
      metadata: { booking_id: String(bookingId) },
    });
    await run(
      'UPDATE bookings SET stripe_charge_id = ?, stripe_payment_date = NOW(), charge_status = ?, charge_error = NULL WHERE id = ?',
      [intent.id, 'succeeded', bookingId]
    );
    return { success: true };
  } catch (err: any) {
    const message = err?.message || 'Stripe charge failed';
    await run('UPDATE bookings SET charge_status = ?, charge_error = ? WHERE id = ?', ['failed', message, bookingId]);
    return { success: false, error: message };
  }
}

export async function getCompanyForCharge(companyId: number): Promise<CompanyRow | null> {
  const [company] = await query<CompanyRow>(
    'SELECT id, company_name, email, stripe_customer_id, stripe_payment_method_id, charge_mode FROM companies WHERE id = ?',
    [companyId]
  );
  return company || null;
}

export async function createAnonymousSetupIntent(opts: { name?: string; email?: string }): Promise<{ client_secret: string; stripe_customer_id: string }> {
  const s = requireStripe();
  const customer = await s.customers.create({
    name: opts.name || undefined,
    email: opts.email || undefined,
    metadata: { source: 'public_booking' },
  });
  const intent = await s.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
  });
  if (!intent.client_secret) throw new Error('Stripe did not return a client_secret');
  return { client_secret: intent.client_secret, stripe_customer_id: customer.id };
}

export async function createBookingPaymentIntent(opts: {
  amountEur: number;
  name?: string;
  email?: string;
}): Promise<{ client_secret: string; payment_intent_id: string }> {
  const s = requireStripe();
  const amountCents = Math.round(roundGrossPrice(opts.amountEur) * 100);
  const intent = await s.paymentIntents.create({
    amount: amountCents,
    currency: 'eur',
    automatic_payment_methods: { enabled: true },
    metadata: { source: 'public_booking' },
    ...(opts.email || opts.name ? {
      receipt_email: opts.email || undefined,
    } : {}),
  });
  if (!intent.client_secret) throw new Error('Stripe did not return a client_secret');
  return { client_secret: intent.client_secret, payment_intent_id: intent.id };
}

export async function updateBookingPaymentIntentAmount(paymentIntentId: string, amountEur: number): Promise<void> {
  const s = requireStripe();
  const amountCents = Math.round(roundGrossPrice(amountEur) * 100);
  await s.paymentIntents.update(paymentIntentId, { amount: amountCents });
}

export async function verifyBookingPaymentIntent(paymentIntentId: string): Promise<{ succeeded: boolean; amountEur: number }> {
  const s = requireStripe();
  const intent = await s.paymentIntents.retrieve(paymentIntentId);
  return {
    succeeded: intent.status === 'succeeded',
    amountEur: intent.amount / 100,
  };
}

export async function getPaymentMethodCardInfo(paymentMethodId: string): Promise<{ brand: string; last4: string; exp_month: number; exp_year: number }> {
  const s = requireStripe();
  const pm = await s.paymentMethods.retrieve(paymentMethodId);
  const card = pm.card;
  if (!card) throw new Error('Payment method has no card details');
  return { brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year };
}
