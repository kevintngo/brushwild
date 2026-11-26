import { useEffect, useRef, useState } from 'preact/hooks';
import { ui, getGame, closePanel, openPanel, closeAll } from './store';
import type { ComponentChildren } from 'preact';
import { Choice, Icon, Painting, Tabs, confirmThen } from './components';
import { skillIcon } from './icons';
import { classArt } from './art';
import { bindingLabel } from './hud';
import { CLASS_LIST, CLASSES, skillDef } from '../game/content/classes';
import { DIFFICULTY } from '../game/content/monsters';
import { ATTRIBUTE_INFO } from '../game/rules/stats';
import type { ClassId, Difficulty } from '../game/types';
import type { HeroSummary } from '../game/save/store';
import { BEARDS, HAIRS, SKINS, STYLES, TUNICS, lookFromPhoto, type Look, type PhotoLook } from '../game/content/looks';
import { drawPortrait, falKnown, falModels, readLook, shrink, type Models } from './fal';
import falLogo from './fal-logo.svg';

const DEFAULT_LOOK: Record<ClassId, Look> = { warden: { tunic: 0, hair: 0 }, emberwright: { tunic: 1, hair: 1 }, strider: { tunic: 2, hair: 2 } };

export interface Lore { title?: string; story?: string }

export interface Session {
  heroes(): HeroSummary[];
  play(id: string): void;
  create(classId: ClassId, name: string, difficulty: Difficulty, look: Look, lore: Lore): void;
  preview(classId: ClassId, look: Look): void;
  endPreview(): void;
  remove(id: string): void;
  quitToTitle(): void;
}

export function Title({ session }: { session: Session }) {
  ui.heroes.value;
  const heroes = session.heroes();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus({ preventScroll: true }); }, []);
  const last = heroes[0];
  return (
    <div id="title">
      <div class="title-card">
        <h1>Brushwild</h1>
        <p class="tag">An open world drawn in pen and pencil</p>
        <div class="title-actions">
          {last ? <button ref={first} type="button" class="primary" onClick={() => session.play(last.id)}>Continue · {last.name}, level {last.level} {CLASSES[last.classId].name}</button>
            : <button ref={first} type="button" class="primary" onClick={() => (ui.screen.value = 'create')}>Begin a journey</button>}
          {heroes.length > 0 && <button type="button" onClick={() => (ui.screen.value = 'heroes')}>Choose a hero</button>}
          {heroes.length > 0 && <button type="button" onClick={() => (ui.screen.value = 'create')}>New hero</button>}
          <button type="button" onClick={() => openPanel('settings')}>Settings</button>
        </div>
        <p class="keys">{getGame().touch ? 'Tap to move and fight · the stick walks · drag the picture to turn the view' : 'Click to move and fight · WASD to walk · Space to evade · 1–4 and right click for skills'}</p>
      </div>
    </div>
  );
}

export function Heroes({ session }: { session: Session }) {
  ui.heroes.value;
  const heroes = session.heroes();
  return (
    <div id="title">
      <section class="title-card heroes" role="dialog" aria-label="Choose a hero">
        <h2>Your heroes</h2>
        <ul class="hero-list">
          {heroes.map((h) => (
            <li class="hero">
              <button type="button" class={`hero-play ${h.portrait ? 'art' : ''}`} onClick={() => session.play(h.id)}>
                {h.portrait && <img class="hero-face" src={h.portrait} alt="" />}
                <strong>{h.name}{h.title ? ` ${h.title}` : ''}</strong><span>Level {h.level} {CLASSES[h.classId].name} · {DIFFICULTY[h.difficulty as Difficulty]?.name ?? 'Normal'} · {Math.floor(h.played / 3600)}h {Math.floor(h.played / 60) % 60}m</span>
              </button>
              <button type="button" class="btn danger small" aria-label={`Let ${h.name} go`} onClick={() => confirmThen(`Let ${h.name} go?`, `${h.name}, level ${h.level}, and everything they carry will be gone for good. The stash is kept.`, 'Let them go', () => session.remove(h.id), true)}>Let go</button>
            </li>
          ))}
        </ul>
        <div class="pair">
          <button type="button" class="btn" onClick={() => (ui.screen.value = 'title')}>Back</button>
          <button type="button" class="btn primary" onClick={() => (ui.screen.value = 'create')}>New hero</button>
        </div>
      </section>
    </div>
  );
}

type Step = 'me' | 'class' | 'look' | 'name';

const Logo = () => <img class="fal-logo" src={falLogo} alt="fal" />;

