import { FLAG_COLORS } from "./flagColors";
import { FLAG_LIST, type Region } from "./flagList";

export type { Region };
export type Color = "red" | "white" | "blue" | "green" | "yellow" | "black";

export const COLORS: Color[] = ["red", "white", "blue", "green", "yellow", "black"];
export const REGIONS: Region[] = ["as", "eu", "af", "am", "oc"];

export const COLOR_JA: Record<Color, string> = {
  red: "赤",
  white: "白",
  blue: "青",
  green: "緑",
  yellow: "黄",
  black: "黒",
};

export const COLOR_HEX: Record<Color, string> = {
  red: "#e5484d",
  white: "#f5f5f5",
  blue: "#3b82f6",
  green: "#22a55b",
  yellow: "#f5c518",
  black: "#1f1f1f",
};

export const REGION_JA: Record<Region, string> = {
  as: "アジア",
  eu: "ヨーロッパ",
  af: "アフリカ",
  am: "アメリカ大陸",
  oc: "オセアニア",
};

export interface Flag {
  /** Index into FLAGS; what the game state stores. */
  id: number;
  /** File name under /flags. */
  code: string;
  name: string;
  /** Characters this flag adds to the name role ("・" and anything in parentheses not counted). */
  len: number;
  region: Region;
  colors: Color[];
}

/** 「ドミニカ(共和国)」は4文字: 「・」と( )の中は数えない。 */
export function nameLen(name: string): number {
  return name.replace(/\(.*?\)|・/g, "").length;
}

const LETTER: Record<string, Color> = { r: "red", w: "white", b: "blue", g: "green", y: "yellow", k: "black" };

export const FLAGS: Flag[] = REGIONS.flatMap((region) =>
  FLAG_LIST[region].map((entry) => {
    const [code, name] = entry.split("|");
    return { code, name, region };
  })
).map((f, id) => ({
  ...f,
  id,
  len: nameLen(f.name),
  colors: [...(FLAG_COLORS[f.code] ?? "")].map((c) => LETTER[c]),
}));
