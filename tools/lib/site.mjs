// The game page lives in site/ (site/about/ → https://…/about/) and goes next to the game in
// every web build: build-web.mjs copies it into the CLI build (so serve:web shows it too),
// deploy-web.mjs into whatever build it uploads. Not in game/build-templates: md5Cache would
// rename its files and rewrite its links like it does the template's.

import fs from 'node:fs';
import path from 'node:path';

export const SITE = path.resolve(import.meta.dirname, '../../site');

/** Copies site/ over the build folder; returns how many files it copied. */
export function copySite(buildDir) {
  if (!fs.existsSync(SITE)) return 0;
  fs.cpSync(SITE, buildDir, { recursive: true });
  let count = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else count++;
    }
  };
  walk(SITE);
  return count;
}
