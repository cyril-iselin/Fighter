// ============================================================================
// BOSS1 AI PROFILE
// ============================================================================
// Aggressive boss character AI configuration
// Boss1 (Jester) - heavy hitter that rushes the player
// ============================================================================

import { createProfile, type CharacterAIProfile } from '../../../ai/profiles/types';
import { BOSS1_ATTACK_DATA } from '../combat/attack-data';

/**
 * Get engage range for Boss1's current loadout
 * Boss1 only uses 'bare' loadout
 */
function getBoss1EngageRange(): number {
    const attacks = Object.values(BOSS1_ATTACK_DATA);
    // Get the maximum engageRange from available attacks
    return Math.max(...attacks.map(a => a.engageRange));
}

/**
 * Boss1 AI Profile
 * - Aggressive fighter that prefers heavy attacks
 * - Engage range from attack-data.ts
 * - Phase-based difficulty scaling
 */
export const BOSS1_AI_PROFILE: CharacterAIProfile = createProfile({
    characterId: 'boss1',
    name: 'Jester AI',

    attackPolicy: {
        attacks: [
            { command: 'heavy', weight: 50 },
            { command: 'light', weight: 50 },
        ],
        // Heavy punishes on telegraph
        telegraphAttacks: [
            { command: 'heavy', weight: 100 },
        ],
    },

    // Boss1 is a rushdown character - stays at fighting distance
    rangePolicy: {
        engageRange: getBoss1EngageRange(), // From attack-data.ts (500px)
        engageHysteresis: 30,
        chaseDeadzone: 50,         // Bigger deadzone (less twitchy)
        chaseLockTicks: 5,
        airborneStopRange: 150,
        // Stay at fighting distance after attacking (70% of engageRange)
        preferredDistance: 400,    // Stay within attack range but not too close
        retreatDistance: 150,      // Only retreat if very close
        retreatProbability: 0.3,   // Low retreat chance (boss is aggressive)
        maintainDistance: true,    // Actively maintain spacing
    },

    behavior: {
        aggression: 0.50,        // Base aggression (phase 1)
        reactionDelay: 10,       // Slower reactions (boss is heavy)
        pressureChance: 0.8,     // Very aggressive on knockdown
        survivalInstinct: 0.1,   // Bosses don't care about health
    },

    // Phase-based difficulty scaling
    phases: [
        // Phase 1: Full health - cautious, learning the player
        {
            name: 'Aufwärmphase',
            hpPercent: 100,
            speed: 1.0,
            aggression: 0.6,
            attackWeights: { heavy: 30, light: 70 },
            reactionDelay: 7,
            rageBurst: {
                proximityThreshold: 300,  // Player must be within 300px
                durationTicks: 180,        // ~3 seconds at 60fps
                cooldownTicks: 600,       // ~10 seconds between bursts
                knockbackStrength: 3000,
            },
        },
        // Phase 2: Half health - getting serious
        {
            name: 'Wendepunkt',
            hpPercent: 50,
            speed: 1.3,
            aggression: 0.8,
            superArmor: true,
            attackWeights: { heavy: 50, light: 50 },
            reactionDelay: 5,
            rageBurst: {
                proximityThreshold: 400,  // Player must be within 400px
                durationTicks: 180,        // ~3 seconds at 60fps
                cooldownTicks: 600,       // ~10 seconds between bursts
                knockbackStrength: 3000,
            },
        },
        // Phase 3: Low health - desperate and dangerous
        { 
            name: 'Finale',
            hpPercent: 25,
            speed: 2.0,
            aggression: 1.0,
            attackWeights: { heavy: 60, light: 40 },
            reactionDelay: 2,
            superArmor: true,
            telegraphOverrides: {
                boss1_heavy: 150,
            },
            rageBurst: {
                proximityThreshold: 450,  // Player must be within 450px
                durationTicks: 180,        // ~3 seconds at 60fps
                cooldownTicks: 600,       // ~10 seconds between bursts
                knockbackStrength: 3500,
            },
        },
    ],
});
