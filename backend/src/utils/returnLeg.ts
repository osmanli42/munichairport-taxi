// Rückfahrt einer Hin- & Rückfahrt-Buchung. Ohne eigene Adressen (Altbuchungen,
// normale Hin & Rück) ist sie die umgekehrte Hinfahrt.

export interface ReturnLegSource {
  pickup_address?: string | null;
  dropoff_address?: string | null;
  return_pickup_address?: string | null;
  return_dropoff_address?: string | null;
  return_flight_number?: string | null;
}

export function hasCustomReturn(b: ReturnLegSource): boolean {
  return !!(b.return_pickup_address || b.return_dropoff_address);
}

export function returnLeg(b: ReturnLegSource): { from: string; to: string; flight: string | null } {
  return {
    from: b.return_pickup_address || b.dropoff_address || '',
    to: b.return_dropoff_address || b.pickup_address || '',
    flight: b.return_flight_number || null,
  };
}
