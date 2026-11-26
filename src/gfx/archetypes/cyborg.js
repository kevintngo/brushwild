import { registerArchetype } from '../passes/entities.js';
import { glsl } from '../shaderlib.js';
import { SKELETON } from './humanoid.js';

const HEAD = { dims: [90, 97, 91], cube: 384, file: 'static/cyborg-head' };
let made = null;

const image = (src) => new Promise((ok, no) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => no(new Error(`Could not load ${src}`));
  img.src = src;
});

async function load(gl) {
  const base = import.meta.env.BASE_URL;
  const [bin, img] = await Promise.all([
    fetch(`${base}${HEAD.file}.bin`).then((r) => { if (!r.ok) throw new Error(`head ${r.status}`); return r.arrayBuffer(); }),
    image(`${base}${HEAD.file}.jpg`),
  ]);
  const [w, h, d] = HEAD.dims;
  if (bin.byteLength !== w * h * d) throw new Error('head volume has the wrong size');
  gl.bindTexture(gl.TEXTURE_3D, made.sdf);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, w, h, d, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(bin));
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  const n = HEAD.cube, c = document.createElement('canvas');
  c.width = n * 6;
  c.height = n;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, made.col);
  for (let i = 0; i < 6; i++) {
    const px = new Uint8Array(g.getImageData(i * n, 0, n, n).data.buffer);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  }
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  made.ready = 1;
}

function init(gl) {
  if (made) return;
  const sdf = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, sdf);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, k, gl.CLAMP_TO_EDGE);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, 1, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([255]));
  const col = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, col);
  for (let i = 0; i < 6; i++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([70, 56, 50, 255]));
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  made = { sdf, col, ready: 0 };
  load(gl).catch((e) => console.warn('Cyborg head unavailable:', e));
}

function bind(p, gl) {
  if (!made) return;
  p.tex('uHeadSdf', made.sdf, gl.TEXTURE_3D).tex('uHeadCol', made.col, gl.TEXTURE_CUBE_MAP);
  p.set('uHeadReady', made.ready);
}

