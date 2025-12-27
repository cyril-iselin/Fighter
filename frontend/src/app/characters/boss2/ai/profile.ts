// ============================================================================
// BOSS2 AI PROFILE
// ============================================================================
// Defensive boss character AI configuration
// Boss2 (Orc Warrior) - tanky bruiser with counter-attack style
// ============================================================================

import { createProfile, type CharacterAIProfile } from '../../../ai/profiles/types';
import { BOSS2_ATTACK_DATA } from '../combat/attack-data';

/**
 * Get engage range for Boss2's current loadout
 * Boss2 only uses 'bare' loadout
 */
function getBoss2EngageRange(): number {
    const attacks = Object.values(BOSS2_ATTACK_DATA);
    return Math.max(...attacks.map(a => a.engageRange));
}

/**
 * Boss2 AI Profile
 * - More defensive/patient fighter compared to Boss1
 * - Waits for openings, then punishes hard
 * - Phase-based difficulty scaling
 */
export const BOSS2_AI_PROFILE: CharacterAIProfile = createProfile({
    characterId: 'boss2',
    name: 'Orc Warrior AI',

    attackPolicy: {
        attacks: [
            //   { command: 'heavy', weight: 40 },
            { command: 'light', weight: 60 },
        ],
        // Heavy punishes on telegraph
        telegraphAttacks: [
            { command: 'heavy', weight: 100 },
        ],
    },

    // Boss2 is more defensive - keeps distance and counter-attacks
    rangePolicy: {
        engageRange: getBoss2EngageRange(),
        engageHysteresis: 35,
        chaseDeadzone: 60,
        chaseLockTicks: 8,
        airborneStopRange: 150,
        preferredDistance: 460,    // Stays further back than Boss1
        retreatDistance: 250,      // More willing to retreat
        retreatProbability: 0.6,   // 60% retreat chance
        maintainDistance: true,
    },

    behavior: {
        aggression: 0.35,        // Less aggressive than Boss1
        reactionDelay: 8,        // Slightly faster reactions
        pressureChance: 0.6,     // Moderate pressure
        survivalInstinct: 0.2,   // Slightly more cautious
    },

    // Phase-based difficulty scaling
    phases: [
        // Phase 1: Full health - patient, defensive
        {   
            name: 'Aufwärmphase',
            hpPercent: 100,
            speed: 1.0,
            aggression: 0.35,
            attackWeights: { heavy: 30, light: 70 },
            reactionDelay: 8,
            rageBurst: {
                proximityThreshold: 300,  // Player must be within 300px
                durationTicks: 180,        // ~3 seconds at 60fps
                cooldownTicks: 300,       // ~5 seconds between bursts
                knockbackStrength: 3000,
            },
        },
        // Phase 2: Half health - starts pressing
        {
            name: 'Wendepunkt',
            hpPercent: 50,
            speed: 1.2,
            aggression: 0.6,
            attackWeights: { heavy: 50, light: 50 },
            reactionDelay: 6,
            telegraphOverrides: {
                boss2_heavy: 200,
            },
             rageBurst: {
                proximityThreshold: 300,  // Player must be within 300px
                durationTicks: 270,        // ~4.5 seconds at 60fps
                cooldownTicks: 600,       // ~10 seconds between bursts
                knockbackStrength: 3000,
            },
        },
        // Phase 3: Low health - berserker mode
        {
            name: 'Finale',
            hpPercent: 30,
            speed: 1.4,
            aggression: 0.9,
            attackWeights: { heavy: 40, light: 60 },
            reactionDelay: 3,
            preferredDistance: 480,
            superArmor: true,
            telegraphOverrides: {
                boss2_heavy: 150,
            },
             rageBurst: {
                proximityThreshold: 300,  // Player must be within 300px
                durationTicks: 180,        // ~3 seconds at 60fps
                cooldownTicks: 600,       // ~10 seconds between bursts
                knockbackStrength: 3500,
            },
        },
    ],
});
