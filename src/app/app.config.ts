import { registerLocaleData } from '@angular/common';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import localePl from '@angular/common/locales/pl';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { routes } from './app.routes';

registerLocaleData(localePl);

/** Darmowy ngrok zamiast JSON-a zwraca stronę z ostrzeżeniem - ten nagłówek ją pomija. */
const ngrokInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.url.includes('.ngrok') ? req.clone({ setHeaders: { 'ngrok-skip-browser-warning': '1' } }) : req);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([ngrokInterceptor])),
    provideIonicAngular(),
    { provide: LOCALE_ID, useValue: 'pl' },
  ],
};
