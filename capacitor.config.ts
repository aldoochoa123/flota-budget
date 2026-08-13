import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flotabudget.app',
  appName: 'Flota Budget',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
