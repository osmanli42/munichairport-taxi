// Fiyat gösterimi frontend'de her zaman 0,50 €'ya yukarı yuvarlanıyor (formatPrice,
// frontend/src/lib/utils.ts). Bu fonksiyon aynı kuralı backend'de son adım olarak
// uygular, böylece müşteriye gösterilen tutar ile kaydedilen/tahsil edilen tutar
// her zaman birebir eşleşir. Ara hesaplamalar (indirimler, taban kontrolleri) kuruş
// hassasiyetinde kalır — yuvarlama sadece nihai fiyata, en son adımda uygulanır.
export function roundPriceUp(price: number): number {
  return Math.ceil(price * 2) / 2;
}