export function Create({ session }: { session: Session }) {
  const [cls, setCls] = useState<ClassId>('warden');
  const [look, setLook] = useState<Look>(DEFAULT_LOOK.warden);
  const [mine, setMine] = useState(false);
  const [lore, setLore] = useState<Lore>({});
  const [name, setName] = useState('');
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [models, setModels] = useState<Models | null | undefined>(falKnown());
  const first: Step = falKnown() ? 'me' : 'class';
  const [tab, setTab] = useState<Step>(first);
  const [seen, setSeen] = useState<Step[]>(falKnown() === undefined ? [] : [first]);
  const c = CLASSES[cls];
  const open = (t: Step) => { setTab(t); setSeen((v) => (v.includes(t) ? v : [...v, t])); };
  useEffect(() => {
    if (models !== undefined) return;
    falModels().then((m) => { setModels(m); open(m ? 'me' : 'class'); });
  }, []);
  useEffect(() => { session.preview(cls, look); }, [cls, look.tunic, look.hair, look.skin, look.style, look.beard, look.glasses]);
  useEffect(() => () => session.endPreview(), []);
  const pick = (k: ClassId) => { setCls(k); if (!mine) setLook(DEFAULT_LOOK[k]); };
  const change = (patch: Partial<Look>) => { setMine(true); setLook((l) => ({ ...l, ...patch })); };
  const fromPhoto = (p: PhotoLook) => { setMine(true); setLook((l) => lookFromPhoto(l, p)); setLore({ title: p.epithet, story: p.story }); };
  const cycle = (v: number | undefined, n: number) => ((v ?? 0) + 1) % n;
  const back = () => { ui.screen.value = session.heroes().length ? 'heroes' : 'title'; };
  const tabs: [Step, ComponentChildren][] = [
    ...(models ? [['me', <span class="tab-fal">Draw me <small>with</small> <Logo /></span>] as [Step, ComponentChildren]] : []),
    ['class', 'Class'],
    ['look', 'Look'],
    ['name', 'Name'],
  ];
  return (
    <div id="title" class="side">
      <section class="title-card create" role="dialog" aria-label="A new hero">
        <h2>A new hero</h2>
        {models !== undefined && <Tabs tabs={tabs} value={tab} onChange={open} label="Make your hero" row />}
        <div class="create-body" role="tabpanel">
          {models && seen.includes('me') && (
            <div class="create-pane" hidden={tab !== 'me'}>
              <PhotoHero models={models} cls={cls} portrait={look.portrait} onLook={fromPhoto} onPortrait={(img) => setLook((l) => ({ ...l, portrait: img }))} />
              {lore.title && <p class="lore"><strong>{name.trim() || c.name} {lore.title}</strong>{lore.story && <span>{lore.story}</span>}</p>}
            </div>
          )}
          {seen.includes('class') && (
            <div class="create-pane" hidden={tab !== 'class'}>
              <div class="classes" role="radiogroup" aria-label="Class">
                {CLASS_LIST.map((k) => (
                  <button type="button" role="radio" aria-checked={k.id === cls} class={`class-card ${k.id === cls ? 'on' : ''}`} onClick={() => pick(k.id)}>
                    <Painting class="class-art" deps={k.id} paint={(px) => classArt(k.id, px)} />
                    <strong>{k.name}</strong><small>{k.tagline}</small>
                    <span class="class-skills">{k.start.map((id) => { const d = skillDef(id)!; return <Icon svg={skillIcon(d.icon, d.element)} />; })}</span>
                  </button>
                ))}
              </div>
              <p class="about">{c.about}</p>
              <div class="sheet">
                <div><span>Leans on</span>{ATTRIBUTE_INFO[c.primary].name}</div>
                <div><span>Fights with</span>{c.resource.name}</div>
                <div><span>Wields</span>{c.weapons.join(', ')}</div>
                <div><span>Begins with</span>{c.start.map((id) => skillDef(id)!.name).join(' and ')}</div>
              </div>
            </div>
          )}
          {seen.includes('look') && (
            <div class="create-pane" hidden={tab !== 'look'}>
              <Swatches label={cls === 'emberwright' ? 'Robe' : 'Tunic'} list={TUNICS} value={look.tunic} onPick={(i) => change({ tunic: i })} />
              <Swatches label="Hair" list={HAIRS} value={look.hair} onPick={(i) => change({ hair: i })} />
              <Swatches label="Skin" list={SKINS} value={look.skin ?? 0} onPick={(i) => change({ skin: i })} />
              <div class="swatches looks">
                <span>Style</span>
                <button type="button" class="chip" onClick={() => change({ style: cycle(look.style, STYLES.length) })}>{STYLES[look.style ?? 0]}</button>
                <button type="button" class="chip" onClick={() => change({ beard: cycle(look.beard, BEARDS.length) })}>{BEARDS[look.beard ?? 0]}</button>
                <button type="button" class={`chip ${look.glasses ? 'on' : ''}`} aria-pressed={!!look.glasses} onClick={() => change({ glasses: !look.glasses })}>Glasses</button>
              </div>
            </div>
          )}
          {seen.includes('name') && (
            <div class="create-pane" hidden={tab !== 'name'}>
              <label class="name-field"><span>Name</span><input type="text" maxLength={20} value={name} placeholder={c.name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} /></label>
              {lore.title && <p class="dim">You will be known as {name.trim() || c.name} {lore.title}.</p>}
              <Choice label="Difficulty" hint={DIFFICULTY[diff].desc + ' It can be changed later, in a town.'} value={diff} options={Object.entries(DIFFICULTY).filter(([k]) => k !== 'nightmare').map(([k, v]) => [k, v.name]) as [Difficulty, string][]} onChange={setDiff} />
            </div>
          )}
        </div>
        <div class="pair">
          <button type="button" class="btn" onClick={back}>Back</button>
          <button type="button" class="btn primary" onClick={() => session.create(cls, name, diff, look, lore)}>Begin</button>
        </div>
      </section>
    </div>
  );
}

