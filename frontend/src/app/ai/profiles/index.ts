// ============================================================================
// AI PROFILES MODULE
// ============================================================================
// Public API for AI profile system
// ============================================================================

// Types
export type {
  CharacterAIProfile,
  AttackPolicy,
  AttackWeight,
  RangePolicy,
  DefensePolicy,
  BlockMapping,
  BehaviorModifiers,
} from './types';

// Defaults & Helpers
export {
  DEFAULT_RANGE_POLICY,
  DEFAULT_DEFENSE_POLICY,
  DEFAULT_BEHAVIOR,
  createProfile,
} from './types';

// Generic Brain Implementation
export { GenericBasicBrain } from './generic-basic-brain';
