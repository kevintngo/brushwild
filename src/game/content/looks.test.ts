import { describe, expect, it } from 'vitest';
import { BEARDS, HAIRS, SKINS, STYLES, TUNICS, appearanceBits, cleanLook, lookFromPhoto, type Look } from './looks';

const base: Look = { tunic: 0, hair: 0 };

describe('lookFromPhoto', () => {
  it('maps what the vision model sees onto the hero', () => {
    const look = lookFromPhoto(base, { hair: 'Red', hairStyle: 'long', skin: 'fair', glasses: true, beard: 'none', colour: 'orange' });
    expect(HAIRS[look.hair].name).toBe('Copper');
    expect(STYLES[look.style!]).toBe('Long');
    expect(SKINS[look.skin!].name).toBe('Fair');
    expect(BEARDS[look.beard!]).toBe('No beard');
    expect(TUNICS[look.tunic].name).toBe('Ochre');
    expect(look.glasses).toBe(true);
  });

  it('keeps the current look for anything it does not recognise', () => {
    const look = lookFromPhoto({ tunic: 5, hair: 2, skin: 4 }, { hair: 'plaid', skin: '', colour: 'chartreuse' });
    expect(look).toEqual({ tunic: 5, hair: 2, skin: 4 });
  });

  it('reads no hair as bald', () => {
    expect(STYLES[lookFromPhoto(base, { hair: 'none' }).style!]).toBe('Bald');
  });
});

describe('cleanLook', () => {
  it('drops out-of-range values and anything that is not a drawing', () => {
    const look = cleanLook({ tunic: 99, hair: 1.5, skin: 3, style: -1, beard: 2, glasses: 'yes', portrait: 'https://example.com/x.jpg' });
    expect(look).toEqual({ tunic: 0, hair: 0, skin: 3, beard: 2 });
  });

  it('keeps a small drawn portrait', () => {
    expect(cleanLook({ tunic: 1, hair: 1, portrait: 'data:image/jpeg;base64,AAAA' })?.portrait).toBe('data:image/jpeg;base64,AAAA');
  });

  it('returns nothing for a missing look', () => {
    expect(cleanLook(undefined)).toBeUndefined();
  });
});

describe('appearanceBits', () => {
  it('packs every field into its own bits above the gear flags and the face', () => {
    const bits = appearanceBits({ tunic: 0, hair: 0, skin: 6, style: 5, beard: 2, glasses: true });
    expect(bits % 64).toBe(0);
    expect(Math.floor(bits / 64) % 8).toBe(6);
    expect(Math.floor(bits / 512) % 8).toBe(5);
    expect(Math.floor(bits / 4096) % 4).toBe(2);
    expect(Math.floor(bits / 16384) % 2).toBe(1);
  });
});
