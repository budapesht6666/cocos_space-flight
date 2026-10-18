// Builds the pictures of the web page around the game from two sources in the repo:
//   tools/web-art/logo.png — the logo, rendered from tools/web-art/logo.html (see its header);
//   game/build-templates/web-mobile/icons/icon-512.png — the app icon.
// Into game/build-templates/web-mobile (copied into every web-mobile build):
//   splash/logo.png          the loading splash's logo (index.ejs, style.css #splash);
//   splash/launch-WxH.png    iPhone launch screens of the installed app: the splash's picture —
//                            background, glow, logo and the loading bar's track — at each screen size;
//   icons/favicon-32.png     the browser tab icon.
// Into game/native/engine/ios (the native iOS app's template, PLATFORMS.md "Native iOS"):
//   Images.xcassets/AppIcon.appiconset/*.png   the app icon at every size its Contents.json lists;
//   LaunchScreenBackground.png                 the launch screen (LaunchScreen.storyboard fills the
//                                              screen with it, cropping the edges off other sizes).
//
// Usage: npm run build:web-art

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TEMPLATE = path.join(ROOT, 'game/build-templates/web-mobile');
const LOGO = path.join(ROOT, 'tools/web-art/logo.png');
const ICON = path.join(TEMPLATE, 'icons/icon-512.png');
const IOS = path.join(ROOT, 'game/native/engine/ios');

/** The splash's layout in CSS pixels, as in style.css #splash. */
const SPLASH = {
  background: '#03040b',
  glow: { rx: 0.7, ry: 0.4, color: 'rgb(34, 62, 140)', opacity: 0.3, end: 0.7 },
  logoWidth: (w) => Math.min(0.82 * w, 460),
  barWidth: (w) => Math.min(0.36 * w, 180),
  barHeight: 3,
  barGap: 28,
  barColor: 'rgb(90, 210, 255)',
  barOpacity: 0.14,
};

/** The splash logo's width in pixels: sharp on a 3× phone (~350 CSS px), small enough to show at once. */
const SPLASH_LOGO_WIDTH = 1200;

/** iPhones in portrait: CSS size and pixel ratio (index.ejs links one launch screen per entry). */
const IPHONES = [
  [375, 667, 2], // SE 2nd/3rd gen, 8
  [414, 736, 3], // 8 Plus
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 2], // XR, 11
  [414, 896, 3], // XS Max, 11 Pro Max
  [390, 844, 3], // 12, 13, 14, 16e
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [420, 912, 3], // Air
];

/** Background and glow of a W×H (pixels) screen: the CSS radial gradient as an SVG ellipse. */
function backdrop(width, height) {
  const g = SPLASH.glow;
  const rx = g.rx * width;
  const ry = g.ry * height;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><radialGradient id="g" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="${g.color}" stop-opacity="${g.opacity}"/>
    <stop offset="${g.end}" stop-color="${g.color}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="${SPLASH.background}"/>
  <rect x="${width / 2 - rx}" y="${height / 2 - ry}" width="${2 * rx}" height="${2 * ry}" fill="url(#g)"/>
</svg>`);
}

/** The native app's launch screen in CSS pixels and pixel ratio: the tallest iPhone's (1290×2796). */
const IOS_LAUNCH = [430, 932, 3];

async function launchScreen(cssWidth, cssHeight, ratio, logoSource, file = null) {
  const width = cssWidth * ratio;
  const height = cssHeight * ratio;
  const meta = await sharp(logoSource).metadata();
  const logoW = Math.round(SPLASH.logoWidth(cssWidth) * ratio);
  const logoH = Math.round((logoW * meta.height) / meta.width);
  const barW = Math.round(SPLASH.barWidth(cssWidth) * ratio);
  const barH = SPLASH.barHeight * ratio;
  const gap = SPLASH.barGap * ratio;
  // Logo and bar are one centred column, like the splash's flexbox.
  const top = Math.round((height - (logoH + gap + barH)) / 2);
  const logo = await sharp(logoSource).resize(logoW, logoH).png().toBuffer();
  const bar = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${barW}" height="${barH}"><rect width="100%" height="100%" rx="${barH * 0.66}" fill="${SPLASH.barColor}" fill-opacity="${SPLASH.barOpacity}"/></svg>`,
  );
  file ??= path.join(TEMPLATE, `splash/launch-${width}x${height}.png`);
  await sharp(backdrop(width, height))
    .composite([
      { input: logo, left: Math.round((width - logoW) / 2), top },
      { input: bar, left: Math.round((width - barW) / 2), top: top + logoH + gap },
    ])
    .png({ compressionLevel: 9, palette: true, quality: 100 })
    .toFile(file);
  return file;
}

await fs.mkdir(path.join(TEMPLATE, 'splash'), { recursive: true });

const splashLogo = path.join(TEMPLATE, 'splash/logo.png');
// A 256-colour palette: a third of the full PNG's size, and the glow shows no banding.
await sharp(LOGO).resize({ width: SPLASH_LOGO_WIDTH, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true, quality: 100 }).toFile(splashLogo);

const written = [splashLogo];
for (const [w, h, ratio] of IPHONES) written.push(await launchScreen(w, h, ratio, LOGO));

const favicon = path.join(TEMPLATE, 'icons/favicon-32.png');
await sharp(ICON).resize(32, 32).png({ compressionLevel: 9 }).toFile(favicon);
written.push(favicon);

// The native icons have no alpha channel: iOS shows transparent pixels black.
const iconSet = path.join(IOS, 'Images.xcassets/AppIcon.appiconset');
const { images } = JSON.parse(await fs.readFile(path.join(iconSet, 'Contents.json'), 'utf8'));
const iconSizes = new Map(images.map((image) => [image.filename, Number(image['expected-size'])]));
for (const [name, size] of iconSizes) {
  const file = path.join(iconSet, name);
  await sharp(ICON).resize(size, size, { kernel: 'lanczos3' }).removeAlpha().png({ compressionLevel: 9 }).toFile(file);
  written.push(file);
}
const [lw, lh, lr] = IOS_LAUNCH;
written.push(await launchScreen(lw, lh, lr, LOGO, path.join(IOS, 'LaunchScreenBackground.png')));

for (const file of written) {
  const { size } = await fs.stat(file);
  console.log(`${path.relative(ROOT, file)}  ${(size / 1024).toFixed(0)} KB`);
}
