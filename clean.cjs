const fs = require('fs');

const files = [
  'src/game/SurvivalEngine.ts',
  'src/generation/SettlementRenderer.ts',
  'src/lifeforms/LifeformManager.ts',
  'src/lifeforms/LifeformRenderer.ts',
  'src/lifeforms/Player.ts',
  'src/main.ts',
  'src/server/GameServer.ts',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Remove imports
  content = content.replace(/import\s*\{\s*Animal\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
  content = content.replace(/import\s*\{\s*NPC\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
  content = content.replace(/import\s*\{\s*Animal,\s*NPC\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');

  // For SurvivalEngine.ts
  if (file.includes('SurvivalEngine.ts')) {
    content = content.replace(/public\s+animals:\s*Animal\[\]\s*=\s*\[\];?\n?/g, '');
    content = content.replace(/public\s+npcs:\s*NPC\[\]\s*=\s*\[\];?\n?/g, '');
    content = content.replace(/public\s+activeDialogueNPC:\s*NPC\s*\|\s*null\s*=\s*null;?\n?/g, '');
    
    // Remove loops and arrays usages
    content = content.replace(/this\.animals/g, '([])');
    content = content.replace(/this\.npcs/g, '([])');
    content = content.replace(/new\s+Animal\([^)]*\)/g, 'null');
    content = content.replace(/new\s+NPC\([^)]*\)/g, 'null');
    content = content.replace(/const\s+duck\s*=\s*null;?/g, ''); // cleanup
    content = content.replace(/const\s+animal\s*=\s*null;?/g, '');
    content = content.replace(/const\s+npc\s*=\s*null;?/g, '');
  }

  // For SettlementRenderer.ts
  if (file.includes('SettlementRenderer.ts')) {
    content = content.replace(/animals:\s*readonly\s*Animal\[\];/g, '');
    content = content.replace(/npcs:\s*readonly\s*NPC\[\];/g, '');
    content = content.replace(/let\s+targetedAnimal:\s*Animal\s*\|\s*null\s*=\s*null;/g, '');
    content = content.replace(/targetedAnimal\s*=\s*lifeforms\.player\.findNearbyInteractable\(lifeforms\.animals\s*as\s*Animal\[\],\s*2\.0\);/g, '');
  }

  // For LifeformManager.ts
  if (file.includes('LifeformManager.ts')) {
    content = content.replace(/private\s+animals:\s*Animal\[\]\s*=\s*\[\];?\n?/g, '');
    content = content.replace(/private\s+npcs:\s*NPC\[\]\s*=\s*\[\];?\n?/g, '');
    content = content.replace(/public\s+getAnimals\(\):\s*readonly\s*Animal\[\]\s*\{\s*return\s*\[\];\s*\}/g, '');
    content = content.replace(/public\s+getNPCs\(\):\s*readonly\s*NPC\[\]\s*\{\s*return\s*\[\];\s*\}/g, '');
    content = content.replace(/public\s+getAnimals\(\)[\s\S]*?\}/g, 'public getAnimals(): any[] { return []; }');
    content = content.replace(/public\s+getNPCs\(\)[\s\S]*?\}/g, 'public getNPCs(): any[] { return []; }');
    content = content.replace(/this\.animals/g, '([])');
    content = content.replace(/this\.npcs/g, '([])');
    content = content.replace(/new\s+NPC\([^)]*\)/g, 'null');
    content = content.replace(/Animal\s*\|\s*NPC\s*\|\s*Player\s*\|\s*null/g, 'Player | null');
    content = content.replace(/animal:\s*Animal/g, 'animal: any');
  }

  // For LifeformRenderer.ts
  if (file.includes('LifeformRenderer.ts')) {
    content = content.replace(/animal:\s*Animal/g, 'animal: any');
    content = content.replace(/npc:\s*NPC/g, 'npc: any');
  }

  // For Player.ts
  if (file.includes('Player.ts')) {
    content = content.replace(/animals:\s*Animal\[\]/g, 'animals: any[]');
    content = content.replace(/Animal\s*\|\s*null/g, 'any | null');
    content = content.replace(/let\s+closest:\s*Animal\s*\|\s*null\s*=\s*null;/g, 'let closest: any | null = null;');
  }

  // For main.ts
  if (file.includes('main.ts')) {
    content = content.replace(/const\s+animal\s*=\s*clicked\s*as\s*Animal;/g, '');
    content = content.replace(/new\s+Animal\([^)]*\)/g, 'null');
    content = content.replace(/new\s+NPC\([^)]*\)/g, 'null');
    content = content.replace(/function\s+openDialogueModal\(npc:\s*NPC\)/g, 'function openDialogueModal(npc: any)');
  }

  // For GameServer.ts
  if (file.includes('GameServer.ts')) {
    content = content.replace(/.*animalSystem.*\n/g, '');
    content = content.replace(/.*npcSystem.*\n/g, '');
  }

  fs.writeFileSync(file, content);
}

console.log('Cleanup complete.');
