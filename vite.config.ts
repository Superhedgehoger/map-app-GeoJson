import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const legacyAssets = [
  'build-single.py',
  'custom-group-manager.js',
  'dashboard-panel.js',
  'distribution-config.js',
  'example.geojson',
  'layer-stats.js',
  'marker-group.js',
  'popup-config.js',
  'property-editor.js',
  'script.js',
  'selection-manager.js',
  'style.css',
  'table-view-styles.css',
  'table-view.js',
  'timeline-manager.js',
  'ui-dialogs.js',
  'variant-config.js'
];

function copyLegacyAssets(): Plugin {
  return {
    name: 'copy-geomap-legacy-assets',
    apply: 'build',
    async closeBundle() {
      const outDir = resolve('dist');
      await mkdir(outDir, { recursive: true });
      await Promise.all(legacyAssets.map((file) => copyFile(resolve(file), resolve(outDir, file))));
    }
  };
}

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [copyLegacyAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020'
  }
});
