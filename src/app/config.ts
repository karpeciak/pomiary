import { Capacitor } from '@capacitor/core';

/**
 * Publiczny adres API (HTTPS) używany przez aplikację zainstalowaną na telefonie.
 * Stała domena ngrok przypisana do konta. Tunel uruchamia: npm run tunel
 * Po zmianie adresu zbuduj aplikację ponownie (npm run ios).
 */
export const API_URL_TELEFON = 'https://causation-these-attendee.ngrok-free.dev/api';

/** true = aplikacja działa jako natywna aplikacja iOS/Android (Capacitor), a nie w przeglądarce. */
export const czyNatywna = Capacitor.isNativePlatform();

/**
 * Adres API:
 * - aplikacja natywna -> stały adres publiczny,
 * - "ng serve" (port 4200) -> API na porcie 3000 tego samego hosta,
 * - strona serwowana przez wf-api (localhost:3000, IP w sieci, tunel ngrok) -> ten sam adres co strona.
 */
export const API_URL = czyNatywna
  ? API_URL_TELEFON
  : location.port === '4200'
    ? `${location.protocol}//${location.hostname}:3000/api`
    : `${location.origin}/api`;
