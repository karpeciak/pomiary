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
  trashOutline,
} from 'ionicons/icons';
import { PARAMETRY, Parametr } from '../../parametry';
import { ApiService, NowyPomiar, Pomiar, komunikatBledu } from '../../services/api.service';

type Wartosci = Record<Parametr['klucz'], number | string | null>;

const puste = (): Wartosci =>
  Object.fromEntries(PARAMETRY.map((p) => [p.klucz, null])) as Wartosci;

/** Wartości formularza z zapisanego pomiaru. */
const zPomiaru = (m: Pomiar): Wartosci =>
  Object.fromEntries(PARAMETRY.map((p) => [p.klucz, m[p.kolumna]])) as Wartosci;

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
  readonly user = this.api.user;
  readonly dzis = new Date();

  readonly wartosci = signal<Wartosci>(puste());
  readonly zapisuje = signal(false);
  /** Dzisiejszy pomiar (jeden na dzień) - zapis go nadpisuje. */
  readonly dzisiejszy = signal<Pomiar | null>(null);

  readonly bledy = computed(() => {
    const w = this.wartosci();
    const b: Partial<Record<Parametr['klucz'], string>> = {};
    for (const p of PARAMETRY) {
      const v = this.liczba(w[p.klucz]);
      if (v === null) continue;
      if (Number.isNaN(v) || !Number.isInteger(v)) b[p.klucz] = 'Podaj liczbę całkowitą';
      else if (v < p.min || v > p.max) b[p.klucz] = `Zakres ${p.min}–${p.max}`;
    }
    return b;
  });

  readonly moznaZapisac = computed(
    () =>
      !this.zapisuje() &&
      Object.keys(this.bledy()).length === 0 &&
      PARAMETRY.some((p) => this.liczba(this.wartosci()[p.klucz]) !== null),
  );

  constructor() {
    addIcons({
      saveOutline, statsChartOutline, logOutOutline, trashOutline, checkmarkCircleOutline,
      informationCircleOutline,
    });
    this.wczytajDzisiejszy();
  }

  ustaw(klucz: Parametr['klucz'], v: number | string | null | undefined): void {
    this.wartosci.update((w) => ({ ...w, [klucz]: v ?? null }));
  }

  zapisz(): void {
    const u = this.user();
    if (!u || !this.moznaZapisac()) return;
    const w = this.wartosci();
    const pomiar = { uzytkownikId: u.Id } as NowyPomiar;
    for (const p of PARAMETRY) pomiar[p.klucz] = this.liczba(w[p.klucz]);

    this.zapisuje.set(true);
    this.api.zapiszPomiar(pomiar).subscribe({
      next: (zapisany) => {
        this.zapisuje.set(false);
        this.dzisiejszy.set(zapisany);
        this.wartosci.set(zPomiaru(zapisany));
        this.komunikat(zapisany.Nadpisany ? 'Dzisiejszy pomiar nadpisany ✔' : 'Pomiar zapisany ✔', 'success');
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
      header: 'Usunąć dzisiejszy pomiar?',
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
                this.komunikat('Pomiar usunięty', 'medium');
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

  private liczba(v: number | string | null): number | null {
    if (v === null || v === undefined || v === '') return null;
    return Number(v);
  }

  private async komunikat(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
