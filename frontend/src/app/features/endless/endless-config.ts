// ============================================================================
// ENDLESS MODE CONFIGURATION
// ============================================================================

import { BuffDefinition, BuffRarity, EndlessLevelConfig } from './endless-types';

// =============================================================================
// BUFF DEFINITIONS
// =============================================================================

export const BUFF_POOL: BuffDefinition[] = [
  // ---------------------------------------------------------------------------
  // NORMAL BUFFS (70% drop chance)
  // ---------------------------------------------------------------------------
  {
    id: 'damage_light',
    name: 'Schnelle Klinge',
    description: '+20% Light Attack Schaden',
    icon: '⚡',
    rarity: 'normal',
    value: 0.20,
    stackable: true,
  },
  {
    id: 'damage_heavy',
    name: 'Schwerer Schlag',
    description: '+20% Heavy Attack Schaden',
    icon: '💪',
    rarity: 'normal',
    value: 0.20,
    stackable: true,
  },
  {
    id: 'damage_special',
    name: 'Spezialtraining',
    description: '+20% Special Attack Schaden',
    icon: '✨',
    rarity: 'normal',
    value: 0.20,
    stackable: true,
  },
  {
    id: 'block_boost',
    name: 'Eiserner Schild',
    description: '+30% Block-Reduktion',
    icon: '🛡️',
    rarity: 'normal',
    value: 0.30,
    stackable: true,
  },
  {
    id: 'vitality',
    name: 'Vitalität',
    description: '+50 Max HP',
    icon: '❤️',
    rarity: 'normal',
    value: 50,
    stackable: true,
  },
  {
    id: 'special_charge',
    name: 'Energiefluss',
    description: '+25% Special-Meter Aufladung',
    icon: '🔋',
    rarity: 'normal',
    value: 0.25,
    stackable: true,
  },
  {
    id: 'pressure_master',
    name: 'Druckmeister',
    description: '+25% Pressure-Meter Aufbau',
    icon: '😵',
    rarity: 'normal',
    value: 0.25,
    stackable: true,
  },

  // ---------------------------------------------------------------------------
  // RARE BUFFS (25% drop chance)
  // ---------------------------------------------------------------------------
  {
    id: 'greater_vitality',
    name: 'Große Vitalität',
    description: '+75 Max HP',
    icon: '💖',
    rarity: 'rare',
    value: 75,
    stackable: true,
  },
  {
    id: 'swift',
    name: 'Windläufer',
    description: '+10% Bewegungstempo',
    icon: '🏃',
    rarity: 'rare',
    value: 0.10,
    stackable: true,
  },
  {
    id: 'vampirism',
    name: 'Vampirismus',
    description: '+4 HP pro Treffer',
    icon: '🧛',
    rarity: 'rare',
    value: 4,
    stackable: true,
  },
  {
    id: 'counter_strike',
    name: 'Gegenschlag',
    description: '+15 Schaden bei Parry',
    icon: '⚔️',
    rarity: 'rare',
    value: 15,
    stackable: true,
  },

  // ---------------------------------------------------------------------------
  // LEGENDARY BUFFS (10% drop chance)
  // ---------------------------------------------------------------------------
  {
    id: 'sword_mastery',
    name: 'Schwertmeister',
    description: 'Schwert-Loadout (permanent)',
    icon: '🗡️',
    rarity: 'legendary',
    value: 1,
    stackable: false,
  },
  {
    id: 'parry_mastery',
    name: 'Parry-Meister',
    description: '+4 HP pro Parry',
    icon: '🎯',
    rarity: 'legendary',
    value: 4,
    stackable: true,
  },
  {
    id: 'regeneration',
    name: 'Regeneration',
    description: '+1 HP pro Sekunde',
    icon: '💚',
    rarity: 'rare',
    value: 1,
    stackable: true,
  },
  {
    id: 'first_aid',
    name: 'Erste Hilfe',
    description: '+50% HP-Restore nach Sieg',
    icon: '🩹',
    rarity: 'normal',
    value: 0.5,
    stackable: true,
  },
];

// =============================================================================
// RARITY WEIGHTS
// =============================================================================

export const RARITY_WEIGHTS: Record<BuffRarity, number> = {
  normal: 70,
  rare: 25,
  legendary: 10,
};

// =============================================================================
// PREDEFINED LEVELS (1-5)
// =============================================================================

