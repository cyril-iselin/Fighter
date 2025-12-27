// ============================================================================
// AI MODULE PUBLIC API
// ============================================================================
// Central exports for AI system
// ============================================================================

// === Core Interfaces ===
export type { IFighterBrain, IConfigurableBrain } from './brain.interface';
export type { Observation, Intent } from '../core/types';

// === RNG ===
export type { IRNG } from './rng';
export { SeededRNG, defaultRNG } from './rng';

// === Profile System ===
export type {
  CharacterAIProfile,
  AttackPolicy,
  AttackWeight,
  RangePolicy,
  DefensePolicy,
  BehaviorModifiers,
} from './profiles';
export { GenericBasicBrain, createProfile } from './profiles';

// === Factory ===
export {
  registerAIProfile,
  getAIProfile,
  hasAIProfile,
  getRegisteredProfiles,
  createBrain,
  createBrainWithProfile,
  createOpponentBrain,
  createBrainPair,
  type BrainFactoryOptions,
} from './factory';

// === Selection Service ===
export { AISelectionService, type AIOption } from './ai-selection.service';

// === Initialization ===
export { initializeAI, initializeAISelection } from './init';

// === Utilities ===
export { DebugBrain } from './debug-brain';
