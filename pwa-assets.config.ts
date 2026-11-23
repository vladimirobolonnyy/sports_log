import { defineConfig, type Preset } from '@vite-pwa/assets-generator/config';

// public/icon.svg is full-bleed and keeps its artwork inside the maskable safe zone, so no padding is added anywhere.
const preset: Preset = {
  transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
  maskable: { sizes: [512], padding: 0 },
  apple: { sizes: [180], padding: 0 },
};

export default defineConfig({
  preset,
  images: ['public/icon.svg'],
});