interface Run { label: string; model: string; t0: number; ms?: number; failed?: string }

function PhotoHero({ models, cls, portrait, onLook, onPortrait }: { models: Models; cls: ClassId; portrait?: string; onLook: (p: PhotoLook) => void; onPortrait: (img: string) => void }) {
  const [camera, setCamera] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [drawnFor, setDrawnFor] = useState<ClassId | null>(null);
  const [error, setError] = useState('');
  const [, tick] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const busy = Object.values(runs).some((r) => r.ms === undefined && !r.failed);
  useEffect(() => {
    if (!busy) return;
    const h = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(h);
  }, [busy]);

  const mark = (id: string, patch: Partial<Run>) => setRuns((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const draw = (image: string, k: ClassId) => {
    setRuns((r) => ({ ...r, portrait: { label: 'Drawing your portrait', model: models.portrait, t0: performance.now() } }));
    drawPortrait(image, k)
      .then(async (out) => { onPortrait(await shrink(out.image, 320, 0.88)); setDrawnFor(k); mark('portrait', { ms: out.ms }); })
      .catch((e: Error) => mark('portrait', { failed: e.message }));
  };
  const start = async (src: Blob | string) => {
    setCamera(false);
    setError('');
    let image: string;
    try { image = await shrink(src, 768); } catch (e) { setError((e as Error).message); return; }
    setPhoto(image);
    setRuns({ look: { label: 'Reading your look', model: models.look, t0: performance.now() } });
    readLook(image)
      .then((out) => {
        if (out.look.error) { mark('look', { failed: 'No one to draw in that photo. Try another.' }); return; }
        onLook(out.look);
        mark('look', { ms: out.ms });
      })
      .catch((e: Error) => mark('look', { failed: e.message }));
    draw(image, cls);
  };
  const canFilm = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  return (
    <div class="photo-hero">
      {camera ? <Camera onShot={start} onClose={() => setCamera(false)} /> : (
        <div class="photo-row">
          {portrait ? <img class="photo-face" src={portrait} alt="Your hero, drawn from your photo" />
            : photo ? <img class="photo-face shot" src={photo} alt="Your photo" />
            : <span class="photo-face blank" aria-hidden="true" />}
          <div class="photo-text">
            <strong>{portrait ? 'You, drawn in pen and pencil' : 'Draw me as the hero'}</strong>
            <small>Your photo goes to fal to draw your hero. Only the drawing is kept, in this browser.</small>
            <div class="photo-actions">
              {canFilm && <button type="button" class="btn small" disabled={busy} onClick={() => setCamera(true)}>{photo ? 'Retake' : 'Camera'}</button>}
              <button type="button" class="btn small" disabled={busy} onClick={() => file.current?.click()}>Upload a photo</button>
              {photo && portrait && drawnFor && drawnFor !== cls && !busy && <button type="button" class="btn small" onClick={() => draw(photo, cls)}>Redraw as {CLASSES[cls].name}</button>}
              <input ref={file} type="file" accept="image/*" hidden onChange={(e) => {
                const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
                if (f) start(f);
                input.value = '';
              }} />
            </div>
          </div>
        </div>
      )}
      {Object.keys(runs).length > 0 && (
        <ul class="fal-runs" aria-live="polite">
          {Object.entries(runs).map(([id, r]) => (
            <li key={id} class={r.failed ? 'failed' : r.ms !== undefined ? 'done' : 'busy'}>
              <span>{r.label}</span>
              <small>{r.model}</small>
              <b>{r.failed ? 'failed' : `${((r.ms ?? performance.now() - r.t0) / 1000).toFixed(1)} s`}</b>
              {r.failed && <em>{r.failed}</em>}
            </li>
          ))}
        </ul>
      )}
      {error && <p class="bad small">{error}</p>}
    </div>
  );
}

function Camera({ onShot, onClose }: { onShot: (image: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stream: MediaStream | null = null, live = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (!live) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); }
      })
      .catch(() => setError('The camera is not available here. Upload a photo instead.'));
    return () => { live = false; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    onShot(canvas.toDataURL('image/jpeg', 0.9));
  };
  return (
    <div class="camera">
      {error ? <p class="bad small">{error}</p> : <video ref={video} playsInline muted aria-label="Camera" />}
      <div class="pair">
        <button type="button" class="btn" onClick={onClose}>Cancel</button>
        <button type="button" class="btn primary" disabled={!!error} onClick={snap}>Take the photo</button>
      </div>
    </div>
  );
}

