import { Program } from '../gl.js';
import { glsl } from '../shaderlib.js';

export const FX_TYPES = [];
const byId = new Map();
export const FX_FLOATS = 16;

export function registerFx(id, glsl) {
  const def = { id, type: FX_TYPES.length, glsl };
  FX_TYPES.push(def);
  byId.set(id, def);
  return def;
}
export const fxType = (id) => byId.get(id).type;

const FX_VS = glsl`
layout(location = 0) in vec4 iPosSize;
layout(location = 1) in vec4 iParams;
layout(location = 2) in vec4 iColor;
layout(location = 3) in vec4 iMore;
uniform mat4 uViewProj;
uniform vec3 uCamPos, uCamRight, uCamUp;
uniform float uFar;
out vec2 vUv;
out float vT;
out vec3 vWorld;
flat out vec4 vParams, vColor, vMore, vPosSize;
#include <common>
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec3 wp;
  if (iMore.x > 1.5) {
    float cp = cos(iMore.w);
    vec3 ax = vec3(sin(iParams.w) * cp, sin(iMore.w), cos(iParams.w) * cp);
    vec3 side = cross(ax, uCamPos - iPosSize.xyz);
    side = length(side) > 1e-4 ? normalize(side) : uCamRight;
    wp = iPosSize.xyz + (side * corner.x + ax * corner.y * iMore.y) * iPosSize.w;
  } else {
    vec2 c = rot2(iParams.w) * (corner * (iMore.x > 0.5 ? vec2(1.35, 1.35 * iMore.y) : vec2(1.0)));
    wp = iMore.x > 0.5
      ? iPosSize.xyz + vec3(c.x, 0.0, c.y) * iPosSize.w
      : iPosSize.xyz + (uCamRight * c.x + uCamUp * c.y * iMore.y) * iPosSize.w;
  }
  vUv = corner; vParams = iParams; vColor = iColor; vMore = iMore; vPosSize = iPosSize; vWorld = wp;
  gl_Position = uViewProj * vec4(wp, 1.0);
  vT = length(wp - uCamPos);
  gl_Position.z = (clamp(vT / uFar, 0.0, 0.999) * 2.0 - 1.0) * gl_Position.w;
}
`;

const fxFS = () => glsl`
in vec2 vUv;
in float vT;
in vec3 vWorld;
flat in vec4 vParams, vColor, vMore, vPosSize;
layout(location = 0) out vec4 oColor;
uniform sampler2D uGbuf;
uniform vec2 uInvRes;
uniform vec3 uCamPos;
uniform float uTime, uDpr;
#include <common>
const vec3 FX_PAPER = vec3(0.910, 0.886, 0.831);
const vec3 FX_INK = vec3(0.384, 0.235, 0.118);
float gPx = 0.01;
vec2 gPx2 = vec2(0.01);
float pen(float d) { return 1.0 - smoothstep(1.1 * gPx, 2.1 * gPx, abs(d)); }
float body(float d) { return 1.0 - smoothstep(-gPx, gPx, d); }
vec4 mark(vec3 c, float a) { return vec4(c * a, a); }
vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }
float hatch(vec2 uv, float seed) {
  float s = dot(uv, vec2(-0.883, 0.469)) / (4.2 * gPx);
  return smoothstep(0.3, 0.5, 0.5 + 0.5 * sin(s * 6.2832)) * (0.75 + 0.25 * hash12(floor(uv / (2.0 * gPx)) + seed));
}
float wobbly(vec2 uv, float seed) {
  float a = atan(uv.y, uv.x);
  return length(uv) * (1.0 - 0.035 * sin(a * 3.0 + seed * 20.0) - 0.02 * sin(a * 7.0 + seed * 9.0));
}
${FX_TYPES.map((f) => f.glsl).join('\n')}
void main() {
  float sceneT = texture(uGbuf, gl_FragCoord.xy * uInvRes).z;
  float soft = saturate((sceneT - vT) * 1.6 + 0.7);
  vec2 uv = vUv;
  if (vMore.x > 0.5 && vMore.x < 1.5) {
    vec3 at = uCamPos + normalize(vWorld - uCamPos) * sceneT;
    vec2 d = at.xz - vPosSize.xz;
    if (abs(at.y - vPosSize.y) > 0.9 + 0.6 * length(d)) discard;
    float c = cos(vParams.w), s = sin(vParams.w);
    uv = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / (vPosSize.w * vec2(1.0, vMore.y));
    if (max(abs(uv.x), abs(uv.y)) > 1.0) discard;
    soft = 1.0;
  }
  if (soft <= 0.0) discard;
  gPx2 = min(fwidth(uv) * uDpr, vec2(0.12));
  gPx = min(length(gPx2) * 0.7, 0.09);
  float steps = max(vMore.z * 12.0, 2.0);
  float life = floor(vParams.y * steps) / steps;
  vec4 c = vec4(0.0);
  switch (int(vParams.x + 0.5)) {
${FX_TYPES.map((f) => `    case ${f.type}: c = fx_${f.id}(uv, life, vParams.z, vColor); break;`).join('\n')}
  }
  c *= step(0.5, soft);
  if (c.a < 0.01) discard;
  oColor = c;
}
`;

