import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList,
  IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronForwardOutline, logOutOutline, personOutline, statsChartOutline, trashOutline,
} from 'ionicons/icons';
import { PARAMETRY } from '../../parametry';
import { ApiService, Komorka, OsobaWKomorce, Pomiar, komunikatBledu } from '../../services/api.service';

@Component({
  selector: 'app-admin',
  imports: [
    DatePipe, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
    IonSegment, IonSegmentButton, IonLabel, IonBadge, IonList, IonItem, IonSpinner, IonSelect, IonSelectOption,
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminPage {
  private api = inject(ApiService);
  private router = inject(Router);
  private alert = inject(AlertController);
  private toast = inject(ToastController);

  readonly parametry = PARAMETRY;
  readonly user = this.api.user;

  // krok 1: komórki
  readonly komorki = signal<Komorka[]>([]);
  readonly komorkaId = signal<number | null>(null);
  // krok 2: osoby w komórce
  readonly osoby = signal<OsobaWKomorce[]>([]);
  readonly ladujeOsoby = signal(false);
  // krok 3: pomiary wybranej osoby
  readonly osoba = signal<OsobaWKomorce | null>(null);
  readonly pomiary = signal<Pomiar[]>([]);
  readonly ladujePomiary = signal(false);

  constructor() {
    addIcons({ logOutOutline, statsChartOutline, chevronForwardOutline, personOutline, trashOutline });
    this.api.getKomorki().subscribe((k) => {
      this.komorki.set(k);
      if (k.length) this.wybierzKomorke(k[0].Id);
    });
  }

  wybierzKomorke(v: unknown): void {
    const id = Number(v);
    if (!Number.isInteger(id) || id === this.komorkaId()) return;
    this.komorkaId.set(id);
    this.osoba.set(null);
    this.pomiary.set([]);
    this.ladujeOsoby.set(true);
    this.api.getOsobyWKomorce(id).subscribe({
      next: (o) => {
        this.osoby.set(o);
        this.ladujeOsoby.set(false);
      },
      error: () => this.ladujeOsoby.set(false),
    });
  }

  wybierzOsobe(o: OsobaWKomorce): void {
    this.osoba.set(o);
    this.ladujePomiary.set(true);
    this.api.getPomiary(o.Id).subscribe({
      next: (p) => {
        this.pomiary.set([...p].reverse()); // najnowsze na górze
        this.ladujePomiary.set(false);
      },
      error: () => this.ladujePomiary.set(false),
    });
  }

  wykres(): void {
    const o = this.osoba();
    if (o) this.router.navigate(['/wykres', o.Id]);
  }

  async usunPomiar(m: Pomiar): Promise<void> {
    const data = new Date(m.Data).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
    const a = await this.alert.create({
      header: 'Usunąć pomiar?',
      message: `${this.osoba()?.Pseudonim}, ${data}. Tej operacji nie można cofnąć.`,
      buttons: [
        { text: 'Anuluj', role: 'cancel' },
        {
          text: 'Usuń',
          role: 'destructive',
          handler: () => {
            this.api.usunPomiar(m.Id).subscribe({
              next: () => {
                this.pomiary.update((lista) => lista.filter((x) => x.Id !== m.Id));
                this.odswiezOsoby();
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

  /** Aktualizuje liczniki pomiarów na liście osób (bez zmiany wybranej osoby). */
  private odswiezOsoby(): void {
    const id = this.komorkaId();
    if (id !== null) this.api.getOsobyWKomorce(id).subscribe((o) => this.osoby.set(o));
  }

  private async komunikat(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
