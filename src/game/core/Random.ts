/**
 * Random.ts - Server-owned Deterministic PRNG
 * 
 * Implements Section 6 of authoritative_server.txt:
 * All random decisions (entity AI, drops, spawns, wander vectors) are channeled
 * through generateRandom(entityId) on the server.
 */

let masterSeed: number = 42891;
const entityStreams = new Map<number, number>();

/**
 * Sets the master seed for the server simulation PRNG.
 */
export function setMasterSeed(seed: number): void {
  masterSeed = Math.floor(Math.abs(seed)) || 1;
  entityStreams.clear();
}

export function getMasterSeed(): number {
  return masterSeed;
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
 * generateRandom(entityId)
 * Centralized server-owned random generation function.
 * id === 0 is reserved for global world/spawner events.
 * id > 0 tracks individual entity PRNG streams for consistency and isolation.
 */
export function generateRandom(entityId: number): number {
  const currentSeed =
    entityStreams.get(entityId) ??
    (masterSeed ^ Math.imul(entityId + 1, 2654435761));
  const [val, nextSeed] = mulberry32(currentSeed);
  entityStreams.set(entityId, nextSeed);
  return val;
}

export function randomRange(entityId: number, min: number, max: number): number {
  return min + generateRandom(entityId) * (max - min);
}

export function randomInt(entityId: number, min: number, max: number): number {
  return Math.floor(randomRange(entityId, min, max + 1));
}

export function randomChoice<T>(entityId: number, items: readonly T[] | T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from empty array");
  }
  const idx = Math.floor(generateRandom(entityId) * items.length);
  return items[idx];
}

export function randomChance(entityId: number, probability: number): boolean {
  return generateRandom(entityId) < probability;
}

export function removeEntityStream(entityId: number): void {
  entityStreams.delete(entityId);
}