registerFx('mote', glsl`
vec4 fx_mote(vec2 uv, float life, float seed, vec4 col) {
  float show = step(0.08, life) * step(life, 0.92);
  return mark(col.rgb, body(length(uv) - 0.55) * show * min(col.a, 1.0) * 0.85);
}`);

registerFx('leaf', glsl`
vec4 fx_leaf(vec2 uv, float life, float seed, vec4 col) {
  float flip = cos(life * 22.0 + seed * 40.0);
  vec2 q = vec2(uv.x, uv.y / max(abs(flip), 0.25));
  float d = length(q * vec2(1.0, 1.9)) - 0.8;
  float show = step(0.05, life) * step(life, 0.95) * col.a;
  return over(mark(FX_INK, pen(d) * 0.7 * show), mark(mix(FX_PAPER, col.rgb, 0.85), body(d) * show));
}`);

registerFx('spark', glsl`
vec4 fx_spark(vec2 uv, float life, float seed, vec4 col) {
  vec2 a = abs(uv) / mix(1.0, 0.35, life);
  float d = min(a.x * 4.5 + a.y, a.y * 4.5 + a.x) - 0.95;
  return over(mark(FX_INK, pen(d) * 0.9), mark(mix(FX_PAPER, col.rgb, 0.55 * hatch(uv, seed)), body(d)));
}`);

registerFx('burst', glsl`
vec4 fx_burst(vec2 uv, float life, float seed, vec4 col) {
  float r = length(uv), ang = atan(uv.y, uv.x);
  float front = mix(0.4, 0.95, sqrt(life));
  float spike = abs(fract(ang * 1.4324 + seed) - 0.5) * 2.0;
  float d = r - front * mix(0.5, 1.0, spike);
  float rays = step(0.86, fract(ang * 2.2282 + seed * 3.0)) * step(front * 0.95, r) * step(r, front * 1.25 + 0.05);
  float show = step(life, 0.8);
  vec4 star = over(mark(FX_INK, pen(d)), mark(mix(FX_PAPER, col.rgb, 0.5 * hatch(uv, seed)), body(d)));
  return over(mark(FX_INK, rays * 0.9), star) * show;
}`);

registerFx('slash', glsl`
vec4 fx_slash(vec2 uv, float life, float seed, vec4 col) {
  float r = length(uv), ang = atan(uv.x, uv.y);
  float head = mix(1.9, -1.5, smoothstep(0.0, 0.55, life));
  float along = ang - head;
  float sweep = step(0.0, along) * step(along, 1.9);
  float taper = saturate(1.0 - along / 1.9);
  float outer = r - 0.97, inner = (0.97 - 0.3 * taper) - r;
  float d = max(outer, inner);
  float show = step(life, 0.72) * sweep;
  float lines = (pen(r - 0.8) + pen(r - 0.66)) * step(1.0, along) * step(along, 2.6) * step(life, 0.6) * 0.7;
  vec4 blade = over(mark(FX_INK, pen(d) * show), mark(mix(FX_PAPER, col.rgb, 0.35 * hatch(uv, seed)), body(d) * show));
  return over(blade, mark(FX_INK, lines));
}`);

