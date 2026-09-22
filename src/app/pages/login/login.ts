import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonList, IonNote,
  IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logInOutline, pulseOutline } from 'ionicons/icons';
import { ApiService, Komorka, komunikatBledu } from '../../services/api.service';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonInput,
    IonSelect, IonSelectOption, IonButton, IonIcon, IonNote, IonSpinner,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastController);

  readonly komorki = signal<Komorka[]>([]);
  readonly laduje = signal(false);

  pseudonim = '';
  komorkaId: number | null = null;

  constructor() {
    addIcons({ pulseOutline, logInOutline });
    // podpowiedź z ostatniego logowania na tym urządzeniu
    const ostatni = this.api.ostatniLogin();
    if (ostatni) {
      this.pseudonim = ostatni.pseudonim;
      this.komorkaId = ostatni.komorkaId;
    }
    this.api.getKomorki().subscribe({
      next: (k) => this.komorki.set(k),
      error: (e) => this.pokazBlad(komunikatBledu(e)),
    });
  }

  zaloguj(): void {
    const ps = this.pseudonim.trim();
    if (!ps || this.laduje()) return;
    this.laduje.set(true);
    this.api.login(ps, this.komorkaId).subscribe({
      next: (u) => {
        this.laduje.set(false);
        this.router.navigate([u.Rola === 'admin' ? '/admin' : '/pomiary'], { replaceUrl: true });
      },
      error: (e) => {
        this.laduje.set(false);
        this.pokazBlad(komunikatBledu(e));
      },
    });
  }

  private async pokazBlad(message: string) {
    const t = await this.toast.create({ message, duration: 3500, color: 'danger', position: 'top' });
    await t.present();
  }
}