registerArchetype({
  id: 'cyborg', boundY: 0.82, boundR: 1.12, steps: 84, again: 0, init, bind,
  glsl: glsl`
${SKELETON}
uniform highp sampler3D uHeadSdf;
uniform samplerCube uHeadCol;
uniform float uHeadReady;
const vec3 HEAD_LO = vec3(-0.41336, -0.44391, -0.42063);
const vec3 HEAD_HI = vec3(0.42364, 0.45819, 0.42567);
const vec3 HEAD_LENS = vec3(0.1157, -0.0279, 0.289);
const vec3 HEAD_EYE = vec3(0.0, 0.02, -0.02);
const float HEAD_RANGE = 0.06;
const float HEAD_K = 0.88;
const vec3 CY_GLOW = vec3(0.36, 0.92, 1.0);
const vec3 CY_PLATE = vec3(0.9, 0.91, 0.94);
const vec3 CY_SUIT = vec3(0.19, 0.2, 0.26);
const vec3 CY_METAL = vec3(0.34, 0.36, 0.44);
vec3 cShL, cShR, cElL, cElR, cHipL, cHipR, cKnL, cKnR, cAim, cMuzzle, cHeadAt, cBadge;
float cGlow;

vec3 joint(vec3 a, vec3 b, float la, float lb, vec3 pole) {
  vec3 ab = b - a;
  float len = max(length(ab), 1e-3);
  vec3 dir = ab / len;
  float d = min(len, la + lb - 1e-3);
  float x = (la * la - lb * lb + d * d) / (2.0 * d);
  float h = sqrt(max(la * la - x * x, 0.0));
  return a + dir * x + normalize(pole - dir * dot(pole, dir) + 1e-4) * h;
}

void entPose() {
  gCannon = true;
  basePose();
  cShL = hChest + vec3(-0.25, 0.06, -0.01);
  cShR = hChest + vec3(0.25, 0.06, -0.01);
  cElL = joint(cShL, hHandL, 0.17, 0.18, vec3(-0.35, -0.2, -1.0));
  cElR = joint(cShR, hHandR, 0.17, 0.18, vec3(0.35, -0.2, -1.0));
  cHipL = hHip + vec3(-0.1, -0.03, 0.0);
  cHipR = hHip + vec3(0.1, -0.03, 0.0);
  cKnL = joint(cHipL, hFootL + vec3(0.0, 0.09, 0.0), 0.17, 0.17, vec3(0.0, 0.0, 1.0));
  cKnR = joint(cHipR, hFootR + vec3(0.0, 0.09, 0.0), 0.17, 0.17, vec3(0.0, 0.0, 1.0));
  cAim = normalize(hHandR - cElR);
  cMuzzle = hHandR + cAim * 0.14;
  cHeadAt = hHead + vec3(0.0, 0.03, 0.0);
  cBadge = hChest + vec3(0.0, 0.0, 0.152);
  cGlow = 0.6 + 0.4 * hDraw;
}

float headMap(vec3 p) {
  vec3 q = (p - cHeadAt) / HEAD_K;
  if (uHeadReady < 0.5) return (length(q - vec3(0.0, 0.0, 0.03)) - 0.31) * HEAD_K;
  float box = sdBox(q - (HEAD_LO + HEAD_HI) * 0.5, (HEAD_HI - HEAD_LO) * 0.5);
  if (box > 0.0) return (box + 0.036) * HEAD_K;
  float s = texture(uHeadSdf, (q - HEAD_LO) / (HEAD_HI - HEAD_LO)).r;
  return (s - 0.5) * 2.0 * HEAD_RANGE * HEAD_K;
}

float entMap(vec3 p, out float mat) {
  float d = headMap(p);
  mat = 0.0;

  float suit = sdCapsule(p, hChest + vec3(0.0, 0.06, -0.01), cHeadAt + vec3(0.0, -0.22, -0.05), 0.072);
  suit = min(suit, sdTaper(p, hHip + vec3(0.0, 0.06, 0.0), hChest + vec3(0.0, -0.1, 0.0), 0.125, 0.15));
  suit = min(suit, min(sdCapsule(p, cShL, cElL, 0.05), sdCapsule(p, cShR, cElR, 0.05)));
  suit = min(suit, min(length(p - cElL) - 0.058, length(p - cElR) - 0.058));
  suit = min(suit, min(sdCapsule(p, cHipL, cKnL, 0.058), sdCapsule(p, cHipR, cKnR, 0.058)));
  if (suit < d) { d = suit; mat = 2.0; }

  float plate = sdEllipsoid(p - hChest - vec3(0.0, -0.005, 0.005), vec3(0.235, 0.18, 0.158));
  plate = min(plate, sdEllipsoid(p - hHip - vec3(0.0, 0.02, 0.0), vec3(0.168, 0.092, 0.132)));
  vec3 pl = p - cShL - vec3(-0.035, 0.035, 0.0), pr = p - cShR - vec3(0.035, 0.035, 0.0);
  plate = min(plate, max(min(sdEllipsoid(pl, vec3(0.125, 0.092, 0.125)), sdEllipsoid(pr, vec3(0.125, 0.092, 0.125))), hChest.y - 0.05 - p.y));
  vec3 fl = normalize(hHandL - cElL);
  plate = min(plate, sdTaper(p, cElL + fl * 0.03, hHandL - fl * 0.02, 0.06, 0.068));
  plate = min(plate, min(sdTaper(p, cHipL + vec3(0.0, -0.03, 0.012), cKnL, 0.076, 0.064), sdTaper(p, cHipR + vec3(0.0, -0.03, 0.012), cKnR, 0.076, 0.064)));
  plate = min(plate, min(sdTaper(p, cKnL, hFootL + vec3(0.0, 0.1, 0.0), 0.064, 0.058), sdTaper(p, cKnR, hFootR + vec3(0.0, 0.1, 0.0), 0.064, 0.058)));
  if (plate < d) { d = plate; mat = 1.0; }

  vec3 e = p - cBadge;
  float badge = max(length(e.xy) - 0.098, abs(e.z) - 0.026) - 0.008;
  if (badge < d) { d = badge; mat = 3.0; }

  float metal = sdTaper(p, cElR - cAim * 0.02, cMuzzle, 0.082, 0.075);
  metal = max(metal, -sdCapsule(p, cMuzzle - cAim * 0.06, cMuzzle + cAim * 0.06, 0.042));
  metal = min(metal, length(p - hHandL) - 0.066);
  metal = min(metal, min(sdBoot(p, hFootL, cKnL, 0.17), sdBoot(p, hFootR, cKnR, 0.17)));
  metal = min(metal, sdTorusY(p - hHip - vec3(0.0, 0.08, 0.0), 0.15, 0.026));
  vec3 bp = p - hChest - vec3(0.0, -0.02, -0.17);
  metal = min(metal, sdRoundBox(bp, vec3(0.13, 0.15, 0.06), 0.035));
  vec2 nz = vec2(abs(bp.x) - 0.075, bp.z);
  metal = min(metal, max(length(nz) - 0.038, abs(bp.y + 0.19) - 0.05));
  if (metal < d) { d = metal; mat = 5.0; }

  float accent = sdTorusY(p - hChest - vec3(0.0, 0.135, -0.005), 0.112, 0.038);
  accent = min(accent, min(length(p - cKnL - vec3(0.0, 0.01, 0.05)) - 0.046, length(p - cKnR - vec3(0.0, 0.01, 0.05)) - 0.046));
  if (accent < d) { d = accent; mat = 6.0; }

  float glow = length(p - cMuzzle + cAim * 0.03) - 0.036;
  glow = min(glow, length(p - hHip - vec3(0.0, 0.08, 0.162)) - 0.03);
  float burn = 0.05 + 0.16 * eMove + 0.05 * sin(uTime * 37.0 + eLook.x * 11.0);
  vec3 fq = vec3(nz.x, bp.y + 0.24, nz.y);
  glow = min(glow, sdTaper(fq, vec3(0.0), vec3(0.0, -burn, 0.0), 0.03, 0.006));
  if (glow < d) { d = glow; mat = 4.0; }
  float lens = length(p - cHeadAt - HEAD_LENS * HEAD_K) - 0.042 * HEAD_K;
  if (lens < d) { d = lens; mat = 7.0; }
  return d;
}

void entSurf(vec3 p, float mat, inout Surf s) {
  int m = int(mat + 0.5);
  if (m == 0) {
    vec3 dq = (p - cHeadAt) / HEAD_K - HEAD_EYE;
    vec3 d = normalize(dq);
    vec3 c = uHeadReady > 0.5 ? texture(uHeadCol, d).rgb : P_TAN;
    vec3 t1 = normalize(cross(d, abs(d.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(d, t1);
    float e = gPen * 0.55 / (HEAD_K * max(length(dq), 0.05));
    vec3 gx = texture(uHeadCol, normalize(d + t1 * e)).rgb - texture(uHeadCol, normalize(d - t1 * e)).rgb;
    vec3 gy = texture(uHeadCol, normalize(d + t2 * e)).rgb - texture(uHeadCol, normalize(d - t2 * e)).rgb;
    float lum = dot(c, vec3(0.3, 0.55, 0.15));
    s.albedo = c;
    s.cover = mix(0.96, 0.8, smoothstep(0.3, 0.75, lum));
    s.solid = 0.62; s.wrap = 0.3; s.occ = 0.4;
    s.ink = uHeadReady > 0.5 ? smoothstep(0.42, 0.7, length(gx) + length(gy)) * 0.65 : 0.0;
    float lens = smoothstep(0.12, 0.3, min(c.g, c.b) - c.r) * step(0.5, c.b);
    if (lens > 0.5) { s.albedo = mix(CY_GLOW, vec3(1.0), 0.3 + 0.3 * cGlow); s.cover = 1.0; s.solid = 1.0; s.glow = 1.0; s.ink *= 0.4; }
  } else if (m == 1) {
    s.albedo = CY_PLATE; s.cover = 0.2; s.wrap = 0.25;
    vec3 c = p - hChest;
    bool torso = abs(c.y) < 0.19 && length(c.xz) < 0.26;
    if (torso) {
      float seam = abs(c.y + 0.115) - 0.006;
      if (seam < 0.0 && c.z > 0.04) { s.albedo = CY_GLOW; s.cover = 1.0; s.solid = 1.0; s.glow = cGlow; }
      s.ink = max(penLine(c.y - 0.07) * step(abs(c.x), 0.2) * 0.6, penLine(abs(c.x) - 0.13) * step(0.03, c.z) * step(c.y, 0.07) * 0.5);
    }
    if (p.y > hChest.y + 0.02 && abs(c.x) > 0.17) {
      s.albedo = eColA; s.cover = 0.85;
      s.ink = penLine(p.y - hChest.y - 0.1) * 0.7;
    }
    if (p.y < hHip.y - 0.04) {
      vec3 kn = length(p - cKnL) < length(p - cKnR) ? cKnL : cKnR;
      float stripe = abs(p.x - kn.x) - 0.011;
      if (stripe < 0.0 && p.z > kn.z + 0.03) { s.albedo = CY_GLOW; s.cover = 1.0; s.solid = 1.0; s.glow = cGlow; }
      s.ink = penLine(p.y - kn.y + 0.01) * 0.6;
    }
    float fore = dot(p - cElL, normalize(hHandL - cElL));
    if (length(p - hHandL) < 0.22 && abs(fore - 0.1) < 0.008) { s.albedo = CY_GLOW; s.cover = 1.0; s.solid = 1.0; s.glow = cGlow; }
  } else if (m == 2) {
    s.albedo = CY_SUIT; s.cover = 0.9;
    s.ink = penLine(sin((p.y + p.x * 0.3) * 120.0) * 0.004) * 0.25;
  } else if (m == 3) {
    vec3 e = p - cBadge;
    float r = length(e.xy), ang = atan(e.y, e.x);
    vec2 h = abs(rot2(uTime * 0.6) * e.xy);
    float hexa = smoothstep(0.007, 0.003, abs(max(dot(h, vec2(0.5, 0.8660254)), h.x) - 0.046));
    float ring = smoothstep(0.009, 0.004, abs(r - 0.088));
    float ticks = step(0.5, fract(ang / 6.2832 * 12.0 - uTime * 0.4)) * smoothstep(0.006, 0.002, abs(r - 0.069));
    float core = smoothstep(0.026, 0.018, r);
    float lit = max(max(ring, hexa), max(ticks, core)) * step(0.0, e.z);
    s.albedo = INK_BLACK; s.cover = 1.0; s.solid = 1.0;
    if (lit > 0.4) { s.albedo = mix(CY_GLOW, vec3(1.0), core * 0.7); s.glow = 0.8 + 0.2 * sin(uTime * 4.0); }
    s.ink = penLine(r - 0.104) * 0.9;
  } else if (m == 4) {
    s.albedo = mix(CY_GLOW, vec3(1.0), 0.3); s.cover = 1.0; s.solid = 1.0; s.glow = 1.0;
  } else if (m == 7) {
    vec3 l = p - cHeadAt - HEAD_LENS * HEAD_K;
    float r = length(l.xy) / (0.042 * HEAD_K);
    s.albedo = mix(vec3(1.0), CY_GLOW, smoothstep(0.2, 0.5, r * (1.1 - 0.25 * cGlow)));
    if (r > 0.78) s.albedo = CY_GLOW * 0.8;
    s.cover = 1.0; s.solid = 1.0; s.glow = 1.0;
    s.ink = smoothstep(0.86, 0.94, r) * 0.7;
  } else if (m == 5) {
    s.albedo = CY_METAL; s.cover = 0.72; s.wrap = 0.2;
    float along = dot(p - cElR, cAim);
    if (length(p - hHandR) < 0.3) {
      s.ink = penLine((fract(along * 12.0) - 0.5) * 0.08) * 0.7;
      if (along > length(cMuzzle - cElR) - 0.05) { s.albedo = CY_GLOW; s.cover = 1.0; s.solid = 1.0; s.glow = cGlow; s.ink = 0.0; }
    }
  } else {
    s.albedo = eColA; s.cover = 0.86;
  }
}
`,
});