registerFx('ring', glsl`
vec4 fx_ring(vec2 uv, float life, float seed, vec4 col) {
  float front = mix(0.25, 0.92, 1.0 - (1.0 - life) * (1.0 - life));
  float a = pen(wobbly(uv, seed) - front) + pen(wobbly(uv, seed + 0.37) - front * 0.94) * 0.6;
  return mark(col.rgb * 0.82, saturate(a) * step(life, 0.9) * min(col.a, 1.0));
}`);

registerFx('orb', glsl`
vec4 fx_orb(vec2 uv, float life, float seed, vec4 col) {
  float r = length(uv), ang = atan(uv.y, uv.x);
  float turn = floor(uTime * 12.0) * 0.7;
  float d = wobbly(uv, seed + turn * 0.1) - 0.55;
  float swirl = smoothstep(0.25, 0.1, abs(fract(r * 2.6 - ang / 6.2832 + turn * 0.3) - 0.5));
  float rays = step(0.8, fract(ang * 1.2732 + turn * 0.21)) * step(0.68, r) * step(r, 0.95);
  vec4 ball = over(mark(FX_INK, pen(d)), mark(mix(FX_PAPER, col.rgb, swirl * 0.9), body(d)));
  return over(ball, mark(col.rgb * 0.8, rays * 0.9));
}`);

registerFx('puff', glsl`
vec4 fx_puff(vec2 uv, float life, float seed, vec4 col) {
  float d = length(uv - vec2(0.0, 0.05)) - 0.5;
  d = min(d, length(uv - vec2(0.38, -0.1)) - 0.36);
  d = min(d, length(uv - vec2(-0.4, -0.08)) - 0.38);
  d += 0.5 * smoothstep(0.3, 1.0, life);
  float show = step(life, 0.9) * min(col.a * 1.6, 1.0);
  return over(mark(FX_INK, pen(d) * 0.8 * show), mark(mix(FX_PAPER, col.rgb, 0.3), body(d) * show));
}`);

registerFx('heal', glsl`
vec4 fx_heal(vec2 uv, float life, float seed, vec4 col) {
  vec2 a = abs(uv);
  float d = min(max(a.x - 0.22, a.y - 0.75), max(a.y - 0.22, a.x - 0.75));
  float show = step(0.08, life) * step(life, 0.85);
  return over(mark(FX_INK, pen(d) * show), mark(mix(FX_PAPER, col.rgb, 0.4 + 0.6 * hatch(uv, seed)), body(d) * show));
}`);

registerFx('mark', glsl`
vec4 fx_mark(vec2 uv, float life, float seed, vec4 col) {
  float ang = atan(uv.y, uv.x) + floor(uTime * 6.0) * 0.26;
  float dash = step(0.3, abs(fract(ang / 6.2832 * 5.0) - 0.5) * 2.0);
  float a = pen(wobbly(uv, seed) - 0.84) * dash + pen(wobbly(uv, seed + 0.5) - 0.7) * 0.35;
  return mark(col.rgb * 0.85, saturate(a) * min(col.a, 1.0));
}`);

registerFx('click', glsl`
vec4 fx_click(vec2 uv, float life, float seed, vec4 col) {
  float front = mix(0.9, 0.3, life);
  vec2 a = abs(uv);
  float m = pen(wobbly(uv, seed) - front) + pen(min(a.x, a.y)) * step(max(a.x, a.y), 0.16);
  return mark(FX_INK, saturate(m) * step(life, 0.85));
}`);

registerFx('beam', glsl`
vec4 fx_beam(vec2 uv, float life, float seed, vec4 col) {
  float wide = 0.42 * sin(saturate(life) * 3.1416);
  float d = abs(uv.x + 0.03 * sin(uv.y * 5.0 + seed * 9.0)) - wide;
  float within = step(-0.95, uv.y) * step(uv.y, 0.98);
  float rise = floor(uTime * 12.0) / 12.0;
  vec2 tk = vec2(uv.x * 3.0, uv.y * 2.2 - rise * 3.0);
  vec2 tc = floor(tk);
  float tick = step(0.6, hash12(tc + seed)) * pen((fract(tk.x) - 0.5) / 3.0) * step(abs(fract(tk.y) - 0.5), 0.3) * body(d);
  vec4 shaft = over(mark(FX_INK, pen(d) * 0.8 * within), mark(FX_PAPER, body(d) * within * 0.92));
  return over(mark(col.rgb * 0.85, tick * within), shaft);
}`);

