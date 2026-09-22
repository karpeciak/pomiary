import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pl.pomiary.wysilkowe',
  appName: 'Pomiary',
  // wynik "npx ng build"
  webDir: 'dist/apkaWF/browser',
  ios: {
    contentInset: 'never',
  },
};

export default config;
