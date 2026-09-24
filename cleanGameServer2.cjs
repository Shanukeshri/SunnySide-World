const fs = require('fs');
let code = fs.readFileSync('src/server/GameServer.ts', 'utf8');

code = code.replace(/import\s*\{\s*AnimalSystem\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
code = code.replace(/import\s*\{\s*NPCSystem\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');

code = code.replace(/public\s+animalSystem:\s*AnimalSystem;?\n?/g, '');
code = code.replace(/public\s+npcSystem:\s*NPCSystem;?\n?/g, '');

code = code.replace(/this\.animalSystem\s*=\s*new\s*AnimalSystem\([^)]*\);?\n?/g, '');
code = code.replace(/this\.npcSystem\s*=\s*new\s*NPCSystem\([^)]*\);?\n?/g, '');

code = code.replace(/new\s+CombatSystem\([^,]+,\s*this\.animalSystem\)/g, 'new CombatSystem(this.gameState)');

code = code.replace(/this\.animalSystem\.update\([^)]*\);?\n?/g, '');
code = code.replace(/this\.npcSystem\.update\([^)]*\);?\n?/g, '');

code = code.replace(/this\.animalSystem\.scareAnimal\([^)]*\);?/g, '');
code = code.replace(/room\.animalSystem\.scareAnimal\([^)]*\);?/g, '');

code = code.replace(/this\.animalSystem\.feedAnimal\([^)]*\);?/g, '');
code = code.replace(/room\.animalSystem\.feedAnimal\([^)]*\);?/g, '');

code = code.replace(/this\.animalSystem\.petAnimal\([^)]*\)/g, 'false');
code = code.replace(/room\.animalSystem\.petAnimal\([^)]*\)/g, 'false');

code = code.replace(/this\.npcSystem\.interactWithNPC\([^)]*\);?/g, '');
code = code.replace(/room\.npcSystem\.interactWithNPC\([^)]*\);?/g, '');

fs.writeFileSync('src/server/GameServer.ts', code);