registerFx('zone', glsl`
vec4 fx_zone(vec2 uv, float life, float seed, vec4 col) {
  float r = wobbly(uv, seed);
  float rim = pen(r - 0.93) + pen(wobbly(uv, seed + 0.37) - 0.88) * 0.5;
  float fill = body(r - 0.9 * mix(0.12, 1.0, life)) * hatch(uv, seed) * 0.5;
  return mark(col.rgb * 0.82, saturate(max(rim, fill)) * min(col.a, 1.0));
}`);

registerFx('lane', glsl`
vec4 fx_lane(vec2 uv, float life, float seed, vec4 col) {
  vec2 a = abs(uv);
  float sides = (1.0 - smoothstep(1.1 * gPx2.x, 2.1 * gPx2.x, abs(a.x - 0.9))) * step(a.y, 0.98)
              + (1.0 - smoothstep(1.1 * gPx2.y, 2.1 * gPx2.y, abs(a.y - 0.98))) * step(a.x, 0.9) * 0.6;
  float along = uv.y * 4.0 - 0.5;
  float v = fract(along) - 0.5;
  float arrows = pen(abs(uv.x) * 0.55 + v * 0.5 - 0.1) * step(a.x, 0.62) * 0.7;
  float fill = step(uv.y, mix(-1.0, 1.0, life)) * step(a.x, 0.9) * hatch(uv * vec2(1.0, 4.0), seed) * 0.42;
  return mark(col.rgb * 0.82, saturate(max(max(sides, arrows), fill)) * min(col.a, 1.0));
}`);

registerFx('cloud', glsl`
vec4 fx_cloud(vec2 uv, float life, float seed, vec4 col) {
  float ang = atan(uv.y, uv.x), r = length(uv);
  float turn = floor(uTime * 6.0) * 0.21;
  float edge = 0.86 + 0.07 * abs(sin(ang * 5.5 + seed * 9.0 + turn));
  float fade = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.82, 1.0, life));
  float rim = pen(r - edge);
  float fill = body(r - edge) * hatch(uv, seed + turn) * 0.34;
  vec2 g = uv * 5.0 + vec2(turn, -turn * 0.7);
  float specks = body(length(fract(g) - 0.5 - (hash22(floor(g) + seed) - 0.5) * 0.5) - 0.11) * body(r - edge) * step(0.55, hash12(floor(g) + seed * 3.0));
  return mark(col.rgb * 0.8, saturate(max(max(rim * 0.8, fill), specks * 0.8)) * fade * min(col.a, 1.0));
}`);

registerFx('streak', glsl`
vec4 fx_streak(vec2 uv, float life, float seed, vec4 col) {
  float along = smoothstep(-1.0, 0.2, uv.y) * (1.0 - smoothstep(0.7, 1.0, uv.y));
  float lines = pen(uv.x * 1.6) + pen(uv.x * 1.6 - 0.32 - 0.1 * seed) * 0.5 * step(0.0, -uv.y);
  return mark(mix(FX_INK, col.rgb, 0.4), saturate(lines) * along * (1.0 - life) * min(col.a, 1.0));
}`);

registerFx('ripple', glsl`
vec4 fx_ripple(vec2 uv, float life, float seed, vec4 col) {
  float front = mix(0.2, 0.9, life);
  return mark(vec3(0.227, 0.502, 0.659), pen(wobbly(uv, seed) - front) * step(life, 0.85) * min(col.a, 1.0));
}`);

