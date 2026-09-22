import { NowyPomiar, Pomiar } from './services/api.service';

export interface Parametr {
  /** pole w żądaniu POST /api/pomiary */
  klucz: Exclude<keyof NowyPomiar, 'uzytkownikId'>;
  /** kolumna w tabeli Pomiary */
  kolumna: Exclude<keyof Pomiar, 'Id' | 'UzytkownikId' | 'Data'>;
  nazwa: string;
  skrot: string;
  jednostka: string;
  min: number;
  max: number;
  kolor: string;
}

/** Mierzone parametry wraz z zakresami walidacji (te same zakresy sprawdza API). */
export const PARAMETRY: Parametr[] = [
  { klucz: 'tetnoSpoczynek', kolumna: 'TetnoSpoczynek', nazwa: 'Tętno spoczynkowe', skrot: 'HR spocz.', jednostka: 'bpm', min: 30, max: 220, kolor: '#3b82f6' },
  { klucz: 'tetnoWysilek', kolumna: 'TetnoWysilek', nazwa: 'Tętno po wysiłku', skrot: 'HR wysiłek', jednostka: 'bpm', min: 30, max: 220, kolor: '#ef4444' },
  { klucz: 'cisnienieSkurcz', kolumna: 'CisnienieSkurcz', nazwa: 'Ciśnienie skurczowe', skrot: 'SYS', jednostka: 'mmHg', min: 70, max: 250, kolor: '#8b5cf6' },
  { klucz: 'cisnienieRozkurcz', kolumna: 'CisnienieRozkurcz', nazwa: 'Ciśnienie rozkurczowe', skrot: 'DIA', jednostka: 'mmHg', min: 40, max: 150, kolor: '#ec4899' },
  { klucz: 'spo2', kolumna: 'SpO2', nazwa: 'Saturacja SpO₂', skrot: 'SpO₂', jednostka: '%', min: 70, max: 100, kolor: '#10b981' },
  { klucz: 'czasMin', kolumna: 'CzasMin', nazwa: 'Czas wysiłku', skrot: 'Czas', jednostka: 'min', min: 1, max: 600, kolor: '#f59e0b' },
  { klucz: 'rpe', kolumna: 'RPE', nazwa: 'Zmęczenie (skala Borga RPE)', skrot: 'RPE', jednostka: '6–20', min: 6, max: 20, kolor: '#64748b' },
];
