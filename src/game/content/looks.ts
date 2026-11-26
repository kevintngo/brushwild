import type { Vec3 } from '../types';

export interface Pencil { name: string; rgb: [number, number, number] }

export const TUNICS: Pencil[] = [
  { name: 'Vermilion', rgb: [214, 70, 52] },
  { name: 'Slate', rgb: [84, 108, 156] },
  { name: 'Moss', rgb: [94, 140, 78] },
  { name: 'Ochre', rgb: [196, 148, 52] },
  { name: 'Plum', rgb: [136, 84, 120] },
  { name: 'Teal', rgb: [70, 150, 150] },
  { name: 'Charcoal', rgb: [74, 77, 94] },
  { name: 'Rose', rgb: [212, 112, 136] },
  { name: 'Linen', rgb: [222, 210, 182] },
  { name: 'Bark', rgb: [140, 96, 62] },
];

export const HAIRS: Pencil[] = [
  { name: 'Umber', rgb: [122, 62, 44] },
  { name: 'Wheat', rgb: [226, 188, 130] },
  { name: 'Ink', rgb: [54, 52, 60] },
  { name: 'Auburn', rgb: [168, 76, 46] },
  { name: 'Silver', rgb: [196, 196, 204] },
  { name: 'Honey', rgb: [214, 154, 70] },
  { name: 'Chestnut', rgb: [86, 52, 38] },
  { name: 'Copper', rgb: [196, 96, 52] },
  { name: 'Snow', rgb: [238, 234, 228] },
];

export const SKINS: Pencil[] = [
  { name: 'Peach', rgb: [246, 214, 180] },
  { name: 'Fair', rgb: [250, 226, 206] },
  { name: 'Light', rgb: [240, 200, 160] },
  { name: 'Tan', rgb: [218, 166, 118] },
  { name: 'Olive', rgb: [192, 150, 100] },
  { name: 'Brown', rgb: [146, 100, 66] },
  { name: 'Deep', rgb: [98, 66, 46] },
];

export const STYLES = ['As the class wears it', 'Short', 'Long', 'Ponytail', 'Bun', 'Bald'];
export const BEARDS = ['No beard', 'Stubble', 'Beard'];

export interface Look {
  tunic: number;
  hair: number;
  skin?: number;
  style?: number;
  beard?: number;
  glasses?: boolean;
  portrait?: string;
}

export interface PhotoLook {
  hair?: string;
  hairStyle?: string;
  skin?: string;
  glasses?: boolean;
  beard?: string;
  colour?: string;
  epithet?: string;
  story?: string;
  error?: string;
}

const HAIR_OF: Record<string, number> = { black: 2, 'dark brown': 6, brown: 0, auburn: 3, red: 7, blonde: 1, grey: 4, white: 8 };
const STYLE_OF: Record<string, number> = { short: 1, long: 2, ponytail: 3, bun: 4, bald: 5 };
const SKIN_OF: Record<string, number> = { fair: 1, light: 2, tan: 3, olive: 4, brown: 5, deep: 6 };
const BEARD_OF: Record<string, number> = { none: 0, stubble: 1, beard: 2 };
const TUNIC_OF: Record<string, number> = { red: 0, orange: 3, yellow: 3, green: 2, teal: 5, blue: 1, purple: 4, pink: 7, brown: 9, black: 6, grey: 6, white: 8 };

const key = (s: string | undefined) => (s ?? '').toLowerCase().trim();

export function lookFromPhoto(base: Look, p: PhotoLook): Look {
  const out: Look = { ...base };
  const hair = HAIR_OF[key(p.hair)], style = STYLE_OF[key(p.hairStyle)], skin = SKIN_OF[key(p.skin)];
  const beard = BEARD_OF[key(p.beard)], tunic = TUNIC_OF[key(p.colour)];
  if (hair !== undefined) out.hair = hair;
  if (style !== undefined) out.style = style;
  if (key(p.hair) === 'none') out.style = STYLE_OF.bald;
  if (skin !== undefined) out.skin = skin;
  if (beard !== undefined) out.beard = beard;
  if (tunic !== undefined) out.tunic = tunic;
  if (typeof p.glasses === 'boolean') out.glasses = p.glasses;
  return out;
}

export function cleanLook(raw: unknown): Look | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const index = (v: unknown, n: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n ? v : undefined);
  const look: Look = { tunic: index(r.tunic, TUNICS.length) ?? 0, hair: index(r.hair, HAIRS.length) ?? 0 };
  const skin = index(r.skin, SKINS.length), style = index(r.style, STYLES.length), beard = index(r.beard, BEARDS.length);
  if (skin !== undefined) look.skin = skin;
  if (style !== undefined) look.style = style;
  if (beard !== undefined) look.beard = beard;
  if (r.glasses === true) look.glasses = true;
  if (typeof r.portrait === 'string' && r.portrait.startsWith('data:image/') && r.portrait.length < 400000) look.portrait = r.portrait;
  return look;
}

export function appearanceBits(look: Look | undefined): number {
  if (!look) return 0;
  return 64 * (look.skin ?? 0) + 512 * (look.style ?? 0) + 4096 * (look.beard ?? 0) + 16384 * (look.glasses ? 1 : 0);
}

export const pencilOf = (p: Pencil): Vec3 => [p.rgb[0] / 255, p.rgb[1] / 255, p.rgb[2] / 255];
