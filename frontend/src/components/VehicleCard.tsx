import Link from 'next/link';
import { Check } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface VehicleCardProps {
  type: 'kombi' | 'van' | 'grossraumtaxi';
  name: string;
  persons: string;
  description: string;
  features: string[];
  basePrice: number;
  pricePerKm: number;
  bookLabel: string;
  basePriceLabel: string;
  perKmLabel: string;
  featured?: boolean;
}

const vehicleImage: Record<string, string> = {
  kombi: '/images/kombi.PNG',
  van: '/images/van.PNG',
  grossraumtaxi: '/images/van.PNG',
};

export default function VehicleCard({
  type,
  name,
  persons,
  description,
  features,
  basePrice,
  pricePerKm,
  bookLabel,
  basePriceLabel,
  perKmLabel,
  featured = false,
}: VehicleCardProps) {
  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
      featured ? 'ring-2 ring-gold-400' : 'ring-1 ring-gray-200'
    } bg-white`}>
      {featured && (
        <div className="absolute top-0 right-0 bg-gold-400 text-primary-600 text-xs font-bold px-3 py-1 rounded-bl-xl">
          Beliebt
        </div>
      )}

      {/* Header */}
      <div className="bg-primary-600 p-6 text-center">
        <div className="w-full h-40 overflow-hidden rounded-lg mb-2">
          <img src={vehicleImage[type]} alt={name} className="w-full h-full object-cover" />
        </div>
        <h3 className="text-2xl font-bold text-white">{name}</h3>
        <p className="text-gold-400 font-medium mt-1">{persons}</p>
      </div>

      {/* Content */}
      <div className="p-6">
        <p className="text-gray-600 text-sm mb-4">{description}</p>

        <ul className="space-y-2 mb-6">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <Check size={16} className="text-green-500 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        <Link
          href="/#booking"
          className="block w-full bg-primary-600 hover:bg-primary-700 text-white text-center py-3 rounded-xl font-semibold transition-colors"
        >
          {bookLabel}
        </Link>
      </div>
    </div>
  );
}
