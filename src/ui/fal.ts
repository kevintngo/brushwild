import type { ClassId } from '../game/types';
import type { PhotoLook } from '../game/content/looks';

export interface Timed { ms: number; model: string }
export interface Models { look: string; portrait: string }

let status: Promise<Models | null> | null = null;
let known: Models | null | undefined;

export function falModels(): Promise<Models | null> {
  status ??= fetch('/api/fal/status')
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { ready?: boolean; models?: Models } | null) => (j?.ready && j.models ? j.models : null))
    .catch(() => null)
    .then((m) => (known = m));
  return status;
}

export const falKnown = (): Models | null | undefined => known;

async function post<T>(path: string, body: unknown): Promise<T & Timed> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & Timed & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `The drawing desk answered ${res.status}.`);
  return json;
}

export const readLook = (image: string) => post<{ look: PhotoLook }>('/api/fal/look', { image });
export const drawPortrait = (image: string, classId: ClassId) => post<{ image: string }>('/api/fal/portrait', { image, classId });

function load(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    img.onload = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => reject(new Error('That file is not a picture this browser can read.'));
    img.src = url;
  });
}

export async function shrink(src: Blob | string, max: number, quality = 0.86): Promise<string> {
  const img = await load(src);
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot prepare the photo.');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}
