import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { loadEnv, type Connect, type Plugin } from 'vite';

const VISION = 'openrouter/router/vision';
const VISION_MODEL = 'google/gemini-2.5-flash';
const PORTRAIT = 'fal-ai/nano-banana-2/edit';
const LABELS = { look: 'Gemini 2.5 Flash', portrait: 'Nano Banana 2' };
const LIMIT = 6 * 1024 * 1024;
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const SYSTEM = 'You look at photos to draw people as friendly storybook game heroes. Be kind and playful. Never mention age, weight, attractiveness, ethnicity or health. Reply with JSON only.';

const LOOK = [
  'Describe the person in this photo so they can be drawn as a friendly storybook game hero.',
  'Reply with one JSON object and nothing else, with these keys:',
  '"hair": "black", "dark brown", "brown", "auburn", "red", "blonde", "grey", "white" or "none";',
  '"hairStyle": "short", "long", "ponytail", "bun" or "bald";',
  '"skin": "fair", "light", "tan", "olive", "brown" or "deep";',
  '"glasses": true or false;',
  '"beard": "none", "stubble" or "beard";',
  '"colour": the main colour of their clothes: "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown", "black", "grey" or "white";',
  '"epithet": a short, kind, playful hero title inspired by the photo, beginning with "the", at most four words, no names;',
  '"story": one warm sentence of under 25 words beginning with "You", about this hero\'s past in a cosy land drawn in pen and pencil, with no names and nothing about their body.',
  'If there is no person in the photo, reply {"error":"no person"}.',
].join('\n');

const OUTFITS: Record<string, string> = {
  warden: 'a sturdy tunic with a scarf and a leather belt, holding a short sword',
  emberwright: 'a long hooded robe, holding a wooden staff topped with a glowing orb',
  strider: 'a hooded tunic with a longbow over the shoulder',
};

function portraitPrompt(classId: string, styled: boolean): string {
  return [
    `Redraw the person in the first image as the hero of a cosy fantasy game${styled ? ', drawn in exactly the art style of the second image' : ''}:`,
    'wobbly sepia ballpoint-pen outlines, coloured-pencil hatching at one diagonal slant on cream paper with the paper showing through, a deeper pencil for shadows, no smooth digital shading, no text, no frame.',
    'Chibi proportions with a big round head and a small body, and a warm friendly smile.',
    'Keep them recognisable: the same face shape, hair colour and hairstyle, skin tone, facial hair and glasses as in the photo.',
    `Dress them in ${OUTFITS[classId] ?? OUTFITS.warden}, in the colour of the clothes they wear in the photo.`,
    'Head and shoulders, centred, facing the viewer, on plain cream paper.',
  ].join(' ');
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > LIMIT) { reject(new Error('The photo is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function run<T>(key: string, model: string, input: unknown, ms: number): Promise<T> {
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(ms),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${model} answered ${res.status}: ${text.slice(0, 240)}`);
  return JSON.parse(text) as T;
}

async function asDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`The drawing could not be fetched (${res.status}).`);
  const type = res.headers.get('content-type') ?? 'image/jpeg';
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

function parseLook(text: string): Record<string, unknown> {
  const from = text.indexOf('{'), to = text.lastIndexOf('}');
  if (from < 0 || to <= from) throw new Error('The look came back unreadable.');
  const raw = JSON.parse(text.slice(from, to + 1)) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ['hair', 'hairStyle', 'skin', 'beard', 'colour', 'epithet', 'story', 'error']) {
    if (typeof raw[k] === 'string') out[k] = (raw[k] as string).trim().slice(0, 180);
  }
  if (typeof raw.glasses === 'boolean') out.glasses = raw.glasses;
  return out;
}

function styleImage(root: string): string {
  const file = path.join(root, 'tools', 'fal-style.jpg');
  return existsSync(file) ? `data:image/jpeg;base64,${readFileSync(file).toString('base64')}` : '';
}

export function falHero(): Plugin {
  let key = '';
  let root = '';
  let busy = 0;

  const handle: Connect.NextHandleFunction = async (req, res, next) => {
    const url = req.url ?? '';
    if (url === '/status' && req.method === 'GET') { send(res, 200, { ready: !!key, models: LABELS }); return; }
    if (req.method !== 'POST' || (url !== '/look' && url !== '/portrait')) { next(); return; }
    if (!key) { send(res, 503, { error: 'No fal key is set for this server.' }); return; }
    if (busy >= 4) { send(res, 429, { error: 'The drawing desk is busy. Try again in a moment.' }); return; }
    busy++;
    const t0 = performance.now();
    try {
      const body = JSON.parse(await readBody(req)) as { image?: unknown; classId?: unknown };
      const image = typeof body.image === 'string' ? body.image : '';
      if (!PHOTO.test(image)) { send(res, 400, { error: 'Send a JPEG, PNG or WebP photo.' }); return; }
      if (url === '/look') {
        const out = await run<{ output: string }>(key, VISION, {
          model: VISION_MODEL, image_urls: [image], system_prompt: SYSTEM, prompt: LOOK, temperature: 0.4, max_tokens: 400,
        }, 45000);
        send(res, 200, { look: parseLook(out.output), ms: Math.round(performance.now() - t0), model: LABELS.look });
      } else {
        const classId = typeof body.classId === 'string' && OUTFITS[body.classId] ? body.classId : 'warden';
        const style = styleImage(root);
        const input = {
          prompt: portraitPrompt(classId, !!style),
          image_urls: style ? [image, style] : [image],
          aspect_ratio: '1:1', output_format: 'jpeg', resolution: '0.5K', num_images: 1, sync_mode: true, safety_tolerance: '3',
        };
        type Drawn = { images?: { url: string }[] };
        const out = await run<Drawn>(key, PORTRAIT, input, 90000).catch((err: Error) => {
          if (!err.message.includes(' 422:')) throw err;
          console.warn(`[fal] /portrait: no drawing on the first try, trying once more`);
          return run<Drawn>(key, PORTRAIT, { ...input, seed: Math.floor(Math.random() * 2147483647) }, 90000);
        });
        const first = out.images?.[0]?.url;
        if (!first) throw new Error('No drawing came back.');
        send(res, 200, { image: await asDataUrl(first), ms: Math.round(performance.now() - t0), model: LABELS.portrait });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[fal] ${url}: ${message}`);
      if (!res.headersSent) send(res, 502, { error: message.includes('answered') ? 'fal could not finish that one. Try again.' : message });
    } finally {
      busy--;
    }
  };

  const mount = (server: { middlewares: Connect.Server }) => { server.middlewares.use('/api/fal', handle); };

  return {
    name: 'brushwild:fal-hero',
    apply: 'serve',
    configResolved(config) {
      const files = { ...loadEnv(config.mode, path.resolve(config.root, '..'), ''), ...loadEnv(config.mode, config.root, '') };
      key = process.env.FAL_KEY || process.env.FAL_API_KEY || files.FAL_KEY || files.FAL_API_KEY || '';
      root = config.root;
    },
    configureServer: mount,
    configurePreviewServer: mount,
  };
}
