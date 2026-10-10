// 国旗SVGを画素にして、6色(赤・白・青・緑・黄・黒)それぞれが占める面積の割合を出す。
// 結果は scripts/flagAreas.json に書き出し、buildFlags.ts が色の判定に使う。
//   npx tsx scripts/analyzeFlags.ts
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { FLAG_LIST } from "../lib/flagList";

const SRC = path.join("node_modules", "flag-icons", "flags", "4x3");
const OUT = path.join("public", "flags");
const KEYS = ["r", "w", "b", "g", "y", "k"] as const;

// 微妙な色は近い色へ寄せる: オレンジ・金は黄、えんじは赤、水色・紺は青。
function classify(r: number, g: number, b: number): (typeof KEYS)[number] | null {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l > 0.9 || (l > 0.8 && s < 0.25)) return "w";
  if (l < 0.1 || (l < 0.22 && s < 0.4)) return "k";
  if (s < 0.25) return null; // 灰色
  let h = 0;
  if (max === r / 255) h = ((g - b) / 255 / d) % 6;
  else if (max === g / 255) h = (b - r) / 255 / d + 2;
  else h = (r - g) / 255 / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 18 || h >= 335) return "r";
  if (h < 70) return l < 0.3 ? null : "y"; // 暗いものは茶色
  if (h < 170) return "g";
  if (h < 265) return "b";
  return null; // 紫・ピンク
}

async function main() {
  const areas: Record<string, Record<string, number>> = {};
  for (const entry of Object.values(FLAG_LIST).flat()) {
    const code = entry.split("|")[0];
    const file = path.join(SRC, `${code}.svg`);
    if (!existsSync(file)) {
      console.error(`見つかりません: ${code}`);
      continue;
    }
    copyFileSync(file, path.join(OUT, `${code}.svg`));
    const { data, info } = await sharp(file, { density: 96 })
      .resize(240, 180, { fit: "fill" })
      .flatten({ background: "#ffffff" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const counts: Record<string, number> = { r: 0, w: 0, b: 0, g: 0, y: 0, k: 0 };
    const total = info.width * info.height;
    for (let i = 0; i < data.length; i += info.channels) {
      const c = classify(data[i], data[i + 1], data[i + 2]);
      if (c) counts[c]++;
    }
    areas[code] = Object.fromEntries(KEYS.map((k) => [k, Math.round((counts[k] / total) * 1000) / 10]));
  }
  writeFileSync(path.join("scripts", "flagAreas.json"), JSON.stringify(areas, null, 0).replace(/},/g, "},\n"));
  console.log(`${Object.keys(areas).length} 件を解析しました`);
}

main();
