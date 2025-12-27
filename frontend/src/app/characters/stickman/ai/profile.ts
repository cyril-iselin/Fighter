// ============================================================================
// STICKMAN AI PROFILE
// ============================================================================
// Character-specific AI configuration for Stickman
// Only defines behavior parameters - no logic
// ============================================================================

import { createProfile, type CharacterAIProfile } from '../../../ai/profiles/types';

/**
 * Stickman AI Profile
 * - Balanced fighter with 60/40 light/heavy attack ratio
 * - Engage range auto-computed from attack-data.ts
 * - Moderate aggression
 */
export const STICKMAN_AI_PROFILE: CharacterAIProfile = createProfile({
    characterId: 'stickman',
    name: 'Stickman Basic AI',

    attackPolicy: {
        attacks: [
            // Light attack - primary damage source
            { command: 'light', weight: 60 },
            // Heavy attack - less frequent, higher damage
            { command: 'heavy', weight: 40 },
        ],
        telegraphAttacks: [
            { command: 'heavy', weight: 80 },
            { command: 'light', weight: 20 },
        ],
    },

    // engageRange, preferredDistance, retreatDistance are auto-computed from attack-data.ts per loadout
    rangePolicy: {
        engageHysteresis: 25,
        chaseDeadzone: 25,
        chaseLockTicks: 6,
        airborneStopRange: 100,
        // Spacing behavior
        retreatProbability: 0.5,   // 50% chance to retreat when too close
        maintainDistance: true,    // Actively maintain preferred distance
    },

    defensePolicy: {
        blockMapping: {
            zoneMap: {
                top: 'top',
                center: 'center',
            },
            defaultZone: 'center',
        },
        blockRangeBuffer: 20,
        parryChance: 0.30,
        attackingStates: ['telegraph', 'attack'],
    },

    behavior: {
        aggression: 0.5, // 50% chance to attack when in range
        reactionDelay: 0,
        pressureChance: 0.3,
        survivalInstinct: 0.2,
    },

    // Phase-based difficulty scaling
    phases: [
        // Phase 1: Full health - cautious, learning the player
        {
            name: 'Aufwärmphase',
            hpPercent: 100,
            speed: 1.0,
            aggression: 0.5,
            attackWeights: { heavy: 20, light: 80 },
            preferredDistance: 300,
            reactionDelay: 10,
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
            attackWeights: { heavy: 60, light: 40 },
            reactionDelay: 7,
            preferredDistance: 300,
            rageBurst: {
                proximityThreshold: 300,  // Player must be within 300px
                durationTicks: 180,        // ~3 seconds at 60fps
                cooldownTicks: 600,       // ~10 seconds between bursts
                knockbackStrength: 3000,
            },
        },
        // Phase 3: Low health - desperate and dangerous
        {
            name: 'Finale',
            hpPercent: 30,
            speed: 1.0,
            aggression: 0.9,
            attackWeights: { heavy: 70, light: 30 },
            reactionDelay: 5,
            superArmor: true,
            preferredDistance: 430,
            loadout: 'sword'
        },
    ],
});
