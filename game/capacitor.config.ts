import type { CapacitorConfig } from '@capacitor/cli';

// Oyunun koyu arka planı (src/render/theme.ts → css['--bg']). Android tarafında da
// game/android/app/src/main/res/values/colors.xml → kum_bg ile aynı tutulmalı.
const BG = '#1a120e';

const config: CapacitorConfig = {
  appId: 'com.takmaaza.kumbulmaca',
  appName: 'Kum Akışı',
  webDir: 'dist',
  android: {
    // Keep the WebView background dark to avoid a white flash on boot.
    backgroundColor: BG,
  },
  plugins: {
    // Capacitor 8 core plugin: edge-to-edge + safe-area CSS (index.html uses viewport-fit=cover).
    SystemBars: {
      insetsHandling: 'css',
      // DARK = dark bars background → light status/navigation icons.
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