registerFx('laser', glsl`
vec4 fx_laser(vec2 uv, float life, float seed, vec4 col) {
  float w = mix(1.0, 0.18, smoothstep(0.3, 1.0, life));
  float ends = smoothstep(1.0, 0.82, abs(uv.y));
  float x = abs(uv.x + 0.05 * sin(uv.y * 31.0 - uTime * 40.0 + seed * 17.0) * w);
  float bands = 0.5 + 0.5 * sin(uv.y * 18.0 - uTime * 30.0 + seed * 5.0);
  float rim = 0.95 * w * ends, mid = 0.55 * w * ends, core = 0.22 * w * ends;
  vec4 c = mark(col.rgb * 0.75, body(x - rim) * hatch(uv * vec2(1.0, 5.0), seed) * 0.6);
  c = over(mark(mix(col.rgb, vec3(1.0), 0.15 + 0.3 * bands), body(x - mid)), c);
  c = over(mark(vec3(1.0), body(x - core)), c);
  c = over(mark(FX_INK, pen(x - mid) * 0.7), c);
  return c * min(col.a, 1.0);
}`);

registerFx('arc', glsl`
vec4 fx_arc(vec2 uv, float life, float seed, vec4 col) {
  float flick = floor(uTime * 20.0 + seed * 7.0);
  float k = (uv.y + 1.0) * 5.0;
  float i = floor(k), f = fract(k);
  float a = hash12(vec2(i, flick + seed * 13.0)) - 0.5, b = hash12(vec2(i + 1.0, flick + seed * 13.0)) - 0.5;
  float x = abs(uv.x - mix(a, b, f) * 1.1 * smoothstep(1.0, 0.7, abs(uv.y)));
  float fade = 1.0 - smoothstep(0.55, 1.0, life);
  vec4 c = mark(col.rgb * 0.75, body(x - 0.42) * hatch(uv * vec2(1.0, 4.0), seed) * 0.5);
  c = over(mark(mix(col.rgb, vec3(1.0), 0.55), body(x - 0.15)), c);
  c = over(mark(FX_INK, pen(x - 0.15) * 0.8), c);
  return c * fade * step(abs(uv.y), 0.99) * min(col.a, 1.0);
}`);

registerFx('sigil', glsl`
float sgTri(vec2 p, float r) {
  float d = -1e3;
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 2.0944 + 1.5708;
    d = max(d, dot(p, vec2(cos(a), sin(a))));
  }
  return d - r;
}
vec4 fx_sigil(vec2 uv, float life, float seed, vec4 col) {
  float r = length(uv), ang = atan(uv.y, uv.x);
  float spin = uTime * 0.9 + seed * 6.2832;
  float grow = smoothstep(0.0, 0.16, life), fade = 1.0 - smoothstep(0.84, 1.0, life);
  float s = mix(0.55, 1.0, grow);
  float rings = pen(r - 0.95 * s) + pen(r - 0.87 * s) * 0.8 + pen(r - 0.3 * s) * 0.7;
  float ticks = step(0.55, fract((ang + spin) / 6.2832 * 36.0)) * step(0.87 * s, r) * step(r, 0.95 * s) * 0.85;
  float dashes = pen(r - 0.62 * s) * step(0.4, fract((ang - spin * 1.7) / 6.2832 * 10.0));
  float hexa = max(pen(sgTri(rot2(spin * 0.6) * uv, 0.3 * s)), pen(sgTri(rot2(spin * 0.6 + 1.0472) * uv, 0.3 * s))) * step(r, 0.62 * s);
  float fill = body(r - 0.95 * s) * hatch(uv, seed) * 0.22;
  return mark(mix(col.rgb, vec3(1.0), 0.15), saturate(rings + ticks + dashes + hexa + fill) * grow * fade * min(col.a, 1.0));
}`);

registerFx('vortex', glsl`
vec4 fx_vortex(vec2 uv, float life, float seed, vec4 col) {
  float r = length(uv), ang = atan(uv.y, uv.x);
  float grow = smoothstep(0.0, 0.14, life), fade = 1.0 - smoothstep(0.86, 1.0, life);
  float sw = ang * 3.0 + 7.0 / (r + 0.25) + uTime * 9.0 + seed * 6.0;
  float arms = smoothstep(0.35, 0.8, 0.5 + 0.5 * sin(sw)) * smoothstep(1.0, 0.6, r) * smoothstep(0.08, 0.3, r);
  float lines = pen((fract(sw / 6.2832) - 0.5) * 0.25 * r) * smoothstep(1.0, 0.5, r) * step(0.15, r);
  float rim = pen(wobbly(uv, seed) - 0.95 * grow);
  vec4 c = mark(col.rgb * 0.85, saturate(arms * (0.35 + 0.65 * hatch(uv * 1.5, seed)) + rim));
  c = over(mark(FX_INK, saturate(lines * 0.8)), c);
  c = over(mark(vec3(0.06, 0.04, 0.1), body(r - 0.2 * grow)), c);
  return c * grow * fade * min(col.a, 1.0);
}`);

