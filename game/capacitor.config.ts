import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.takmaaza.kumbulmaca',
  appName: 'Kum Akışı',
  webDir: 'dist',
  android: {
    // Keep the WebView background dark to avoid a white flash on boot.
    backgroundColor: '#14112b',
  },
};

export default config;
