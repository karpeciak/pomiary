import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AlertController, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput,
  IonSpinner, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, informationCircleOutline, logOutOutline, saveOutline, statsChartOutline,
  timerOutline, trashOutline,
} from 'ionicons/icons';
import {
  BUZKI, PARAMETRY, Parametr, RPE_OPISY, TAPPING_SEKUND, WYLICZANE, minutyNaTekst,
} from '../../parametry';
import { ApiService, NowyPomiar, Pomiar, komunikatBledu } from '../../services/api.service';

type Klucz = Parametr['klucz'];
type Wartosci = Record<Klucz, number | null>;

const puste = (): Wartosci =>
  Object.fromEntries(PARAMETRY.map((p) => [p.klucz, null])) as Wartosci;

const zPomiaru = (m: Pomiar): Wartosci =>
  Object.fromEntries(PARAMETRY.map((p) => [p.klucz, m[p.kolumna] as number | null])) as Wartosci;

const DOBA_MIN = 1440;

@Component({
  selector: 'app-pomiary',
  imports: [
    FormsModule, DatePipe, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonContent, IonInput, IonFooter, IonSpinner,
  ],
  templateUrl: './pomiary.html',
  styleUrl: './pomiary.css',
})
export class PomiaryPage {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastController);
  private alert = inject(AlertController);

  readonly parametry = PARAMETRY;
  readonly wyliczane = WYLICZANE;
  readonly rpeOpisy = RPE_OPISY;
  readonly buzki = BUZKI;
  readonly rpeWartosci = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly tappingSekund = TAPPING_SEKUND;
  readonly minutyNaTekst = minutyNaTekst;

  // pojedyncze parametry używane wprost w szablonie
  readonly parametrTetno = PARAMETRY.find((p) => p.klucz === 'tetnoPoranne')!;
  readonly parametrSen = PARAMETRY.find((p) => p.klucz === 'sen')!;
  readonly parametrChec = PARAMETRY.find((p) => p.klucz === 'checDoTreningu')!;
  readonly parametrTapping = PARAMETRY.find((p) => p.klucz === 'tapping')!;

  readonly user = this.api.user;
  readonly dzis = new Date();

  readonly wartosci = signal<Wartosci>(puste());
  readonly zapisuje = signal(false);
  /** Dzisiejszy pomiar (jeden na dzień) - zapis go nadpisuje. */
  readonly dzisiejszy = signal<Pomiar | null>(null);

  /** Jednostka pól czasowych: godziny albo minuty (w bazie zawsze minuty). */
  readonly jednostka = signal<Record<'czasTreningu' | 'czasPracy', 'h' | 'min'>>({
    czasTreningu: 'min',
    czasPracy: 'h',
  });

  // tapping test
  readonly tappingTrwa = signal(false);
  readonly tappingStukniecia = signal(0);
  readonly tappingPozostalo = signal(TAPPING_SEKUND);
  private tappingTimer?: ReturnType<typeof setInterval>;

  readonly bledy = computed(() => {
    const w = this.wartosci();
    const b: Partial<Record<Klucz | 'doba', string>> = {};
    for (const p of PARAMETRY) {
      const v = w[p.klucz];
      if (v === null) continue;
      if (Number.isNaN(v)) b[p.klucz] = 'Podaj liczbę';
      else if (v < p.min || v > p.max) b[p.klucz] = `Zakres ${p.min}–${p.max} ${p.jednostka}`;
      else if (Math.abs(Math.round(v / p.krok) - v / p.krok) > 1e-9) {
        b[p.klucz] = p.krok === 1 ? 'Podaj liczbę całkowitą' : `Krok co ${p.krok} h (15 min)`;
      }
    }
    const razem = (w.czasTreningu ?? 0) + (w.czasPracy ?? 0);
    if (razem > DOBA_MIN) b.doba = `Trening i praca razem: ${minutyNaTekst(razem)} – doba ma 24 h`;
    return b;
  });

  readonly moznaZapisac = computed(
    () =>
      !this.zapisuje() &&
      Object.keys(this.bledy()).length === 0 &&
      PARAMETRY.some((p) => this.wartosci()[p.klucz] !== null),
  );

  /** Podgląd obciążeń (sRPE) liczonych przy zapisie: czas × RPE. */
  readonly podgladWyliczanych = computed(() => {
    const w = this.wartosci();
    return WYLICZANE.map((x) => {
      const [kCzas, kRpe] = x.zParametrow;
      const czas = w[kCzas];
      const rpe = w[kRpe];
      return { ...x, wartosc: czas === null || rpe === null ? null : czas * rpe };
    });
  });

  /** Dwie sekcje obciążenia: trening i praca (czas + RPE + wyliczone sRPE). */
  readonly sekcjeObciazenia = computed(() => {
    const w = this.wartosci();
    const podglad = this.podgladWyliczanych();
    const opisRpe = (k: Klucz) => {
      const v = w[k];
      return v === null ? '' : `${v} – ${RPE_OPISY[v]}`;
    };
    return [
      {
        tytul: 'Trening',
        czas: PARAMETRY[0],
        czasKlucz: 'czasTreningu' as const,
        rpe: PARAMETRY[1],
        opisRpe: opisRpe('rpeTreningu'),
        wynik: podglad[0],
      },
      {
        tytul: 'Praca (poza treningiem)',
        czas: PARAMETRY[2],
        czasKlucz: 'czasPracy' as const,
        rpe: PARAMETRY[3],
        opisRpe: opisRpe('rpePracy'),
        wynik: podglad[1],
      },
    ];
  });

  readonly opisSnu = computed(() => {
    const v = this.wartosci().sen;
    return v === null ? '' : minutyNaTekst(Math.round(v * 60));
  });

  readonly opisCheci = computed(() => {
    const v = this.wartosci().checDoTreningu;
    return v === null ? '' : `${v} – ${BUZKI[v - 1].opis}`;
  });

  constructor() {
    addIcons({
      saveOutline, statsChartOutline, logOutOutline, trashOutline, checkmarkCircleOutline,
      informationCircleOutline, timerOutline,
    });
    this.wczytajDzisiejszy();
  }

  // --- pola formularza ---------------------------------------------------

  ustaw(klucz: Klucz, v: number | null): void {
    this.wartosci.update((w) => ({ ...w, [klucz]: v }));
  }

  /** Wartość pola czasu w wybranej jednostce (w modelu zawsze minuty). */
  czasWJednostce(klucz: 'czasTreningu' | 'czasPracy'): number | null {
    const min = this.wartosci()[klucz];
    if (min === null) return null;
    return this.jednostka()[klucz] === 'h' ? Math.round((min / 60) * 100) / 100 : min;
  }

  ustawCzas(klucz: 'czasTreningu' | 'czasPracy', v: number | string | null | undefined): void {
    if (v === null || v === undefined || v === '') return this.ustaw(klucz, null);
    const liczba = Number(v);
    if (Number.isNaN(liczba)) return this.ustaw(klucz, null);
    this.ustaw(klucz, this.jednostka()[klucz] === 'h' ? Math.round(liczba * 60) : Math.round(liczba));
  }

  zmienJednostke(klucz: 'czasTreningu' | 'czasPracy', j: 'h' | 'min'): void {
    this.jednostka.update((x) => ({ ...x, [klucz]: j }));
  }

  ustawSen(v: number | string | null | undefined): void {
    this.ustawLiczbe('sen', v);
  }

  ustawLiczbe(klucz: Klucz, v: number | string | null | undefined): void {
    if (v === null || v === undefined || v === '') return this.ustaw(klucz, null);
    this.ustaw(klucz, Number(v));
  }

  /** Kliknięcie w tę samą wartość kasuje wybór (pole może zostać puste). */
  przelacz(klucz: Klucz, v: number): void {
    this.ustaw(klucz, this.wartosci()[klucz] === v ? null : v);
  }

  // --- tapping test ------------------------------------------------------

  startTapping(): void {
    if (this.tappingTrwa()) return;
    this.tappingStukniecia.set(0);
    this.tappingPozostalo.set(TAPPING_SEKUND);
    this.tappingTrwa.set(true);
    this.tappingTimer = setInterval(() => {
      const zostalo = this.tappingPozostalo() - 1;
      this.tappingPozostalo.set(zostalo);
      if (zostalo <= 0) this.zakonczTapping();
    }, 1000);
  }

  stuknij(): void {
    if (this.tappingTrwa()) this.tappingStukniecia.update((n) => n + 1);
  }

  private zakonczTapping(): void {
    clearInterval(this.tappingTimer);
    this.tappingTrwa.set(false);
    this.ustaw('tapping', this.tappingStukniecia());
  }

  ngOnDestroy(): void {
    clearInterval(this.tappingTimer);
  }

  // --- zapis, usuwanie, nawigacja ---------------------------------------

  zapisz(): void {
    const u = this.user();
    if (!u || !this.moznaZapisac()) return;
    const w = this.wartosci();
    const pomiar = { uzytkownikId: u.Id } as NowyPomiar;
    for (const p of PARAMETRY) pomiar[p.klucz] = w[p.klucz];

    this.zapisuje.set(true);
    this.api.zapiszPomiar(pomiar).subscribe({
      next: (zapisany) => {
        this.zapisuje.set(false);
        this.dzisiejszy.set(zapisany);
        this.wartosci.set(zPomiaru(zapisany));
        this.komunikat(zapisany.Nadpisany ? 'Dzisiejszy wpis nadpisany ✔' : 'Wpis zapisany ✔', 'success');
      },
      error: (e) => {
        this.zapisuje.set(false);
        this.komunikat(komunikatBledu(e), 'danger');
      },
    });
  }

  async usun(): Promise<void> {
    const d = this.dzisiejszy();
    if (!d) return;
    const a = await this.alert.create({
      header: 'Usunąć dzisiejszy wpis?',
      message: 'Tej operacji nie można cofnąć.',
      buttons: [
        { text: 'Anuluj', role: 'cancel' },
        {
          text: 'Usuń',
          role: 'destructive',
          handler: () => {
            this.api.usunPomiar(d.Id).subscribe({
              next: () => {
                this.dzisiejszy.set(null);
                this.wartosci.set(puste());
                this.komunikat('Wpis usunięty', 'medium');
              },
              error: (e) => this.komunikat(komunikatBledu(e), 'danger'),
            });
          },
        },
      ],
    });
    await a.present();
  }

  wykres(): void {
    const u = this.user();
    if (u) this.router.navigate(['/wykres', u.Id]);
  }

  async wyloguj(): Promise<void> {
    const a = await this.alert.create({
      header: 'Wylogować?',
      message: 'To urządzenie przestanie Cię pamiętać i trzeba będzie zalogować się ponownie.',
      buttons: [
        { text: 'Anuluj', role: 'cancel' },
        {
          text: 'Wyloguj',
          handler: () => {
            this.api.logout();
            this.router.navigate(['/login'], { replaceUrl: true });
          },
        },
      ],
    });
    await a.present();
  }

  private wczytajDzisiejszy(): void {
    const u = this.user();
    if (!u) return;
    const dzien = this.dzis.toDateString();
    this.api.getPomiary(u.Id).subscribe({
      next: (lista) => {
        const d = lista.filter((p) => new Date(p.Data).toDateString() === dzien).at(-1) ?? null;
        this.dzisiejszy.set(d);
        if (d) this.wartosci.set(zPomiaru(d));
      },
      error: () => this.dzisiejszy.set(null),
    });
  }

  private async komunikat(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
