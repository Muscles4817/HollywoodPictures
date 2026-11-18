// A keyed roll for prep: a uniform number from a string key, the same key
// always giving the same number, without drawing from any shared stream.
//
// random.ts:hashUnit alone is FNV-1a with no final mixing, so keys that differ
// only in their last characters (a problem's day 10, 11, 12 ...) land within
// about 1/256 of each other - a problem's daily rolls were nearly one number,
// found on its first eligible day or never (Phase 4 review). Seeding mulberry32
// with the hash and taking its first output mixes the bits properly.
import { createRng, hashUnit } from '../random';

export function keyedRoll(key: string): number {
  return createRng(Math.floor(hashUnit(key) * 4294967296))();
}