function Swatches({ label, list, value, onPick }: { label: string; list: { name: string; rgb: [number, number, number] }[]; value: number; onPick: (i: number) => void }) {
  return (
    <div class="swatches" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      {list.map((p, i) => (
        <button type="button" role="radio" aria-checked={i === value} aria-label={p.name} title={p.name} class={`swatch ${i === value ? 'on' : ''}`}
          style={{ background: `rgb(${p.rgb.join(',')})` }} onClick={() => onPick(i)} />
      ))}
    </div>
  );
}

export function PauseMenu({ session }: { session: Session }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  return (
    <section class="overlay plate menu" role="dialog" aria-label="Menu">
      <h2>Paused</h2>
      <button ref={first} type="button" class="btn primary" onClick={() => closeAll()}>Back to the game</button>
      <button type="button" class="btn" onClick={() => openPanel('skills')}>Skill tree</button>
      <button type="button" class="btn" onClick={() => openPanel('settings')}>Settings</button>
      <button type="button" class="btn" onClick={() => openPanel('help')}>How to play</button>
      <button type="button" class="btn" onClick={() => { closeAll(); getGame().bus.emit('guide:restart'); }}>Show me the first steps again</button>
      <button type="button" class="btn" onClick={() => session.quitToTitle()}>Save and go to the title</button>
    </section>
  );
}

export function Help() {
  const g = getGame();
  const k = bindingLabel;
  const rows: [string, string][] = g.touch ? [
    ['Stick', 'Your left thumb walks. Push it part-way to stroll.'],
    ['Tap', 'Tap the picture to walk to a spot, attack a creature or talk to townsfolk.'],
    ['Big button', 'Uses your first skill on the nearest creature, talks, or opens a door. Hold it to keep fighting.'],
    ['Round buttons', 'Your other skills, a tonic and Evade.'],
    ['Drag / pinch', 'Turn and tilt the view, and zoom.'],
  ] : [
    ['Left click', `Walk; click a creature to fight it with your first skill (${k('slot1')}).`],
    [`${k('slot2')}, ${k('slot3')}–${k('slot6')}`, 'Your other skills. They aim at your target, or at the cursor.'],
    [k('evade'), 'Evade: a quick roll, untouchable while it lasts. Every hero has it.'],
    [k('potion'), 'Drink a tonic. Waystones refill them.'],
    [k('interact'), 'Attack the nearest creature, talk, or use a door.'],
    ['W A S D', 'Walk by hand.'],
    [`${k('standStill')} + click`, 'Attack where you point without moving.'],
    ['Right drag, Q / E, wheel', 'Turn, tilt and zoom the view.'],
    [`${k('inventory')} · ${k('character')} · ${k('skills')}`, 'Inventory, character sheet, skill tree.'],
    [`${k('map')} · ${k('journal')} · Esc`, 'Map and waystones, journal, menu.'],
    [k('showLabels'), 'Hold to label every item on the ground, and see each line’s possible range in tooltips.'],
  ];
  return (
    <section class="overlay plate help" role="dialog" aria-label="How to play">
      <header><h2>How to play</h2><div class="head-actions"><button type="button" class="x" aria-label="Close" onClick={() => closePanel('help')}>×</button></div></header>
      <div class="body">
        <div class="keys-list">{rows.map(([a, b]) => <><kbd>{a}</kbd><span>{b}</span></>)}</div>
        <p class="dim">Every level gives a skill point for the skill tree. Basic skills build your resource; Core skills spend it. Each skill can be enhanced, then upgraded one of two ways.</p>
        <p class="dim">Gear comes in five rarities: Common, Magic, Rare, Legendary (with a power of its own) and Unique. Compare in the tooltip; smiths salvage what you do not want and enchant what you keep.</p>
        <p class="dim">Mustard hatching on the ground means a blow is coming there: step out of it, or Evade through it. The farther from Hearthmere, the stronger the wilds; crypts and hollows hold an Inkbound and a hoard.</p>
      </div>
    </section>
  );
}
