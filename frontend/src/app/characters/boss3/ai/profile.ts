// ============================================================================
// BOSS3 AI PROFILE
// ============================================================================
// Slow but devastating boss character AI configuration
// Boss3 (The Bear) - tank that trades hits and wins
// ============================================================================

import { createProfile, type CharacterAIProfile } from '../../../ai/profiles/types';
import { BOSS3_ATTACK_DATA } from '../combat/attack-data';

/**
 * Get engage range for Boss3's current loadout
 * Boss3 only uses 'bare' loadout
 */
function getBoss3EngageRange(): number {
  const attacks = Object.values(BOSS3_ATTACK_DATA);
  return Math.max(...attacks.map(a => a.engageRange));
}

/**
 * Boss3 AI Profile
 * - Slow, tanky brawler
 * - Walks forward relentlessly, trades hits
 * - Phase-based difficulty scaling with permanent super armor
 */
export const BOSS3_AI_PROFILE: CharacterAIProfile = createProfile({
  characterId: 'boss3',
  name: 'The Bear AI',

  attackPolicy: {
    attacks: [
      { command: 'heavy', weight: 60 },  // Prefers devastating heavy
      { command: 'light', weight: 40 },
    ],
    // Always heavy on telegraph punish
    telegraphAttacks: [
      { command: 'heavy', weight: 100 },
    ],
  },

  // Boss3 is a slow tank - walks forward and swings
  rangePolicy: {
    engageRange: getBoss3EngageRange(),
    engageHysteresis: 40,
    chaseDeadzone: 40,
    chaseLockTicks: 10,
    airborneStopRange: 120,
    preferredDistance: 500,
    retreatDistance: 0.5,
    retreatProbability: 0,     // The Bear doesn't run
    maintainDistance: true,   // Just walks forward
  },

  behavior: {
    aggression: 0.45,        // Moderate - waits for openings
    reactionDelay: 12,       // Slow reactions (heavy character)
    pressureChance: 0.9,     // Very aggressive when opponent is down
    survivalInstinct: 0.0,   // Zero self-preservation
  },

  // Phase-based difficulty scaling
  phases: [
    // Phase 1: Full health - slow and methodical
    {
      name: 'Aufwärmphase',
      hpPercent: 100,
      speed: 0.8,            // Actually SLOWER than normal
      aggression: 0.4,
      attackWeights: { heavy: 50, light: 50 },
      reactionDelay: 12,
      rageBurst: {
        proximityThreshold: 350,  // Player must be within 300px
        durationTicks: 270,        // ~4.5 seconds at 60fps
        cooldownTicks: 600,       // ~10 seconds between bursts
        knockbackStrength: 3000,
      },
    },
    // Phase 2: Half health - getting angry
    {
      name: 'Wendepunkt',
      hpPercent: 50,
      speed: 1.0,            // Normal speed now
      aggression: 0.7,
      attackWeights: { heavy: 70, light: 30 },
      reactionDelay: 8,
      superArmor: true,      // Gains super armor at 50%!
      rageBurst: {
        proximityThreshold: 350,  // Player must be within 350px
        durationTicks: 270,        // ~4.5 seconds at 60fps
        cooldownTicks: 600,       // ~10 seconds between bursts
        knockbackStrength: 3000,
      },
      telegraphOverrides: {
        boss3_heavy: 300,
      },
    },
    // Phase 3: Low health - ENRAGED
    {
      name: 'Finale',
      hpPercent: 25,
      speed: 1.5,            // Now faster than normal!
      aggression: 1.0,
      attackWeights: { heavy: 90, light: 10 },
      reactionDelay: 4,
      superArmor: true,
      rageBurst: {
        proximityThreshold: 350,  // Player must be within 350px
        durationTicks: 270,        // ~4.5 seconds at 60fps
        cooldownTicks: 600,       // ~10 seconds between bursts
        knockbackStrength: 3500,
      },
      telegraphOverrides: {
        boss3_heavy: 200,
      },
    },
  ],
});
