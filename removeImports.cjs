const fs = require('fs');

const files = [
  'src/game/SurvivalEngine.ts',
  'src/generation/SettlementRenderer.ts',
  'src/lifeforms/LifeformManager.ts',
  'src/lifeforms/LifeformRenderer.ts',
  'src/lifeforms/Player.ts',
  'src/main.ts',
  'src/server/GameServer.ts',
  'src/server/WorldRoom.ts',
  'src/lifeforms/index.ts',
  'src/game/systems/CombatSystem.ts',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/import\s*\{\s*Animal[^}]*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
  content = content.replace(/import\s*\{\s*NPC[^}]*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
  content = content.replace(/import\s*\{\s*AnimalSystem[^}]*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
  content = content.replace(/import\s*\{\s*NPCSystem[^}]*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
  
  if (file.endsWith('index.ts')) {
    content = content.replace(/export\s*\*\s*from\s*['"]\.\/(Animal|NPC)['"];?\n?/g, '');
  }

  fs.writeFileSync(file, content);
}
