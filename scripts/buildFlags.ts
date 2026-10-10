// scripts/flagAreas.json(analyzeFlags.ts の出力)から、各国旗の色を決めて
// lib/flagColors.ts と docs/国名一覧.md を書き出す。
//   npx tsx scripts/buildFlags.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FLAG_LIST } from "../lib/flagList";
import { nameLen } from "../lib/flags";

/** この割合(%)以上の面積を占める色を、その国旗の色として数える。 */
const MIN_AREA = 2;

/** 自動判定の手直し。値は r w b g y k の並び。 */
const OVERRIDES: Record<string, string> = {
  // 黄色い模様と水色の境目が緑と誤判定されるため
  kz: "by",
};

const ORDER = "rwbgyk";
const COLOR_JA: Record<string, string> = { r: "赤", w: "白", b: "青", g: "緑", y: "黄", k: "黒" };
const REGION_JA: Record<string, string> = {
  as: "アジア",
  eu: "ヨーロッパ",
  af: "アフリカ",
  am: "アメリカ大陸",
  oc: "オセアニア",
};

const areas: Record<string, Record<string, number>> = JSON.parse(
  readFileSync(path.join("scripts", "flagAreas.json"), "utf8")
);

const colors: Record<string, string> = {};
for (const [code, a] of Object.entries(areas)) {
  colors[code] = OVERRIDES[code] ?? [...ORDER].filter((c) => a[c] >= MIN_AREA).join("");
}

writeFileSync(
  path.join("lib", "flagColors.ts"),
  `// 自動生成: scripts/buildFlags.ts。手で直す場合は buildFlags.ts の OVERRIDES に書く。\n` +
    `// r=赤 w=白 b=青 g=緑 y=黄 k=黒\n` +
    `export const FLAG_COLORS: Record<string, string> = ${JSON.stringify(colors, null, 2)};\n`
);

let md = `# 国名・色・地域の一覧\n\n自動生成(\`npm run flags\`)。国名は \`lib/flagList.ts\`、色の手直しは \`scripts/buildFlags.ts\` の OVERRIDES で行う。\n\n`;
md += `- 色は国旗の面積の${MIN_AREA}%以上を占めるものを数える(オレンジ・金は黄、えんじは赤、水色・紺は青に寄せる)。\n`;
md += `- 文字数は「・」と( )の中を除いて数える。\n\n`;
let total = 0;
const colorCount: Record<string, number> = {};
for (const [region, list] of Object.entries(FLAG_LIST)) {
  md += `## ${REGION_JA[region]}(${list.length})\n\n| 国旗 | 国名 | 文字数 | 色 |\n|---|---|---|---|\n`;
  for (const entry of list) {
    const [code, name] = entry.split("|");
    const cs = colors[code] ?? "";
    for (const c of cs) colorCount[c] = (colorCount[c] ?? 0) + 1;
    md += `| ![](../public/flags/${code}.svg) | ${name} | ${nameLen(name)} | ${[...cs].map((c) => COLOR_JA[c]).join("・")} |\n`;
    total++;
  }
  md += `\n`;
}
md += `## 色ごとの枚数(全${total}枚)\n\n| 色 | 枚数 | 割合 |\n|---|---|---|\n`;
for (const c of ORDER) md += `| ${COLOR_JA[c]} | ${colorCount[c]} | ${Math.round((colorCount[c] / total) * 100)}% |\n`;
writeFileSync(path.join("docs", "国名一覧.md"), md);
console.log(`${total} 件`, colorCount);
