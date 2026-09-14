import { AssetItem } from './assetRegistry';

/**
 * Classifies whether an asset from the atlas represents a flat/walkable terrain tile
 * or a solid/collidable obstacle (buildings, fences, water, trees, rocks, steep cliffs).
 */
export function isAssetCollidable(item: AssetItem, catId?: string): boolean {
  const id = item.id.toLowerCase();
  const cat = (catId || '').toLowerCase();

  // Explicit steep elevation or impassable cliff slopes
  if (
    id.includes('slope') ||
    id.includes('cliff') ||
    id.includes('wall') ||
    id.includes('elevation')
  ) {
    return true;
  }

  // Explicit flat ground / walkable terrain tiles
  if (
    id.includes('grass') ||
    id.includes('dirt') ||
    id.includes('soil') ||
    id.includes('sand') ||
    id.includes('cobble') ||
    id.includes('road') ||
    id.includes('path') ||
    id.includes('floor') ||
    id.includes('carpet') ||
    id.includes('rug') ||
    id.includes('flower') ||
    id.includes('mushrooms') ||
    id.includes('crop') ||
    id.includes('wheat') ||
    id.includes('gate_open') ||
    id.includes('door_open') ||
    id.includes('preview') ||
    id.includes('shadow')
  ) {
    return false;
  }

  // Water & Aquatic are collidable (water blocks walking)
  if (cat.includes('water') || id.includes('water') || id.includes('pond') || id.includes('shore')) {
    return true;
  }

  // Buildings, trees, solid farm objects, rocks, walls are collidable
  if (
    cat.includes('building') ||
    cat.includes('tree') ||
    cat.includes('furniture') ||
    id.includes('fence') ||
    id.includes('well') ||
    id.includes('chest') ||
    id.includes('crate') ||
    id.includes('trough') ||
    id.includes('rock') ||
    id.includes('iron') ||
    id.includes('boulder') ||
    id.includes('pillar') ||
    id.includes('house') ||
    id.includes('chimney') ||
    id.includes('roof') ||
    id.includes('tree')
  ) {
    return true;
  }

  // Farming crops and small plants are flat
  if (cat.includes('crop') || cat.includes('plant')) {
    return false;
  }

  return false;
}