registerFx('hex', glsl`
vec4 fx_hex(vec2 uv, float life, float seed, vec4 col) {
  float r = length(uv);
  float grow = smoothstep(0.0, 0.1, life), fade = 1.0 - smoothstep(0.88, 1.0, life);
  vec2 g = uv * 4.5 + vec2(0.0, uTime * 0.6);
  vec2 hs = vec2(1.0, 1.7320508);
  vec2 a = mod(g, hs) - hs * 0.5, b = mod(g - hs * 0.5, hs) - hs * 0.5;
  vec2 h = abs(dot(a, a) < dot(b, b) ? a : b);
  float edge = 0.5 - max(dot(h, vec2(0.5, 0.8660254)), h.x);
  float inside = body(r - 0.95);
  float fres = smoothstep(0.4, 0.95, r) * inside;
  float cells = (1.0 - smoothstep(0.0, 0.07, edge)) * inside;
  vec4 c = mark(mix(col.rgb, vec3(1.0), 0.25), saturate(cells * (0.3 + 0.7 * fres) + fres * 0.35 * hatch(uv, seed)));
  c = over(mark(FX_INK, pen(r - 0.95) * 0.8), c);
  return c * grow * fade * min(col.a, 1.0);
}`);

registerFx('bit', glsl`
vec4 fx_bit(vec2 uv, float life, float seed, vec4 col) {
  vec2 a = abs(uv);
  float d = max(a.x, a.y) - 0.62;
  float show = step(life, 0.92) * step(0.22, hash12(vec2(seed * 91.0, floor(uTime * 14.0))));
  vec4 c = mark(mix(col.rgb, vec3(1.0), 0.35 * step(max(a.x, a.y), 0.28)), body(d));
  c = over(mark(FX_INK, pen(d) * 0.8), c);
  return c * show * min(col.a, 1.0);
}`);

registerFx('shock', glsl`
vec4 fx_shock(vec2 uv, float life, float seed, vec4 col) {
  float r = wobbly(uv, seed);
  float front = mix(0.15, 0.95, 1.0 - pow(1.0 - life, 3.0));
  float d = abs(r - front) - (0.12 * (1.0 - life) + 0.02);
  float ang = atan(uv.y, uv.x);
  float streaks = step(0.7, fract(ang / 6.2832 * 28.0 + seed)) * step(r, front) * step(front * 0.55, r) * (1.0 - life) * 0.8;
  vec4 c = mark(mix(col.rgb, vec3(1.0), 0.3), body(d) * (0.4 + 0.5 * hatch(uv, seed)));
  c = over(mark(FX_INK, pen(d) * 0.85), c);
  c = over(mark(col.rgb * 0.8, streaks), c);
  return c * step(life, 0.95) * min(col.a, 1.0);
}`);

export class FxPass {
  constructor(gl) {
    this.gl = gl;
    this.compiled = null;
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    this.capacity = 0;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    for (let i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, FX_FLOATS * 4, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
  }

  program() {
    return this.compiled || (this.compiled = new Program(this.gl, 'fx', FX_VS, fxFS()));
  }

  render(target, frame, data, count, sceneGbuf) {
    if (!count) return;
    const gl = this.gl;
    const p = this.program().use();
    target.bind(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const cam = frame.camera;
    p.set('uViewProj', cam.viewProj).set('uCamPos', cam.pos).set('uCamRight', cam.right).set('uCamUp', cam.up);
    p.set('uFar', frame.far).set('uTime', frame.time).set('uInvRes', [1 / target.width, 1 / target.height]).set('uDpr', frame.dpr);
    p.tex('uGbuf', sceneGbuf);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const bytes = count * FX_FLOATS * 4;
    if (bytes > this.capacity) {
      this.capacity = bytes * 2;
      gl.bufferData(gl.ARRAY_BUFFER, this.capacity, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * FX_FLOATS);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }
}
