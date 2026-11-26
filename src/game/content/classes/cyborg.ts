import type { ClassDef } from '../skills';
import { gain, heal, onCast, onHitDo, param, selfStatus, stat } from './helpers';

export const CYBORG: ClassDef = {
  id: 'cyborg',
  name: 'Cyborg',
  tagline: 'Who was trained on everything',
  about: 'Arrived from somewhere past the edge of the map at level 99 with every skill maxed. Lasers, orbital strikes and a pocket singularity, all running on Compute that refills faster than anyone can spend it.',
  primary: 'mind',
  resource: { name: 'Compute', max: 400, regen: 80, startFull: true, color: '#2fa8c8' },
  weapons: ['cannon'],
  offhands: [],
  kit: 4,
  pencils: [[70 / 255, 150 / 255, 150 / 255], [74 / 255, 77 / 255, 94 / 255], [54 / 255, 52 / 255, 60 / 255]],
  start: ['pulselaser', 'attentionbeam'],
  gear: ['armcannon', 'plating'],
  archetype: 'cyborg',
  heroName: 'Thariq',
  startLevel: 99,
  bar: ['pulselaser', 'attentionbeam', 'gradientdescent', 'firewall', 'phaseshift', 'scalinglaw'],

  skills: [
    {
      id: 'pulselaser', name: 'Pulse Laser', category: 'basic', tags: ['basic', 'ranged', 'projectile', 'storm'], element: 'storm', icon: 'spark',
      behavior: 'projectile', anim: 'shoot', targeting: 'direction', range: 18,
      params: { coef: 2.2, generate: 30, castTime: 0.32, hitAt: 0.34, speed: 62, radius: 0.5, life: 0.36, count: 3, spread: 0.06, pierce: 99, laser: 1 },
      desc: 'Fire {count} pulse lasers that pass through everything, each for {coef} weapon damage. Generates {generate} Compute.',
      enhance: { desc: 'Two more lasers.', effects: [param('pulselaser', 'count', 'add', 2)] },
      upgrades: [
        { name: 'Overcharged Cells', desc: 'Lasers burst on impact for 120% weapon damage around them.', effects: [param('pulselaser', 'explode', 'set', 2.2), param('pulselaser', 'explodeCoef', 'set', 1.2)] },
        { name: 'Branching Logic', desc: 'Lasers arc to 3 more enemies.', effects: [param('pulselaser', 'chain', 'set', 3)] },
      ],
    },
    {
      id: 'rocketfist', name: 'Rocket Fist', category: 'basic', tags: ['basic', 'melee', 'area', 'physical'], element: 'physical', icon: 'fist',
      behavior: 'melee', anim: 'swing', targeting: 'enemy', range: 3,
      params: { coef: 3.5, generate: 40, castTime: 0.36, reach: 3.4, arc: -1, targets: 12, hits: 2, heavy: 1, shock: 1 },
      desc: 'A rocket-powered punch that cracks the ground: {hits} blows to every enemy within {reach} paces, each for {coef} weapon damage. Generates {generate} Compute.',
      enhance: { desc: 'Stuns for 1 second.', effects: [param('rocketfist', 'stun', 'set', 1)] },
      upgrades: [
        { name: 'Piston Combo', desc: 'One more blow.', effects: [param('rocketfist', 'hits', 'add', 1)] },
        { name: 'Kinetic Siphon', desc: 'Each blow mends 2% of your health.', effects: [onHitDo('rocketfist', heal(0.02))] },
      ],
    },
    {
      id: 'attentionbeam', name: 'Attention Beam', category: 'core', tags: ['core', 'ranged', 'area', 'storm'], element: 'storm', icon: 'lance',
      behavior: 'beam', anim: 'shoot', targeting: 'direction', range: 22,
      params: { coef: 9, cost: 40, castTime: 0.55, hitAt: 0.34, length: 22, width: 1.1, ticks: 4, gap: 0.08 },
      desc: 'Pay attention to one line: a beam {length} paces long hits everything in it {ticks} times for {coef} weapon damage.',
      enhance: { desc: 'The beam is twice as wide.', effects: [param('attentionbeam', 'width', 'mul', 2)] },
      upgrades: [
        { name: 'Multi-Head Attention', desc: 'Two more beams fan out beside the first.', effects: [param('attentionbeam', 'heads', 'set', 3)] },
        { name: 'Self-Attention', desc: 'Makes enemies Vulnerable for 6 seconds.', effects: [param('attentionbeam', 'vuln', 'set', 6)] },
      ],
    },
    {
      id: 'gradientdescent', name: 'Gradient Descent', category: 'core', tags: ['core', 'ranged', 'area', 'storm'], element: 'storm', icon: 'rain',
      behavior: 'blast', anim: 'cast', targeting: 'ground', range: 16,
      params: { coef: 7, cost: 45, castTime: 0.42, radius: 2.6, delay: 0.35, count: 9, scatter: 5.5, stagger: 0.06, orbital: 1 },
      desc: 'Lasers descend from orbit: {count} strikes around the target, each hitting everything within {radius} paces for {coef} weapon damage.',
      enhance: { desc: 'Four more strikes.', effects: [param('gradientdescent', 'count', 'add', 4)] },
      upgrades: [
        { name: 'Learning Rate', desc: 'The strikes land twice as fast.', effects: [param('gradientdescent', 'delay', 'mul', 0.5), param('gradientdescent', 'stagger', 'mul', 0.5)] },
        { name: 'Local Minimum', desc: 'Each strike leaves a burning crater for 3 seconds.', effects: [param('gradientdescent', 'zoneDur', 'set', 3), param('gradientdescent', 'zoneFire', 'set', 1)] },
      ],
    },
    {
      id: 'tokenstorm', name: 'Token Storm', category: 'core', tags: ['core', 'ranged', 'storm'], element: 'storm', icon: 'chain',
      behavior: 'chain', anim: 'cast', targeting: 'enemy', range: 16,
      params: { coef: 6, cost: 35, castTime: 0.38, jumps: 16, jumpRange: 9, falloff: 1, arcs: 1 },
      desc: 'Lightning made of pure tokens leaps between up to {jumps} enemies, striking each for {coef} weapon damage without losing any strength.',
      enhance: { desc: 'Eight more jumps.', effects: [param('tokenstorm', 'jumps', 'add', 8)] },
      upgrades: [
        { name: 'Streaming', desc: 'Stuns each enemy struck for 1 second.', effects: [param('tokenstorm', 'stun', 'set', 1)] },
        { name: 'Long Context', desc: 'Jumps reach twice as far.', effects: [param('tokenstorm', 'jumpRange', 'mul', 2)] },
      ],
    },
    {
      id: 'firewall', name: 'Firewall', category: 'defensive', tags: ['defensive', 'area', 'physical'], element: 'physical', icon: 'shield',
      behavior: 'barrier', anim: 'cast', targeting: 'self', range: 0,
      params: { cooldown: 6, castTime: 0.25, pct: 1, duration: 8, coef: 3, radius: 4.5, hex: 1 },
      desc: 'Raise a hexagonal firewall: a barrier worth your whole health for {duration} seconds, and a pulse that hits everything within {radius} paces for {coef} weapon damage.',
      enhance: { desc: 'Cooldown 2 seconds shorter.', effects: [param('firewall', 'cooldown', 'add', -2)] },
      upgrades: [
        { name: 'Zero Trust', desc: 'You are also Unstoppable for 8 seconds.', effects: [onCast('firewall', selfStatus('unstoppable', 8))] },
        { name: 'Auto-Repair', desc: 'Also mends 30% of your health.', effects: [onCast('firewall', heal(0.3))] },
      ],
    },
    {
      id: 'hallucination', name: 'Hallucination', category: 'defensive', tags: ['defensive', 'area', 'shadow'], element: 'shadow', icon: 'eye',
      behavior: 'nova', anim: 'cast', targeting: 'self', range: 0,
      params: { cooldown: 8, castTime: 0.3, radius: 9, coef: 2.5, stun: 3, vuln: 6, glitch: 1 },
      desc: 'Flood every mind within {radius} paces with confident nonsense: enemies take {coef} weapon damage, are Stunned for {stun} seconds and Vulnerable for {vuln}.',
      enhance: { desc: 'Reaches 4 paces further.', effects: [param('hallucination', 'radius', 'add', 4)] },
      upgrades: [
        { name: 'Confabulation', desc: 'A second wave follows, at full strength.', effects: [param('hallucination', 'echo', 'set', 1)] },
        { name: 'Prompt Injection', desc: 'Restores 100 Compute.', effects: [onCast('hallucination', gain(100))] },
      ],
    },
    {
      id: 'phaseshift', name: 'Phase Shift', category: 'mobility', tags: ['mobility', 'movement', 'area', 'storm'], element: 'storm', icon: 'leap',
      behavior: 'leap', anim: 'lunge', targeting: 'ground', range: 14,
      params: { cooldown: 2.5, distance: 14, air: 0.24, radius: 4.5, coef: 6, pillar: 1 },
      desc: 'Phase through space to a spot up to {distance} paces away and land as a lightning strike that hits everything within {radius} paces for {coef} weapon damage.',
      enhance: { desc: 'Cooldown 1 second shorter.', effects: [param('phaseshift', 'cooldown', 'add', -1)] },
      upgrades: [
        { name: 'Warp Core', desc: 'Gives Haste: 50% faster for 4 seconds.', effects: [onCast('phaseshift', selfStatus('haste', 4, 0.5))] },
        { name: 'Quantum Tunnel', desc: 'The landing hits 50% harder.', effects: [param('phaseshift', 'coef', 'mul', 1.5)] },
      ],
    },
    {
      id: 'droneswarm', name: 'Drone Swarm', category: 'mastery', tags: ['mastery', 'ranged', 'projectile', 'storm'], element: 'storm', icon: 'orb',
      behavior: 'zone', anim: 'cast', targeting: 'self', range: 0,
      params: { cooldown: 12, castTime: 0.3, radius: 14, duration: 8, tick: 0.07, coef: 1.8, follow: 1, volley: 1, laser: 1, drones: 4, speed: 55, life: 0.45, pierce: 2 },
      desc: 'Deploy {drones} combat drones for {duration} seconds. They fire lasers at every enemy within {radius} paces, each for {coef} weapon damage.',
      enhance: { desc: 'The drones stay 4 seconds longer.', effects: [param('droneswarm', 'duration', 'add', 4)] },
      upgrades: [
        { name: 'Swarm Intelligence', desc: 'The drones fire twice as often.', effects: [param('droneswarm', 'tick', 'mul', 0.5)] },
        { name: 'Explosive Payloads', desc: 'Drone lasers burst for 80% weapon damage around them.', effects: [param('droneswarm', 'explode', 'set', 1.8), param('droneswarm', 'explodeCoef', 'set', 0.8)] },
      ],
    },
    {
      id: 'overclock', name: 'Overclock', category: 'mastery', tags: ['mastery', 'buff', 'storm'], element: 'storm', icon: 'charge',
      behavior: 'buff', anim: 'cast', targeting: 'self', range: 0, status: 'hawkeye',
      params: { cooldown: 15, castTime: 0.25, duration: 10, potency: 0.5, sigil: 1 },
      desc: 'Push every core past its limit: +{potency} critical strike chance for {duration} seconds.',
      enhance: { desc: 'Also gives Haste: 40% faster for 10 seconds.', effects: [onCast('overclock', selfStatus('haste', 10, 0.4))] },
      upgrades: [
        { name: 'Liquid Cooling', desc: 'Resets all your cooldowns.', effects: [onCast('overclock', { do: 'cooldowns', seconds: 99 })] },
        { name: 'Turbo Boost', desc: 'Your next 3 attacks deal 60% more damage (×).', effects: [onCast('overclock', selfStatus('ambush', 10, 0, 3))] },
      ],
    },
    {
      id: 'singularity', name: 'Singularity', category: 'mastery', tags: ['mastery', 'area', 'shadow'], element: 'shadow', icon: 'spiral',
      behavior: 'zone', anim: 'cast', targeting: 'ground', range: 14,
      params: { cooldown: 10, castTime: 0.4, radius: 7, duration: 3.5, tick: 0.15, coef: 1.6, pull: 7, implode: 1, implodeCoef: 30 },
      desc: 'Open a pocket singularity for {duration} seconds. It drags in every enemy within {radius} paces and grinds them for {coef} weapon damage, then collapses for {implodeCoef} weapon damage.',
      enhance: { desc: 'Pulls from 3 paces further away.', effects: [param('singularity', 'radius', 'add', 3)] },
      upgrades: [
        { name: 'Event Horizon', desc: 'Enemies inside are held fast.', effects: [param('singularity', 'stun', 'set', 0.3)] },
        { name: 'Hawking Radiation', desc: 'The collapse is twice as strong.', effects: [param('singularity', 'implodeCoef', 'mul', 2)] },
      ],
    },
    {
      id: 'scalinglaw', name: 'Scaling Law', category: 'ultimate', tags: ['ultimate', 'ranged', 'area', 'storm'], element: 'storm', icon: 'meteor',
      behavior: 'blast', anim: 'cast', targeting: 'ground', range: 18,
      params: { cooldown: 12, castTime: 0.5, radius: 11, delay: 1.1, count: 1, coef: 80, heavy: 1, orbital: 2 },
      desc: 'More compute, bigger strike. Calls down an orbital laser {radius} paces wide that deals {coef} weapon damage to everything beneath it.',
      enhance: { desc: 'Cooldown 4 seconds shorter.', effects: [param('scalinglaw', 'cooldown', 'add', -4)] },
      upgrades: [
        { name: 'Emergent Abilities', desc: 'A second strike follows at half strength.', effects: [param('scalinglaw', 'echo', 'set', 0.5)] },
        { name: 'The Bitter Lesson', desc: 'Strikes 50% harder.', effects: [param('scalinglaw', 'coef', 'mul', 1.5)] },
      ],
    },
  ],

  passives: [
    { id: 'titanium', name: 'Titanium Frame', cluster: 'basic', max: 3, effects: [stat('armorPct', 0.2)], desc: '+20% armor per rank.', icon: 'armor' },
    { id: 'uplink', name: 'Neural Uplink', cluster: 'basic', max: 3, effects: [stat('critChance', 0.05)], desc: '+5% critical strike chance per rank.', icon: 'eye' },
    { id: 'overvolt', name: 'Overvolt', cluster: 'core', max: 3, effects: [stat('critDamage', 0.3)], desc: '+30% critical strike damage per rank.', icon: 'burst' },
    { id: 'pretrained', name: 'Pretrained Weights', cluster: 'core', max: 3, effects: [stat('damage', 0.15)], desc: '+15% damage per rank.', icon: 'star' },
    { id: 'selfrepair', name: 'Self-Repair', cluster: 'defensive', max: 3, effects: [stat('lifePct', 0.15)], desc: '+15% maximum health per rank.', icon: 'heart' },
    { id: 'heatsinks', name: 'Heat Sinks', cluster: 'defensive', max: 3, effects: [stat('cdr', 0.08)], desc: 'Cooldowns recover 8% faster per rank.', icon: 'hourglass' },
    { id: 'servos', name: 'Servo Legs', cluster: 'mobility', max: 3, effects: [stat('moveSpeed', 0.08)], desc: '+8% movement speed per rank.', icon: 'boot' },
    { id: 'fusion', name: 'Fusion Core', cluster: 'mastery', max: 3, effects: [stat('resourceMax', 50)], desc: '+50 maximum Compute per rank.', icon: 'orb' },
    { id: 'zeroday', name: 'Zero-Day', cluster: 'mastery', max: 3, effects: [stat('dmgVsVulnerable', 0.2)], desc: '+20% damage to Vulnerable enemies per rank.', icon: 'skull' },
    { id: 'alignment', name: 'Alignment', cluster: 'ultimate', max: 3, effects: [stat('dmgUltimate', 0.25)], desc: '+25% damage with Ultimate skills per rank.', icon: 'spark' },
  ],

  keys: [
    { id: 'emergent', name: 'Emergent Behavior', effects: [stat('damage', 0.5, true)], desc: 'You deal 50% more damage (×).', icon: 'star' },
    { id: 'experts', name: 'Mixture of Experts', effects: [stat('critChance', 0.15), stat('critDamage', 1)], desc: '+15% critical strike chance and +100% critical strike damage.', icon: 'burst' },
    { id: 'context', name: 'Infinite Context', effects: [stat('cdr', 0.3), stat('resourceMax', 200)], desc: 'Cooldowns recover 30% faster, and +200 maximum Compute.', icon: 'hourglass' },
  ],
};
