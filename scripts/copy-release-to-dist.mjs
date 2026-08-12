import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const downloads = resolve('dist', 'downloads');
await mkdir(downloads, { recursive: true });

for (const variant of ['full', 'lite']) {
  await copyFile(
    resolve('release', `geomap-${variant}.html`),
    resolve(downloads, `geomap-${variant}.html`)
  );
}

console.log(`Standalone downloads copied to ${downloads}`);
