// ============================================
// Campaign Types & Bonus Definitions
// ============================================

export type BonusRarity = 'common' | 'uncommon' | 'rare';

export type BonusId = 
  // Common
  | 'speed_boost'
  | 'damage_boost'
  | 'quick_charge'
  | 'jump_master'
  // Uncommon
  | 'vitality'
  | 'stun_expert'
  | 'iron_skin'
  | 'vampirism'
  | 'perfect_blocker'
  // Rare
  | 'sword_master';

export interface Bonus {
  id: BonusId;
  name: string;
  description: string;
  icon: string;
  rarity: BonusRarity;
}

export interface BonusEffects {
  speedMultiplier: number;      // 1.0 = normal
  damageMultiplier: number;     // 1.0 = normal
  healthMultiplier: number;     // 1.0 = normal
  stunRateMultiplier: number;   // 1.0 = normal
  specialChargeMultiplier: number; // 1.0 = normal
  jumpMultiplier: number;       // 1.0 = normal
  blockReduction: number;       // 0.6 = 60% reduction (default)
  vampirism: number;            // HP healed per hit
  hasSword: boolean;            // Sword loadout
  perfectBlockWindowBonus: number; // Additional ms for perfect block window (stacks)
}

// ============================================
// Bonus Definitions
// ============================================

export const BONUS_DEFINITIONS: Record<BonusId, Bonus> = {
  // Common (40% each = total ~66% to get one)
  speed_boost: {
    id: 'speed_boost',
    name: 'SCHNELLER FUSS',
    description: '+25% schnellere Bewegung',
    icon: '🏃',
    rarity: 'common'
  },
  damage_boost: {
    id: 'damage_boost',
    name: 'EISERNE FÄUSTE',
    description: '+20% Schaden',
    icon: '💪',
    rarity: 'common'
  },
  quick_charge: {
    id: 'quick_charge',
    name: 'SCHNELLLADUNG',
    description: 'Spezial füllt sich 30% schneller',
    icon: '⚡',
    rarity: 'common'
  },
  jump_master: {
    id: 'jump_master',
    name: 'SPRINGMEISTER',
    description: '+30% Sprungkraft',
    icon: '🦵',
    rarity: 'common'
  },
  
  // Uncommon (15% each = total ~28% to get one)
  vitality: {
    id: 'vitality',
    name: 'VITALITÄT',
    description: '+30% Max Gesundheit',
    icon: '❤️',
    rarity: 'uncommon'
  },
  stun_expert: {
    id: 'stun_expert',
    name: 'BETÄUBUNGSEXPERTE',
    description: '+25% Betäubungsaufbau',
    icon: '🎯',
    rarity: 'uncommon'
  },
  iron_skin: {
    id: 'iron_skin',
    name: 'EISERNE HAUT',
    description: '+10% Block-Reduktion',
    icon: '🛡️',
    rarity: 'uncommon'
  },
  vampirism: {
    id: 'vampirism',
    name: 'VAMPIRISMUS',
    description: 'Heilt 3 HP pro Treffer',
    icon: '🧛',
    rarity: 'uncommon'
  },
  perfect_blocker: {
    id: 'perfect_blocker',
    name: 'PERFEKTER BLOCKER',
    description: '+100ms Perfektes Blockfenster',
    icon: '🎯',
    rarity: 'uncommon'
  },
  
  // Rare (5% = rare!)
  sword_master: {
    id: 'sword_master',
    name: 'SCHWERTMEISTER',
    description: 'Schaltet Schwert-Ausrüstung frei',
    icon: '⚔️',
    rarity: 'rare'
  }
};

// ============================================
// Dynamic Bonus Description (based on stack count)
// ============================================

export function getBonusDescription(id: BonusId, count: number): string {
  const stackMultiplier = Math.pow(2, count - 1);
  
  switch (id) {
    case 'speed_boost':
      return `+${25 * stackMultiplier}% schnellere Bewegung`;
    case 'damage_boost':
      return `+${20 * stackMultiplier}% Schaden`;
    case 'quick_charge':
      return `+${30 * stackMultiplier}% Spezial-Aufladung`;
    case 'jump_master':
      return `+${30 * stackMultiplier}% Sprungkraft`;
    case 'vitality':
      return `+${30 * stackMultiplier}% Max Gesundheit`;
    case 'stun_expert':
      return `+${25 * stackMultiplier}% Betäubungsaufbau`;
    case 'iron_skin': {
      const bonusReduction = Math.min(35, 10 * stackMultiplier); // Cap at 35% extra (95% total)
      return `+${bonusReduction}% Block-Reduktion`;
    }
    case 'vampirism':
      return `Heilt ${3 * stackMultiplier} HP pro Treffer`;
    case 'perfect_blocker':
      return `+${100 * stackMultiplier}ms Perfektes Blockfenster`;
    case 'sword_master':
      return 'Schaltet Schwert-Ausrüstung frei';
  }
}

// ============================================
// Rarity Weights (for weighted random selection)
// ============================================

