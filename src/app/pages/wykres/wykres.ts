import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonLabel, IonSegment, IonSegmentButton,
  IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { PARAMETRY, Parametr } from '../../parametry';
import { ApiService, Pomiar, Uzytkownik } from '../../services/api.service';

interface Grupa {
  id: string;
  nazwa: string;
  kolumny: Parametr['kolumna'][];
}

const GRUPY: Grupa[] = [
  { id: 'wszystkie', nazwa: 'Wszystkie', kolumny: ['TetnoSpoczynek', 'TetnoWysilek', 'CisnienieSkurcz', 'CisnienieRozkurcz', 'SpO2'] },
  { id: 'tetno', nazwa: 'Tętno', kolumny: ['TetnoSpoczynek', 'TetnoWysilek'] },
  { id: 'cisnienie', nazwa: 'Ciśnienie', kolumny: ['CisnienieSkurcz', 'CisnienieRozkurcz'] },
  { id: 'spo2', nazwa: 'SpO₂', kolumny: ['SpO2'] },
  { id: 'wysilek', nazwa: 'Czas i RPE', kolumny: ['CzasMin', 'RPE'] },
];

@Component({
  selector: 'app-wykres',
  imports: [
    BaseChartDirective, DatePipe, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonSegment, IonSegmentButton, IonLabel, IonSpinner,
  ],
  templateUrl: './wykres.html',
  styleUrl: './wykres.css',
  // Chart.js ładowany tylko razem ze stroną wykresu
  providers: [provideCharts(withDefaultRegisterables())],
})
export class WykresPage {
  private api = inject(ApiService);
  private router = inject(Router);

  /** parametr trasy /wykres/:userId */
  readonly userId = input.required<string>();

  readonly grupy = GRUPY;
  readonly grupa = signal('wszystkie');
  readonly pomiary = signal<Pomiar[]>([]);
  readonly osoba = signal<Uzytkownik | null>(null);
  readonly laduje = signal(true);

  readonly powrot = computed(() => (this.api.user()?.Rola === 'admin' ? '/admin' : '/pomiary'));

  readonly ostatni = computed(() => this.pomiary().at(-1) ?? null);
  readonly parametryGrupy = computed(() => {
    const g = GRUPY.find((x) => x.id === this.grupa())!;
    return PARAMETRY.filter((p) => g.kolumny.includes(p.kolumna));
  });

  readonly dane = computed<ChartConfiguration<'line'>['data']>(() => {
    const lista = this.pomiary();
    return {
      labels: lista.map((p) => this.etykieta(p.Data)),
      datasets: this.parametryGrupy().map((p) => ({
        label: `${p.nazwa} (${p.jednostka})`,
        data: lista.map((m) => m[p.kolumna]),
        borderColor: p.kolor,
        backgroundColor: p.kolor,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.25,
        spanGaps: true,
      })),
    };
  });

  readonly opcje: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: '#8a8f98' } },
    },
    scales: {
      x: { grid: { color: 'rgba(128,128,128,0.15)' }, ticks: { color: '#8a8f98', maxRotation: 0, autoSkip: true } },
      y: { grid: { color: 'rgba(128,128,128,0.15)' }, ticks: { color: '#8a8f98' } },
    },
  };

  ngOnInit(): void {
    const id = Number(this.userId());
    const ja = this.api.user()!;
    // zwykły użytkownik widzi tylko swój wykres
    if (ja.Rola !== 'admin' && id !== ja.Id) {
      this.router.navigate(['/wykres', ja.Id], { replaceUrl: true });
      return;
    }
    if (id === ja.Id) this.osoba.set(ja);
    else this.api.getUzytkownik(id).subscribe((u) => this.osoba.set(u));

    this.api.getPomiary(id).subscribe({
      next: (p) => {
        this.pomiary.set(p);
        this.laduje.set(false);
      },
      error: () => this.laduje.set(false),
    });
  }

  zmienGrupe(v: unknown): void {
    if (typeof v === 'string') this.grupa.set(v);
  }

  private etykieta(iso: string): string {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm} ${hh}:${mi}`;
  }
}
