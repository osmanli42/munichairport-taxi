import {
  Car, Plane, Users, Route, MapPin, Clock, ShieldCheck, Star,
  Headphones, Gem,
} from 'lucide-react';

/** FAQ sayfasinin yeni tasarimina ait metinler ve ikonlar. Sorular/cevaplar
 *  faqData.ts icinde kaliyor; burada yalnizca tasarimla gelen cerceve metinleri var. */

export const categoryIcons = [Car, Plane, Car, Users, Route, MapPin] as const;

export const trustIcons = [ShieldCheck, Gem, Users, Plane] as const;

type FaqDesign = {
  eyebrow: string;
  stats: { icon: typeof Clock; value: string; label: string }[];
  contactExtra: { icon: typeof Headphones; text: string }[];
  trust: { title: string; text: string }[];
  signature: string;
};

export const faqDesign: Record<string, FaqDesign> = {
  de: {
    eyebrow: 'Support & Information',
    stats: [
      { icon: Clock, value: '24/7', label: 'Erreichbar' },
      { icon: Plane, value: '60 Min', label: 'Wartezeit Flughafen' },
      { icon: ShieldCheck, value: '3 Std', label: 'Kostenlos stornieren' },
      { icon: Star, value: '100%', label: 'Festpreise' },
    ],
    contactExtra: [
      { icon: Headphones, text: 'Persönliche Beratung' },
      { icon: Clock, text: 'Schnelle Antwort' },
      { icon: ShieldCheck, text: 'Kompetent & zuverlässig' },
    ],
    trust: [
      { title: 'Sicher & zuverlässig', text: 'Ihre Fahrt in besten Händen' },
      { title: 'Erstklassiger Service', text: 'Pünktlich. Diskret. Professionell.' },
      { title: 'Firmenkunden willkommen', text: 'Maßgeschneiderte Lösungen' },
      { title: 'In ganz Bayern & Österreich', text: 'Zuverlässig ans Ziel' },
    ],
    signature: 'Mehr als ein Taxi.',
  },
  en: {
    eyebrow: 'Support & Information',
    stats: [
      { icon: Clock, value: '24/7', label: 'Available' },
      { icon: Plane, value: '60 min', label: 'Airport wait time' },
      { icon: ShieldCheck, value: '3 hrs', label: 'Free cancellation' },
      { icon: Star, value: '100%', label: 'Fixed prices' },
    ],
    contactExtra: [
      { icon: Headphones, text: 'Personal advice' },
      { icon: Clock, text: 'Fast response' },
      { icon: ShieldCheck, text: 'Competent & reliable' },
    ],
    trust: [
      { title: 'Safe & reliable', text: 'Your ride in the best hands' },
      { title: 'First-class service', text: 'Punctual. Discreet. Professional.' },
      { title: 'Corporate clients welcome', text: 'Tailored solutions' },
      { title: 'Across Bavaria & Austria', text: 'Reliably to your destination' },
    ],
    signature: 'More than a taxi.',
  },
  tr: {
    eyebrow: 'Destek & Bilgi',
    stats: [
      { icon: Clock, value: '7/24', label: 'Ulaşılabilir' },
      { icon: Plane, value: '60 dk', label: 'Havalimanı bekleme' },
      { icon: ShieldCheck, value: '3 saat', label: 'Ücretsiz iptal' },
      { icon: Star, value: '%100', label: 'Sabit fiyat' },
    ],
    contactExtra: [
      { icon: Headphones, text: 'Kişisel danışmanlık' },
      { icon: Clock, text: 'Hızlı yanıt' },
      { icon: ShieldCheck, text: 'Yetkin & güvenilir' },
    ],
    trust: [
      { title: 'Güvenli & güvenilir', text: 'Yolculuğunuz emin ellerde' },
      { title: 'Birinci sınıf hizmet', text: 'Dakik. Gizlilik. Profesyonel.' },
      { title: 'Kurumsal müşteriler hoş geldiniz', text: 'Size özel çözümler' },
      { title: 'Tüm Bavyera ve Avusturya\'da', text: 'Güvenle hedefinize' },
    ],
    signature: 'Bir taksiden fazlası.',
  },
};
