# AI Module

## Overview

The AI module provides profile-driven AI behavior for fighter characters. All AI logic is driven by `CharacterAIProfile` configurations, making it easy to create different AI personalities without writing new code.

## Architecture

```
ai/
├── index.ts                 # Public API exports
├── init.ts                  # Profile registration at startup
├── factory.ts               # Brain creation factory
├── ai-selection.service.ts  # Angular service for runtime AI selection
├── brain.interface.ts       # IFighterBrain interface
├── observation.ts           # Creates Observation from MatchState
├── rng.ts                   # Seeded RNG for deterministic AI
├── debug-brain.ts           # Debug wrapper for logging
├── basic-brain.ts           # ⚠️ DEPRECATED - use GenericBasicBrain
└── profiles/
    ├── index.ts
    ├── types.ts             # CharacterAIProfile & related types
    └── generic-basic-brain.ts  # Profile-driven brain implementation
```

## Quick Start

### 1. Create an AI Profile

```typescript
// characters/mycharacter/ai/profile.ts
import { createProfile, type CharacterAIProfile } from '../../../ai';

export const MY_CHARACTER_PROFILE: CharacterAIProfile = createProfile({
  characterId: 'mycharacter',
  name: 'My Character AI',
  
  attackPolicy: {
    weights: [
      { attack: 'jab', weight: 0.6, minRange: 0, maxRange: 100 },
      { attack: 'heavy', weight: 0.4, minRange: 0, maxRange: 120 },
    ],
    attackCooldown: 30,
  },
  
  rangePolicy: {
    engageRange: 100,
    engageHysteresis: 25,
  },
  
  defensePolicy: {
    blockProbability: 0.6,
  },
});
```

### 2. Register the Profile

```typescript
// ai/init.ts
import { MY_CHARACTER_PROFILE } from '../characters/mycharacter/ai';

export function initializeAI(): void {
  registerAIProfile(MY_CHARACTER_PROFILE);
}
```

### 3. Use the Factory

```typescript
import { createBrain } from './ai';

const brain = createBrain('mycharacter');
const intent = brain.decide(observation, tick);
```

## Key Types

### CharacterAIProfile

```typescript
interface CharacterAIProfile {
  characterId: string;      // Links to character registry
  name: string;             // Display name
  attackPolicy: AttackPolicy;
  rangePolicy: RangePolicy;
  defensePolicy: DefensePolicy;
  behaviorModifiers: BehaviorModifiers;
}
```

### AttackPolicy

Defines which attacks to use (weights only - ranges come from attack-data.ts):

```typescript
interface AttackPolicy {
  attacks: AttackWeight[];           // Attack selection weights
  telegraphAttacks?: AttackWeight[]; // Punish attacks
  pressureAttacks?: AttackWeight[];  // Wake-up pressure attacks
}

interface AttackWeight {
  command: AttackCommand;    // 'light', 'heavy', 'special'
  weight: number;            // Selection probability (higher = more likely)
  opponentStates?: FighterState[]; // Only when opponent in these states
  cooldownTicks?: number;    // Per-attack cooldown
}
```

**Note:** Distance constraints (`minDistance`, `maxDistance`) are **not** in AttackWeight. The AI reads `engageRange` from `attack-data.ts` automatically.

### RangePolicy

Controls spacing, approach and retreat behavior:

```typescript
interface RangePolicy {
  // --- ENGAGE (when to attack) ---
  engageRange?: number;       // Optional override (auto-computed from attack-data)
  engageHysteresis: number;   // Buffer to prevent flicker
  
  // --- CHASE (approaching) ---
  chaseDeadzone: number;      // Movement deadzone
  chaseLockTicks: number;     // Direction lock duration
  airborneStopRange: number;  // Stop chasing airborne opponents
  
  // --- SPACING (new!) ---
  preferredDistance?: number;   // Optimal fighting range
  retreatDistance?: number;     // Distance below which AI retreats
  retreatProbability?: number;  // 0-1 chance to retreat (default: 0.5)
  maintainDistance?: boolean;   // Actively stay at preferredDistance
  retreatLockTicks?: number;    // Direction lock for retreat
}
```

**Movement Zones:**
```
|<-- RETREAT -->|<-- OPTIMAL -->|<-- APPROACH -->|
0     retreat    preferred       engage          ∞
      Distance                   (from attack-data)
```

**Example Playstyles:**

```typescript
// Zoner - keeps distance
rangePolicy: {
  preferredDistance: 150,
  retreatDistance: 80,
  retreatProbability: 0.7,
  maintainDistance: true,
}

// Rushdown - always in your face  
rangePolicy: {
  preferredDistance: 60,
  retreatDistance: 0,
  retreatProbability: 0,
}

// Balanced
rangePolicy: {
  preferredDistance: 100,
  retreatDistance: 50,
  retreatProbability: 0.3,
}
```

**Note:** `engageRange` is optional. If not set, the AI computes it as the maximum `engageRange` from all attacks for the current loadout.

### DefensePolicy

Controls blocking behavior:

```typescript
interface DefensePolicy {
  blockProbability: number;  // 0-1 chance to block
  preferParry?: boolean;     // Parry vs hold block
  blockOnTelegraph?: boolean;
  blockOnAttack?: boolean;
}
```

## Angular Integration

### AISelectionService

Provides runtime AI selection in the UI:

```typescript
@Component({ ... })
class MyComponent {
  private aiService = inject(AISelectionService);
  
  availableAIs = this.aiService.availableAIs;
  selectedAIId = this.aiService.selectedAIId;
  
  onSelectAI(id: string) {
    this.aiService.selectAI(id);
    const brain = this.aiService.createBrainById(id);
    this.gameLoop.setAIBrain(brain);
  }
}
```

## File Status

| File | Status | Purpose |
|------|--------|---------|
| `generic-basic-brain.ts` | ✅ Active | Profile-driven AI implementation |
| `factory.ts` | ✅ Active | Brain creation & profile registry |
| `ai-selection.service.ts` | ✅ Active | Angular service for UI selection |
| `init.ts` | ✅ Active | Profile registration at startup |
| `debug-brain.ts` | ✅ Active | Logging wrapper for debugging |
| `observation.ts` | ✅ Active | Creates Observation from state |
| `rng.ts` | ✅ Active | Seeded random number generator |
| `brain.interface.ts` | ✅ Active | Core interface definition |
| `basic-brain.ts` | ⚠️ Deprecated | Legacy - use GenericBasicBrain |

## Notes

- **One profile per character-AI-variant**: A "Stickman Aggressive" profile is different from "Boss1 Aggressive" because they have different attack sets
- **Deterministic RNG**: Use `SeededRNG` for reproducible AI behavior in tests
- **Anti-flicker logic**: Built into GenericBasicBrain to prevent rapid state oscillation
- **Attack ranges from attack-data.ts**: The AI reads `engageRange` per attack from character attack-data, so you don't need to duplicate ranges in the profile
- **Loadout-aware**: When loadout changes (e.g., bare → sword), the AI automatically recalculates engage range based on available attacks
