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
 * - Moderate aggression
 * 
 * Auto-computed values (from attack-data.ts):
 * - engageRange: Max attack range für dieses Loadout
 * - preferredDistance: 70% von engageRange (kann in rangePolicy/phases überschrieben werden)
 * - retreatDistance: 50% von preferredDistance (kann in rangePolicy/phases überschrieben werden)
 */
export const STICKMAN_AI_PROFILE: CharacterAIProfile = createProfile({
    characterId: 'stickman',
    name: 'Stickman Basic AI',

    // =========================================================================
    // ATTACK POLICY - Welche Angriffe die AI nutzt
    // =========================================================================
    attackPolicy: {
        // Normale Angriffe (weight = relative Wahrscheinlichkeit)
        // cooldownTicks = Ticks bis dieser Angriff erneut gewählt werden kann
        attacks: [
            { command: 'light', weight: 60, cooldownTicks: 30 },  // 60% Light Attack, ~0.5s Cooldown
            { command: 'heavy', weight: 40, cooldownTicks: 60 },  // 40% Heavy Attack, ~1s Cooldown
        ],
        // Telegraph-Angriffe (wenn AI einen Angriff "ankündigt")
        telegraphAttacks: [
            { command: 'heavy', weight: 80, cooldownTicks: 60 },  // Meist Heavy bei Telegraph
            { command: 'light', weight: 20, cooldownTicks: 30 },
        ],
    },

    // =========================================================================
    // RANGE POLICY - Abstandsverhalten
    // =========================================================================
    // engageRange, preferredDistance, retreatDistance: auto-computed from attack-data.ts
    // Kann hier oder in phases überschrieben werden (phases hat höchste Priorität)
    rangePolicy: {
        // engageHysteresis: Puffer um engageRange um "Flackern" zu verhindern (px)
        engageHysteresis: 25,
        // chaseDeadzone: Mindestabstand bevor AI aufhört zu verfolgen (px)
        chaseDeadzone: 25,
        // chaseLockTicks: Wie lange AI in Verfolgung bleibt bevor neu entschieden wird
        chaseLockTicks: 6,
        // airborneStopRange: AI stoppt Bewegung wenn Spieler in der Luft und innerhalb dieser Range
        airborneStopRange: 100,
        // retreatProbability: Chance (0-1) dass AI zurückweicht wenn zu nah am Spieler
        retreatProbability: 0.5,
        // maintainDistance: Wenn true, versucht AI aktiv preferredDistance zu halten
        maintainDistance: true,
    },

    // =========================================================================
    // DEFENSE POLICY - Block und Parry Verhalten
    // =========================================================================
    defensePolicy: {
        // blockMapping: Welche Angriffszonen wie geblockt werden
        blockMapping: {
            zoneMap: {
                top: 'top',      // Kopftreffer → Block oben
                center: 'center', // Körpertreffer → Block mitte
            },
            defaultZone: 'center',
        },
        // blockRangeBuffer: Zusätzliche Range in der AI blockt (px)
        blockRangeBuffer: 20,
        // parryChance: Chance (0-1) dass AI einen Parry versucht statt zu blocken
        parryChance: 0.30,
        // attackingStates: In welchen Gegner-States die AI blockt/parried
        attackingStates: ['telegraph', 'attack'],
    },

    // =========================================================================
    // BEHAVIOR - Allgemeines Verhalten
    // =========================================================================
    behavior: {
        // aggression: Chance (0-1) anzugreifen wenn in Range
        aggression: 0.5,
        // reactionDelay: Ticks Verzögerung bevor AI auf Aktionen reagiert
        reactionDelay: 10,
        // pressureChance: Chance (0-1) für aggressive Vorwärtsbewegung
        pressureChance: 0.1,
        // survivalInstinct: Chance (0-1) defensiver zu spielen bei niedrigem HP
        survivalInstinct: 0.2,
    },

    // =========================================================================
    // PHASES - HP-basierte Phasen mit unterschiedlichem Verhalten
    // =========================================================================
    // Werte hier überschreiben die Basis-Werte oben!
    phases: [
        // Phase 1: Full health - cautious, learning the player
        {
            name: 'Aufwärmphase',
            hpPercent: 100,                    // Aktiv bei 100-51% HP
            speed: 1.0,                        // Bewegungs-Multiplikator
            aggression: 0.1,                   // Überschreibt behavior.aggression
            attackWeights: { heavy: 50, light: 50 }, // Überschreibt attackPolicy weights
            preferredDistance: 260,            // Überschreibt auto-computed Wert (px)
            reactionDelay: 10,                 // Überschreibt behavior.reactionDelay (ticks)
            rageBurst: {
                proximityThreshold: 300,       // Spieler muss innerhalb X px sein
                durationTicks: 180,            // Rage-Dauer (~3 Sek bei 60fps)
                cooldownTicks: 600,            // Cooldown zwischen Bursts (~10 Sek)
                knockbackStrength: 3000,       // Knockback-Stärke
            },
        },
        // Phase 2: Half health - getting serious
        {
            name: 'Wendepunkt',
            hpPercent: 50,                     // Aktiv bei 50-21% HP
            speed: 1.1,                        // 10% schneller
            aggression: 0.5,                   // Aggressiver
            attackWeights: { heavy: 60, light: 40 }, // Mehr Heavy Attacks
            reactionDelay: 7,                  // Schnellere Reaktion
            preferredDistance: 440,            // an der grenze verhält sich daher defensiv
            loadout: 'sword'                   // Wechselt zu Schwert-Loadout
        },
        // Phase 3: Low health - desperate and dangerous
        {
            name: 'Finale',
            hpPercent: 20,                     // Aktiv bei ≤20% HP
            speed: 1.2,                        // Noch schneller
            aggression: 0.7,                   // Sehr aggressiv
            attackWeights: { heavy: 70, light: 30 }, // Meist Heavy Attacks
            reactionDelay: 5,                  // Schnellste Reaktion
            superArmor: true,                  // Wird nicht durch Treffer unterbrochen
            preferredDistance: 400,            // näher also agressiver
            loadout: 'sword',                   // Wechselt zu Schwert-Loadout
            telegraphOverrides: {
                stickman_heavy: 300,           // Schnellere Heavy-Telegraphs
            },
        },
    ],
});
