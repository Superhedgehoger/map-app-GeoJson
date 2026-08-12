import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const files = {
  'node_modules/@fortawesome/fontawesome-free/css/all.min.css':
    'public/vendor/fontawesome/css/all.min.css',
  'node_modules/@fortawesome/fontawesome-free/webfonts': 'public/vendor/fontawesome/webfonts',
  'node_modules/html2canvas/dist/html2canvas.min.js':
    'public/vendor/html2canvas/html2canvas.min.js',
  'node_modules/leaflet/dist/leaflet.css': 'public/vendor/leaflet/leaflet.css',
  'node_modules/leaflet/dist/leaflet.js': 'public/vendor/leaflet/leaflet.js',
  'node_modules/leaflet/dist/images': 'public/vendor/leaflet/images',
  'node_modules/leaflet-draw/dist/leaflet.draw.css': 'public/vendor/leaflet-draw/leaflet.draw.css',
  'node_modules/leaflet-draw/dist/leaflet.draw.js': 'public/vendor/leaflet-draw/leaflet.draw.js',
  'node_modules/leaflet-draw/dist/images': 'public/vendor/leaflet-draw/images',
  'node_modules/leaflet.markercluster/dist/MarkerCluster.css':
    'public/vendor/leaflet-markercluster/MarkerCluster.css',
  'node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css':
    'public/vendor/leaflet-markercluster/MarkerCluster.Default.css',
  'node_modules/leaflet.markercluster/dist/leaflet.markercluster.js':
    'public/vendor/leaflet-markercluster/leaflet.markercluster.js',
  'node_modules/papaparse/papaparse.min.js': 'public/vendor/papaparse/papaparse.min.js',
  'node_modules/tabulator-tables/dist/css/tabulator_midnight.min.css':
    'public/vendor/tabulator/tabulator_midnight.min.css',
  'node_modules/tabulator-tables/dist/js/tabulator.min.js':
    'public/vendor/tabulator/tabulator.min.js',
  'node_modules/xlsx/dist/xlsx.full.min.js': 'public/vendor/xlsx/xlsx.full.min.js',
  'node_modules/dompurify/dist/purify.min.js': 'public/vendor/dompurify/purify.min.js'
};

for (const [source, destination] of Object.entries(files)) {
  await mkdir(dirname(resolve(destination)), { recursive: true });
  await cp(resolve(source), resolve(destination), { recursive: true, force: true });
}

console.log(`Prepared ${Object.keys(files).length} pinned vendor assets.`);
