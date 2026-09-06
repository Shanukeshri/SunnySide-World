/**
 * Centralized Pseudo-Random Number Generator (PRNG) for Entity AI and Lifeform Systems.
 * Ensures all decisions (spawns, group sizes, idle times, wander vectors, eating)
 * are channeled through generateRandom(id), supporting deterministic simulation.
 */

// Global state / seed for the PRNG system
let globalRngSeed: number = 1337420;
const entitySeeds = new Map<number, number>();

/**
 * Sets the master seed for the lifeform simulation PRNG.
 */
export function setGlobalRngSeed(seed: number): void {
  globalRngSeed = Math.floor(Math.abs(seed)) || 1;
  entitySeeds.clear();
}

/**
 * Mulberry32 32-bit PRNG step
 */
function mulberry32(state: number): [number, number] {
  let t = (state + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [result, (state + 1) | 0];
}

/**
 * 2. generateRandom(id)
 * Centralized random generation function.
 * Every random decision in the NPC/wildlife system must go through this.
 * id === 0 is reserved for global/spawner events.
 * id > 0 tracks individual entity PRNG streams for consistency.
 */
export function generateRandom(id: number): number {
  const currentSeed = entitySeeds.get(id) ?? (globalRngSeed ^ Math.imul(id + 1, 2654435761));
  const [val, nextSeed] = mulberry32(currentSeed);
  entitySeeds.set(id, nextSeed);
  return val;
}

/**
 * Utility: Random float in range [min, max) using entity's PRNG stream.
 */
export function randomRange(id: number, min: number, max: number): number {
  return min + generateRandom(id) * (max - min);
}

/**
 * Utility: Random integer in range [min, max] inclusive.
 */
export function randomInt(id: number, min: number, max: number): number {
  return Math.floor(randomRange(id, min, max + 1));
}

/**
 * Utility: Random choice from an array.
 */
export function randomChoice<T>(id: number, items: readonly T[] | T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from empty array');
  }
  const idx = Math.floor(generateRandom(id) * items.length);
  return items[idx];
}

/**
 * Utility: Return true with probability p (0 <= p <= 1).
 */
export function randomChance(id: number, probability: number): boolean {
  return generateRandom(id) < probability;
}

/**
 * Cleans up entity seed when an entity despawns or is removed.
 */
export function removeEntitySeed(id: number): void {
  entitySeeds.delete(id);
}
