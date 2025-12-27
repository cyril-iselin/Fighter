// ============================================================================
// CHARACTER REGISTRY SYSTEM
// ============================================================================
// Central registration for all playable characters
// Each character provides spine configs, combat tuning, and optional AI
// ============================================================================

export interface SpineAssets {
  skeletonPath: string;
  atlasPath: string;
}

export interface SpineMapping {
  bones: Record<string, 
    | string 
    | { start: string; end: string }  // weaponLine with two bones
    | { slot: string; axis?: 'height' | 'width' | 'corners' }  // weaponSlot config
  >;
  animations: {
    // Base state animations
    idle: string;
    walk?: string;
    jump?: string;
    block?: string;
    hurt?: string;
    // Attack animations
    attacks: Record<string, string>; // AttackId → spine animation
  };
}

export interface SpineProfile {
  scale: number;
  groundOffsetY: number;
  facingCorrection?: number;
}

export interface CombatConfig {
  hitboxes: Record<string, any>;    // AttackId → HitboxConfig
  hurtboxes: {
    head: { radius: number; offsetX?: number; offsetY?: number };
    chest: { width: number; height: number; offsetX?: number; offsetY?: number };
  };
}

export interface CharacterDefinition {
  id: string;
  name: string;
  spine: {
    assets: SpineAssets;
    mapping: SpineMapping;
    profile: SpineProfile;
  };
  combat: CombatConfig;
  ai?: any; // IFighterBrain - will be imported per character
}

// Registry storage
const characters = new Map<string, CharacterDefinition>();

/**
 * Register a new character
 */
export function registerCharacter(character: CharacterDefinition): void {
  characters.set(character.id, character);
  console.log(`[CharacterRegistry] Registered character: ${character.name}`);
}

/**
 * Get character by ID
 */
export function getCharacter(id: string): CharacterDefinition | undefined {
  return characters.get(id);
}

/**
 * List all registered characters
 */
export function getAllCharacters(): CharacterDefinition[] {
  return Array.from(characters.values());
}

/**
 * Initialize all characters (call from app startup)
 * MUST be awaited before using any character functionality
 */
export async function initializeCharacters(): Promise<void> {
  // Import and register all characters synchronously
  const stickman = await import('./stickman');
  stickman.registerStickman();
  
  const boss1 = await import('./boss1');
  boss1.registerBoss1();
  
  const boss2 = await import('./boss2');
  boss2.registerBoss2();
  
  const boss3 = await import('./boss3');
  boss3.registerBoss3();
  
  console.log('[Characters] All characters initialized');
}