export const PREDEFINED_LEVELS: EndlessLevelConfig[] = [
  {
    level: 1,
    title: 'Dein Ebenbild',
    description: 'Wer ist stärker, Du oder Du?',
    aiId: 'stickman-normal',
    bossHealth: 300,
    bossDamageMultiplier: 1.0,
  },
  {
    level: 2,
    title: 'Der Fortschritt',
    description: 'Nutze Füsse und Hände um zu siegen.',
    aiId: 'boss1-aggressive',
    bossHealth: 350,
    bossDamageMultiplier: 1.0,
  },
  {
    level: 3,
    title: 'Training vorbei',
    description: 'Nun gilt es ernst, zeige was du kannst.',
    aiId: 'boss2-defensive',
    bossHealth: 400,
    bossDamageMultiplier: 1.0,
  },
  {
    level: 4,
    title: 'Der Aufstieg',
    description: 'Keine Gnade. Kein Erbarmen. Nur Zerstörung.',
    aiId: 'boss3-tank',
    bossHealth: 450,
    bossDamageMultiplier: 1.1,
  },
  {
    level: 5,
    title: 'Die Ehre',
    description: 'Gewinne diesen Kampf um als Legende anerkannt zu werden.',
    aiId: 'stickman-normal',
    bossHealth: 550,
    bossDamageMultiplier: 1.2,
  },
];

// =============================================================================
// SCALING CONFIGURATION
// =============================================================================

export const ENDLESS_SCALING = {
  /** Base boss HP for Legend levels (level 6+) */
  legendBaseHp: 900,
  
  /** HP increase per Legend level */
  hpPerLevel: 100,
  
  /** Base damage multiplier for Legend levels */
  legendBaseDamage: 1.3,
  
  /** Damage increase per Legend level (0.1 = 10%) */
  damagePerLevel: 0.2,
  
  /** HP restored after each victory */
  hpRestoreOnWin: 50,
  
  /** Starting player HP */
  playerStartHp: 500,
  
  /** Starting player max HP */
  playerStartMaxHp: 500,
};

// =============================================================================
// AI POOL FOR LEGEND LEVELS
// =============================================================================

export const LEGEND_AI_POOL = [
  'stickman-normal',
  'boss1-aggressive',
  'boss2-defensive',
  'boss3-tank',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get level configuration (predefined or scaled)
 */
export function getLevelConfig(level: number): EndlessLevelConfig {
  // Use predefined levels for 1-5
  if (level <= PREDEFINED_LEVELS.length) {
    return PREDEFINED_LEVELS[level - 1];
  }
  
  // Generate scaled Legend level
  const legendLevel = level - PREDEFINED_LEVELS.length;
  const aiIndex = (legendLevel - 1) % LEGEND_AI_POOL.length;
  
  return {
    level,
    title: `Legend ${legendLevel}`,
    description: 'Die Legende wächst. Der Kampf wird härter.',
    aiId: LEGEND_AI_POOL[aiIndex],
    bossHealth: ENDLESS_SCALING.legendBaseHp + (legendLevel * ENDLESS_SCALING.hpPerLevel),
    bossDamageMultiplier: ENDLESS_SCALING.legendBaseDamage + (legendLevel * ENDLESS_SCALING.damagePerLevel),
  };
}

/**
 * Select random buffs based on rarity weights
 * @param count Number of buffs to select
 * @param excludeIds Buff IDs to exclude (e.g., already owned non-stackable)
 */
export function selectRandomBuffs(count: number, excludeIds: string[] = []): BuffDefinition[] {
  const available = BUFF_POOL.filter(b => !excludeIds.includes(b.id));
  
  if (available.length <= count) {
    return [...available];
  }
  
  const selected: BuffDefinition[] = [];
  const pool = [...available];
  
  for (let i = 0; i < count && pool.length > 0; i++) {
    // Calculate total weight
    const totalWeight = pool.reduce((sum, buff) => sum + RARITY_WEIGHTS[buff.rarity], 0);
    
    // Random selection based on weight
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;
    
    for (let j = 0; j < pool.length; j++) {
      random -= RARITY_WEIGHTS[pool[j].rarity];
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }
    
    selected.push(pool[selectedIndex]);
    pool.splice(selectedIndex, 1);
  }
  
  return selected;
}

/**
 * Get buff definition by ID
 */
export function getBuffById(id: string): BuffDefinition | undefined {
  return BUFF_POOL.find(b => b.id === id);
}

/**
 * Get rarity color class for Tailwind
 */
export function getRarityColorClass(rarity: BuffRarity): string {
  switch (rarity) {
    case 'normal':
      return 'border-gray-400 bg-gray-400/10';
    case 'rare':
      return 'border-blue-400 bg-blue-400/10';
    case 'legendary':
      return 'border-yellow-400 bg-yellow-400/10';
  }
}

/**
 * Get rarity glow class for Tailwind
 */
export function getRarityGlowClass(rarity: BuffRarity): string {
  switch (rarity) {
    case 'normal':
      return 'shadow-gray-400/30';
    case 'rare':
      return 'shadow-blue-400/50';
    case 'legendary':
      return 'shadow-yellow-400/50 animate-pulse';
  }
}
