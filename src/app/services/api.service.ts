import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../config';

export type Rola = 'user' | 'admin';

export interface Uzytkownik {
  Id: number;
  Pseudonim: string;
  KomorkaId: number | null;
  Rola: Rola;
  KomorkaNazwa?: string | null;
}

export interface OsobaWKomorce extends Uzytkownik {
  LiczbaPomiarow: number;
  OstatniPomiar: string | null;
}

export interface Komorka {
  Id: number;
  Nazwa: string;
  LiczbaOsob: number;
}

export interface Pomiar {
  Id: number;
  UzytkownikId: number;
  Data: string;
  /** minuty */
  CzasTreningu: number | null;
  /** skala Borga CR-10 */
  RpeTreningu: number | null;
  /** minuty */
  CzasPracy: number | null;
  RpePracy: number | null;
  /** ud./min, pomiar po przebudzeniu */
  TetnoPoranne: number | null;
  /** godziny, krok 0,25 */
  Sen: number | null;
  /** 1-5 (buźki) */
  ChecDoTreningu: number | null;
  /** liczba stuknięć w 10 s */
  Tapping: number | null;
  /** sRPE: CzasTreningu × RpeTreningu, liczone przez bazę */
  ObciazenieTreningowe: number | null;
  /** sRPE: CzasPracy × RpePracy, liczone przez bazę */
  ObciazeniePraca: number | null;
}

export interface NowyPomiar {
  uzytkownikId: number;
  czasTreningu: number | null;
  rpeTreningu: number | null;
  czasPracy: number | null;
  rpePracy: number | null;
  tetnoPoranne: number | null;
  sen: number | null;
  checDoTreningu: number | null;
  tapping: number | null;
}

/** Ostatnio używany pseudonim i komórka - do podpowiedzi na ekranie logowania. */
export interface OstatniLogin {
  pseudonim: string;
  komorkaId: number | null;
}

const STORAGE_KEY = 'pw_user';
const OSTATNI_KEY = 'pw_ostatni';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // w przeglądarce: ten sam host co strona; w aplikacji iOS: publiczny adres z config.ts
  private readonly url = API_URL;

  /**
   * Zalogowany użytkownik - zawsze zapamiętany na urządzeniu (localStorage),
   * więc po zamknięciu przeglądarki / telefonu nie trzeba logować się ponownie.
   * Ekran logowania pojawi się dopiero po kliknięciu "Wyloguj".
   */
  readonly user = signal<Uzytkownik | null>(this.wczytajUzytkownika());

  constructor() {
    this.odswiezZapamietanego();
  }

  getKomorki(): Observable<Komorka[]> {
    return this.http.get<Komorka[]>(`${this.url}/komorki`);
  }

  login(pseudonim: string, komorkaId: number | null): Observable<Uzytkownik> {
    return this.http.post<Uzytkownik>(`${this.url}/login`, { pseudonim, komorkaId }).pipe(
      tap((u) => {
        this.ustawUzytkownika(u);
        this.zapisz(localStorage, OSTATNI_KEY, { pseudonim: u.Pseudonim, komorkaId: u.KomorkaId ?? komorkaId });
      }),
    );
  }

  logout(): void {
    this.ustawUzytkownika(null);
  }

  /** Pseudonim i komórka z ostatniego logowania na tym urządzeniu (zostają po wylogowaniu). */
  ostatniLogin(): OstatniLogin | null {
    return this.odczytaj<OstatniLogin>(localStorage, OSTATNI_KEY);
  }

  getUzytkownik(id: number): Observable<Uzytkownik> {
    return this.http.get<Uzytkownik>(`${this.url}/uzytkownicy/${id}`);
  }

  getPomiary(userId: number): Observable<Pomiar[]> {
    return this.http.get<Pomiar[]>(`${this.url}/pomiary/${userId}`);
  }

  /** Zapis dzisiejszego pomiaru - jeśli dziś już jest pomiar, API go nadpisuje. */
  zapiszPomiar(p: NowyPomiar): Observable<Pomiar & { Nadpisany: boolean }> {
    return this.http.post<Pomiar & { Nadpisany: boolean }>(`${this.url}/pomiary`, p);
  }

  /** Usuwa pomiar (własny, a admin - dowolny). */
  usunPomiar(pomiarId: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/pomiary/${pomiarId}`, {
      params: { uzytkownikId: this.user()?.Id ?? '' },
    });
  }

  getOsobyWKomorce(komorkaId: number): Observable<OsobaWKomorce[]> {
    return this.http.get<OsobaWKomorce[]>(`${this.url}/komorki/${komorkaId}/uzytkownicy`);
  }

  private ustawUzytkownika(u: Uzytkownik | null): void {
    this.user.set(u);
    if (u) this.zapisz(localStorage, STORAGE_KEY, u);
    else this.usun(localStorage, STORAGE_KEY);
  }

  private wczytajUzytkownika(): Uzytkownik | null {
    return this.odczytaj<Uzytkownik>(localStorage, STORAGE_KEY);
  }

  /**
   * Zapamiętany użytkownik mógł zostać usunięty z bazy albo zmienić rolę -
   * po starcie aplikacji pobieramy jego aktualne dane z API.
   */
  private odswiezZapamietanego(): void {
    const u = this.user();
    if (!u) return;
    this.getUzytkownik(u.Id).subscribe({
      next: (swiezy) => {
        if (swiezy.Pseudonim === u.Pseudonim) this.ustawUzytkownika(swiezy);
        else this.wylogujIPrzeladuj();
      },
      error: (e) => {
        if (e?.status === 404) this.wylogujIPrzeladuj(); // konto już nie istnieje
        // brak sieci - zostajemy przy zapamiętanych danych
      },
    });
  }

  private wylogujIPrzeladuj(): void {
    this.logout();
    location.assign('/');
  }

  private zapisz(s: Storage, key: string, v: unknown): void {
    try {
      s.setItem(key, JSON.stringify(v));
    } catch {
      /* brak dostępu do pamięci przeglądarki - dane zostają tylko w pamięci aplikacji */
    }
  }

  private odczytaj<T>(s: Storage, key: string): T | null {
    try {
      const v = s.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  }

  private usun(s: Storage, key: string): void {
    try {
      s.removeItem(key);
    } catch {
      /* jw. */
    }
  }
}

/** Wyciąga czytelny komunikat z błędu HTTP. */
export function komunikatBledu(e: unknown): string {
  const err = e as { status?: number; error?: { error?: string } };
  if (err?.status === 0) return 'Brak połączenia z API (czy serwer wf-api działa na porcie 3000?)';
  return err?.error?.error ?? 'Wystąpił nieoczekiwany błąd.';
}
