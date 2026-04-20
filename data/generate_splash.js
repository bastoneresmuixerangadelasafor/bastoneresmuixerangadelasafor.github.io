import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ICON_PATH = resolve(ROOT, "docs", "images", "ios", "512.png");
const OUTPUT_DIR = resolve(ROOT, "docs", "images", "ios", "splash");
const BG_COLOR = { r: 124, g: 58, b: 237, alpha: 1 };

const SPLASH_SIZES = [
  { width: 1320, height: 2868 },
  { width: 1206, height: 2622 },
  { width: 1179, height: 2556 },
  { width: 1290, height: 2796 },
  { width: 1170, height: 2532 },
  { width: 1284, height: 2778 },
  { width: 1125, height: 2436 },
  { width: 1242, height: 2688 },
  { width: 828, height: 1792 },
  { width: 750, height: 1334 },
  { width: 640, height: 1136 },
  { width: 2048, height: 2732 },
  { width: 1668, height: 2388 },
  { width: 1640, height: 2360 },
  { width: 1620, height: 2160 },
  { width: 1488, height: 2266 },
  { width: 1536, height: 2048 },
  { width: 2732, height: 2048 },
  { width: 2388, height: 1668 },
  { width: 2360, height: 1640 },
  { width: 2160, height: 1620 },
  { width: 2266, height: 1488 },
  { width: 2048, height: 1536 },
];

async function generateSplash() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const icon = sharp(ICON_PATH);

  for (const size of SPLASH_SIZES) {
    const iconSize = Math.round(Math.min(size.width, size.height) * 0.35);
    const circleMask = Buffer.from(
      `<svg width="${iconSize}" height="${iconSize}"><circle cx="${iconSize / 2}" cy="${iconSize / 2}" r="${iconSize / 2}" fill="white"/></svg>`
    );
    const resizedIcon = await icon
      .clone()
      .resize(iconSize, iconSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .composite([{ input: circleMask, blend: "dest-in" }])
      .toBuffer();

    const left = Math.round((size.width - iconSize) / 2);
    const top = Math.round((size.height - iconSize) / 2);

    await sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background: BG_COLOR,
      },
    })
      .composite([{ input: resizedIcon, left, top }])
      .png()
      .toFile(resolve(OUTPUT_DIR, `splash_${size.width}x${size.height}.png`));

    console.log(`splash_${size.width}x${size.height}.png`);
  }
}

generateSplash();
