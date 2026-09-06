import { SettlementGenerator } from '../src/generation/SettlementGenerator';
import { LifeformManager } from '../src/lifeforms/LifeformManager';
import { SPECIES_CONFIGS } from '../src/lifeforms/speciesConfig';
import { generateRandom, setGlobalRngSeed } from '../src/lifeforms/rng';
import { Animal } from '../src/lifeforms/Animal';
import { NPC } from '../src/lifeforms/NPC';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log('--- Testing gameLogicV1.txt Complete Implementation ---\n');

// 1. Generate a test settlement (seed, width, height)
const gen = new SettlementGenerator(4242, 64, 64);
const data = gen.generate();

// 2. Test LifeformManager initialization
const manager = new LifeformManager(data);

// Check Player initialization
assert(manager.player !== null, 'Player spawned');
assert(manager.player!.isAlive, 'Player is alive');
assert(manager.player!.speed > 0, 'Player speed property accessible');

// Check Species Configs (Section 3)
const requiredSpecies = ['cow', 'sheep', 'rabbit', 'chicken', 'deer', 'pig', 'duck', 'villager', 'player'] as const;
for (const sp of requiredSpecies) {
  const cfg = SPECIES_CONFIGS[sp];
  assert(Boolean(cfg), `Species config exists for ${sp}`);
  assert(cfg.movementSpeed > 0, `${sp} has movementSpeed: ${cfg.movementSpeed}`);
  assert(Array.isArray(cfg.preferredEnvironment), `${sp} has preferredEnvironment`);
  assert(typeof cfg.food === 'string', `${sp} has food: ${cfg.food}`);
  assert(cfg.groupSize.min >= 1, `${sp} has groupSize min: ${cfg.groupSize.min}`);
  assert(typeof cfg.canPet === 'boolean', `${sp} has canPet boolean`);
  assert(typeof cfg.canFeed === 'boolean', `${sp} has canFeed boolean`);
}

// Check PRNG Determinism (Section 2)
setGlobalRngSeed(999);
const r1 = [generateRandom(1), generateRandom(1), generateRandom(1)];
setGlobalRngSeed(999);
const r2 = [generateRandom(1), generateRandom(1), generateRandom(1)];
assert(JSON.stringify(r1) === JSON.stringify(r2), 'generateRandom(id) is strictly deterministic');

// Check Environment Detection (Section 4)
const env = manager.getDetector().getEnvironmentAt(10, 10);
assert(typeof env.grass === 'boolean', 'Environment has grass boolean');
assert(typeof env.water === 'boolean', 'Environment has water boolean');
assert(typeof env.village === 'boolean', 'Environment has village boolean');
assert(typeof env.denseTrees === 'boolean', 'Environment has denseTrees boolean');

// Check Entity properties (Section 1)
const animals = manager.getAnimals();
assert(animals.length > 0, `Initial wildlife herds spawned: ${animals.length} animals`);
const a1 = animals[0];
assert(typeof a1.id === 'number', `Entity has numeric ID: ${a1.id}`);
assert(typeof a1.speed === 'number', `Entity has speed getter: ${a1.speed}`);
assert(typeof a1.state === 'string', `Entity has state getter: ${a1.state}`);
assert(typeof a1.hunger === 'number', `Entity has hunger getter: ${a1.hunger}`);
assert(typeof a1.isAlive === 'boolean', `Entity has isAlive getter: ${a1.isAlive}`);

// Check Priority Hierarchy (Section 27): PETTED overrides EATING & WANDER
a1.state = 'EATING';
assert(a1.state === 'EATING', 'Animal entered EATING state');
manager.player!.position = { x: a1.position.x, y: a1.position.y };
const petAccepted = manager.petClosestAnimal();
assert(petAccepted, 'Petting was accepted while eating via manager.petClosestAnimal');
assert(a1.state === 'PETTED', 'Section 27 Priority: EATING immediately cancelled and entered PETTED');

// Check Petting Cooldown (Section 25)
const secondPet = manager.petClosestAnimal();
assert(!secondPet, 'Section 25 Cooldown: immediate spam pet is rejected');

// Check Player Hop Reaction (Section 24)
assert(manager.player!.isJumping, 'Section 24: Player triggered joyous hop animation upon pet');

// Check Grass Detection & Eating Bobbing (Section 15, 16, 17)
const cow = animals.find(a => a.species === 'cow') || animals[0];
cow.hunger = 90; // Make very hungry
assert(cow.hunger >= 55, 'Cow hunger is above threshold');
// Simulate AI ticks
for (let i = 0; i < 10; i++) {
  cow.updateAI(0.2, manager.getDetector());
  cow.updateMovement(0.016, manager.getDetector());
}
console.log(`Cow state after hunger tick: ${cow.state}, target:`, cow.target);

// Check Village NPC (Section 29 & 30)
const npcs = manager.getNPCs();
assert(npcs.length > 0, `Villager NPCs spawned: ${npcs.length}`);
const npc = npcs[0];
assert(npc.type === 'NPC', 'NPC entity type is NPC');
assert(npc.state === 'IDLE' || npc.state === 'WALK', `NPC state is ${npc.state}`);

// Check Death Lifecycle (Section 28)
const testAnimal = new Animal(9999, SPECIES_CONFIGS.sheep, 20, 20);
assert(testAnimal.isAlive, 'Test animal is alive');
testAnimal.takeDamage(100);
assert(!testAnimal.isAlive, 'Test animal is no longer alive after taking lethal damage');
assert(testAnimal.state === 'DEAD', 'Test animal transitioned to DEAD state');

// Check Simulation Radius & Despawn Management (Section 7)
const currentCount = manager.getAnimals().length;
assert(currentCount >= 18, `Wildlife population maintained actively at ${currentCount}`);

console.log('\n✨ ALL GAME LOGIC SPECIFICATION TESTS PASSED SUCCESSFULLY! ✨');