export const RARITY_WEIGHTS: Record<BonusRarity, number> = {
  common: 40,
  uncommon: 15,
  rare: 5
};

// ============================================
// Default Bonus Effects (no bonuses)
// ============================================

export function getDefaultBonusEffects(): BonusEffects {
  return {
    speedMultiplier: 1.0,
    damageMultiplier: 1.0,
    healthMultiplier: 1.0,
    stunRateMultiplier: 1.0,
    specialChargeMultiplier: 1.0,
    jumpMultiplier: 1.0,
    blockReduction: 0.6,
    vampirism: 0,
    hasSword: false,
    perfectBlockWindowBonus: 0
  };
}

// ============================================
// Calculate Stacked Bonus Effects
// Jeder Bonus verdoppelt sich bei Mehrfach-Auswahl (außer Schwert)
// ============================================

export function calculateBonusEffects(bonusIds: BonusId[]): BonusEffects {
  const effects = getDefaultBonusEffects();
  
  // Zähle wie oft jeder Bonus gewählt wurde
  const bonusCounts = new Map<BonusId, number>();
  for (const id of bonusIds) {
    bonusCounts.set(id, (bonusCounts.get(id) || 0) + 1);
  }
  
  // Wende jeden einzigartigen Bonus an mit Verdopplung
  for (const [id, count] of bonusCounts) {
    // Berechne Verdopplungs-Multiplikator: 1x=1, 2x=2, 3x=4, 4x=8, etc.
    const stackMultiplier = Math.pow(2, count - 1);
    
    switch (id) {
      case 'speed_boost':
        // Base: +25%, verdoppelt: +50%, +100%, +200%...
        effects.speedMultiplier = 1.0 + (0.25 * stackMultiplier);
        break;
      case 'damage_boost':
        // Base: +20%, verdoppelt: +40%, +80%, +160%...
        effects.damageMultiplier = 1.0 + (0.20 * stackMultiplier);
        break;
      case 'quick_charge':
        // Base: +30%, verdoppelt: +60%, +120%...
        effects.specialChargeMultiplier = 1.0 + (0.30 * stackMultiplier);
        break;
      case 'jump_master':
        // Base: +30%, verdoppelt: +60%, +120%...
        effects.jumpMultiplier = 1.0 + (0.30 * stackMultiplier);
        break;
      case 'vitality':
        // Base: +30%, verdoppelt: +60%, +120%...
        effects.healthMultiplier = 1.0 + (0.30 * stackMultiplier);
        break;
      case 'stun_expert':
        // Base: +25%, verdoppelt: +50%, +100%...
        effects.stunRateMultiplier = 1.0 + (0.25 * stackMultiplier);
        break;
      case 'iron_skin':
        // Base: +10% (0.6 -> 0.7), verdoppelt: +20% (0.8), +40% (cap at 0.95)
        const bonusReduction = 0.10 * stackMultiplier;
        effects.blockReduction = Math.min(0.95, 0.6 + bonusReduction);
        break;
      case 'vampirism':
        // Base: 3 HP, verdoppelt: 6, 12, 24...
        effects.vampirism = 3 * stackMultiplier;
        break;
      case 'perfect_blocker':
        // Base: +100ms, verdoppelt: +200ms, +400ms...
        effects.perfectBlockWindowBonus = 100 * stackMultiplier;
        break;
      case 'sword_master':
        // Schwert: Kein Verdoppeln, nur einmal auswählbar
        effects.hasSword = true;
        break;
    }
  }
  
  return effects;
}

// ============================================
// Get Random Bonus (weighted by rarity)
// ============================================

export function getRandomBonus(excludeIds: BonusId[] = []): Bonus {
  const allBonuses = Object.values(BONUS_DEFINITIONS);
  const availableBonuses = allBonuses.filter(b => !excludeIds.includes(b.id));
  
  if (availableBonuses.length === 0) {
    // All bonuses collected! Return a random one anyway
    return allBonuses[Math.floor(Math.random() * allBonuses.length)];
  }
  
  // Build weighted pool
  const weightedPool: Bonus[] = [];
  for (const bonus of availableBonuses) {
    const weight = RARITY_WEIGHTS[bonus.rarity];
    for (let i = 0; i < weight; i++) {
      weightedPool.push(bonus);
    }
  }
  
  // Pick random from weighted pool
  const randomIndex = Math.floor(Math.random() * weightedPool.length);
  return weightedPool[randomIndex];
}

// ============================================
// Rarity Colors (for UI)
// ============================================

export const RARITY_COLORS: Record<BonusRarity, { bg: string; border: string; glow: string }> = {
  common: {
    bg: 'bg-gray-800',
    border: 'border-gray-500',
    glow: 'shadow-gray-500/30'
  },
  uncommon: {
    bg: 'bg-blue-900/50',
    border: 'border-blue-400',
    glow: 'shadow-blue-400/50'
  },
  rare: {
    bg: 'bg-yellow-900/50',
    border: 'border-yellow-400',
    glow: 'shadow-yellow-400/70'
  }
};
