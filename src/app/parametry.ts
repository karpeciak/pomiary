import { NowyPomiar, Pomiar } from './services/api.service';

/** Sposób wprowadzania wartości - decyduje o wyglądzie pola w formularzu. */
export type TypPola = 'czas' | 'rpe' | 'liczba' | 'sen' | 'buzki' | 'tapping';

export interface Parametr {
  /** pole w żądaniu POST /api/pomiary */
  klucz: Exclude<keyof NowyPomiar, 'uzytkownikId'>;
  /** kolumna w tabeli Pomiary */
  kolumna: keyof Pomiar;
  nazwa: string;
  skrot: string;
  jednostka: string;
  min: number;
  max: number;
  /** najmniejsza zmiana wartości (sen: 0,25 h) */
  krok: number;
  typ: TypPola;
  kolor: string;
  opis?: string;
}

/** Wskaźnik liczony przez bazę (sRPE = czas × RPE). */
export interface Wyliczany {
  kolumna: keyof Pomiar;
  nazwa: string;
  skrot: string;
  jednostka: string;
  kolor: string;
  /** z czego powstaje - do podpowiedzi w interfejsie */
  zParametrow: [Parametr['klucz'], Parametr['klucz']];
}

/** Parametry wpisywane przez użytkownika. */
export const PARAMETRY: Parametr[] = [
  {
    klucz: 'czasTreningu', kolumna: 'CzasTreningu', nazwa: 'Czas treningu', skrot: 'Czas tren.',
    jednostka: 'min', min: 0, max: 1440, krok: 1, typ: 'czas', kolor: '#3b82f6',
    opis: 'Łączny czas dzisiejszego treningu',
  },
  {
    klucz: 'rpeTreningu', kolumna: 'RpeTreningu', nazwa: 'RPE treningu', skrot: 'RPE tren.',
    jednostka: 'pkt', min: 0, max: 10, krok: 1, typ: 'rpe', kolor: '#2563eb',
    opis: 'Jak ciężki był trening (skala Borga CR-10)',
  },
  {
    klucz: 'czasPracy', kolumna: 'CzasPracy', nazwa: 'Czas pracy', skrot: 'Czas pracy',
    jednostka: 'min', min: 0, max: 1440, krok: 1, typ: 'czas', kolor: '#f59e0b',
    opis: 'Wysiłek poza treningiem: praca, służba, inne zajęcia',
  },
  {
    klucz: 'rpePracy', kolumna: 'RpePracy', nazwa: 'RPE pracy', skrot: 'RPE pracy',
    jednostka: 'pkt', min: 0, max: 10, krok: 1, typ: 'rpe', kolor: '#d97706',
    opis: 'Jak ciężki był wysiłek w pracy (skala Borga CR-10)',
  },
  {
    klucz: 'tetnoPoranne', kolumna: 'TetnoPoranne', nazwa: 'Tętno po przebudzeniu', skrot: 'HR rano',
    jednostka: 'ud./min', min: 20, max: 120, krok: 1, typ: 'liczba', kolor: '#ef4444',
    opis: 'Pomiar rano, jeszcze przed wstaniem z łóżka',
  },
  {
    klucz: 'sen', kolumna: 'Sen', nazwa: 'Ilość snu', skrot: 'Sen',
    jednostka: 'h', min: 0, max: 12, krok: 0.25, typ: 'sen', kolor: '#8b5cf6',
    opis: 'Długość snu ostatniej nocy',
  },
  {
    klucz: 'checDoTreningu', kolumna: 'ChecDoTreningu', nazwa: 'Chęć do treningu', skrot: 'Chęć',
    jednostka: 'pkt', min: 1, max: 5, krok: 1, typ: 'buzki', kolor: '#10b981',
    opis: 'Jak bardzo chce Ci się dziś trenować',
  },
  {
    klucz: 'tapping', kolumna: 'Tapping', nazwa: 'Tapping test', skrot: 'Tapping',
    jednostka: 'stuknięć', min: 0, max: 500, krok: 1, typ: 'tapping', kolor: '#ec4899',
    opis: 'Liczba stuknięć w 10 sekund',
  },
];

/** Wskaźniki liczone automatycznie przy zapisie (metoda sRPE). */
export const WYLICZANE: Wyliczany[] = [
  {
    kolumna: 'ObciazenieTreningowe', nazwa: 'Obciążenie treningowe', skrot: 'Obc. tren.',
    jednostka: 'AU', kolor: '#1d4ed8', zParametrow: ['czasTreningu', 'rpeTreningu'],
  },
  {
    kolumna: 'ObciazeniePraca', nazwa: 'Obciążenie pracą', skrot: 'Obc. praca',
    jednostka: 'AU', kolor: '#b45309', zParametrow: ['czasPracy', 'rpePracy'],
  },
];

/** Czas trwania tapping testu (sekundy). */
export const TAPPING_SEKUND = 10;

/** Opisy poziomów skali Borga CR-10 (indeks = wartość RPE). */
export const RPE_OPISY = [
  'brak wysiłku',
  'bardzo, bardzo lekki',
  'bardzo lekki',
  'lekki',
  'umiarkowany',
  'dość ciężki',
  'ciężki',
  'bardzo ciężki',
  'bardzo, bardzo ciężki',
  'skrajnie ciężki',
  'maksymalny',
];

/** Skala chęci do treningu: 5 buziek. */
export const BUZKI = [
  { wartosc: 1, emoji: '😖', opis: 'bardzo niechętnie' },
  { wartosc: 2, emoji: '🙁', opis: 'niechętnie' },
  { wartosc: 3, emoji: '😐', opis: 'obojętnie' },
  { wartosc: 4, emoji: '🙂', opis: 'chętnie' },
  { wartosc: 5, emoji: '😄', opis: 'bardzo chętnie' },
];

/** Minuty jako "2 h 30 min". */
export function minutyNaTekst(minuty: number | null): string {
  if (minuty === null) return '–';
  const h = Math.floor(minuty / 60);
  const m = minuty % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
