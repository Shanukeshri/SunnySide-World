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

code = code.replace(/.*animalSystem\.scareAnimal.*\n?/g, '');
code = code.replace(/.*npcSystem\.interactWithNPC.*\n?/g, '');
code = code.replace(/.*animalSystem\.petAnimal.*\n?/g, '');
code = code.replace(/.*animalSystem\.feedAnimal.*\n?/g, '');

fs.writeFileSync('src/server/GameServer.ts', code);
