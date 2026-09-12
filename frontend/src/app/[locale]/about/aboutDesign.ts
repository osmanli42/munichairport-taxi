import { Headphones, MessageCircle, ShieldCheck } from 'lucide-react';

/** Über uns sayfasinin yeni tasarimina ait metinler. Diger tum icerik (baslik,
 *  reasons, stats, contact detay etiketleri) messages/*.json icindeki `about`
 *  alanindan geliyor; burada yalnizca tasarimla gelen yeni metinler var. */

export const contactExtraIcons = [Headphones, MessageCircle, ShieldCheck] as const;

type AboutDesign = {
  quote: string;
  ctaTitle: string;
  ctaText: string;
  contactExtra: string[];
  areaMore: string;
};

export const aboutDesign: Record<string, AboutDesign> = {
  de: {
    quote: 'Unser Ziel ist es, jede Fahrt zu einem angenehmen Erlebnis zu machen – sicher, pünktlich und komfortabel.',
    ctaTitle: 'Direkt für Sie da',
    ctaText: 'Wir sind 24 Stunden am Tag, 7 Tage die Woche für Sie erreichbar. Kontaktieren Sie uns gerne per Telefon, E-Mail oder WhatsApp – wir freuen uns auf Ihre Anfrage.',
    contactExtra: ['Persönliche Beratung', 'Schnelle Antwort', 'Kompetent & zuverlässig'],
    areaMore: 'und viele weitere …',
  },
  en: {
    quote: 'Our goal is to make every ride a pleasant experience – safe, punctual and comfortable.',
    ctaTitle: 'Here for you directly',
    ctaText: 'We are available for you 24 hours a day, 7 days a week. Feel free to contact us by phone, email or WhatsApp – we look forward to your enquiry.',
    contactExtra: ['Personal advice', 'Fast response', 'Competent & reliable'],
    areaMore: 'and many more …',
  },
  tr: {
    quote: 'Amacımız her yolculuğu güvenli, dakik ve konforlu, keyifli bir deneyime dönüştürmek.',
    ctaTitle: 'Sizin için hazırız',
    ctaText: 'Günün 24 saati, haftanın 7 günü size ulaşılabilir durumdayız. Telefon, e-posta veya WhatsApp üzerinden bizimle iletişime geçebilirsiniz – talebinizi bekliyoruz.',
    contactExtra: ['Kişisel danışmanlık', 'Hızlı yanıt', 'Yetkin & güvenilir'],
    areaMore: 've daha fazlası …',
  },
};
