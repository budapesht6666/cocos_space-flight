// Stage 9 release: the title screen's install tip, and the web page around the game — every file
// its template and manifest point to is there.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { installPlatform, INSTALL_TIPS, type PageEnv } from '../../game/assets/scripts/core/install';
import { FEEDBACK_URL } from '../../game/assets/scripts/data/links';

const TEMPLATE = path.resolve(__dirname, '../../game/build-templates/web-mobile');
const SITE = path.resolve(__dirname, '../../site');

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

function env(userAgent: string, standalone = false, maxTouchPoints = 0): PageEnv {
  return { userAgent, standalone, maxTouchPoints };
}

describe('install tip', () => {
  it('shows on phones and tablets in the browser', () => {
    expect(installPlatform(env(UA.iphone, false, 5))).toBe('ios');
    expect(installPlatform(env(UA.android, false, 5))).toBe('android');
  });

  it('knows iPadOS Safari behind its Mac user agent by touch', () => {
    expect(installPlatform(env(UA.ipad, false, 5))).toBe('ios');
    expect(installPlatform(env(UA.ipad, false, 0))).toBeNull();
  });

  it('stays away on a computer and once installed', () => {
    expect(installPlatform(env(UA.windows))).toBeNull();
    expect(installPlatform(env(UA.iphone, true, 5))).toBeNull();
    expect(installPlatform(env(UA.android, true, 5))).toBeNull();
  });

  it('fits the font: capitals and plain ASCII only', () => {
    for (const tip of Object.values(INSTALL_TIPS)) {
      for (const line of [tip.title, tip.steps]) expect(line).toMatch(/^[A-Z0-9 >]+$/);
    }
  });
});

describe('web page template', () => {
  const index = fs.readFileSync(path.join(TEMPLATE, 'index.ejs'), 'utf8');

  it('has every launch screen, icon and splash picture it links', () => {
    const local = [...index.matchAll(/(?:href|src)="([^"<]+\.png)"/g)].map((m) => m[1]);
    expect(local.length).toBeGreaterThan(12);
    for (const file of local) expect(fs.existsSync(path.join(TEMPLATE, file)), file).toBe(true);
  });

  it('links one launch screen per iPhone size, each the size its media query asks for', () => {
    const links = [...index.matchAll(/device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\)[^"]*" href="splash\/launch-(\d+)x(\d+)\.png"/g)];
    expect(links.length).toBe(12);
    const seen = new Set<string>();
    for (const [, w, h, ratio, pw, ph] of links) {
      expect(Number(pw)).toBe(Number(w) * Number(ratio));
      expect(Number(ph)).toBe(Number(h) * Number(ratio));
      seen.add(`${w}x${h}@${ratio}`);
    }
    expect(seen.size).toBe(12);
  });

  it('has the manifest icons and screenshots (screenshots come from the game page, site/)', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(TEMPLATE, 'manifest.webmanifest'), 'utf8')) as {
      icons: { src: string }[];
      screenshots: { src: string; sizes: string }[];
    };
    for (const icon of manifest.icons) expect(fs.existsSync(path.join(TEMPLATE, icon.src)), icon.src).toBe(true);
    for (const shot of manifest.screenshots) expect(fs.existsSync(path.join(SITE, shot.src)), shot.src).toBe(true);
  });
});

describe('game page', () => {
  const page = fs.readFileSync(path.join(SITE, 'about/index.html'), 'utf8');

  it('has every picture, video and font it links', () => {
    const local = [...page.matchAll(/(?:href|src|poster)="(?!https?:|\/|#)([^"]+)"/g)].map((m) => m[1]);
    expect(local.length).toBeGreaterThan(8);
    for (const file of local) expect(fs.existsSync(path.join(SITE, 'about', file)), file).toBe(true);
    for (const m of page.matchAll(/url\('([^']+)'\)/g)) expect(fs.existsSync(path.join(SITE, 'about', m[1])), m[1]).toBe(true);
  });

  it('sends feedback where the game does', () => {
    expect(page).toContain(`href="${FEEDBACK_URL}"`);
  });

  it('links the game build only through files the build has', () => {
    for (const m of page.matchAll(/(?:href|src)="\/(splash|icons)\/([^"]+)"/g)) {
      expect(fs.existsSync(path.join(TEMPLATE, m[1], m[2])), `${m[1]}/${m[2]}`).toBe(true);
    }
  });
});
