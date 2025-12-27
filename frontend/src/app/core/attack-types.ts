// ============================================================================
// GENERIC ATTACK TYPES
// ============================================================================
// Character-agnostic type definitions for attacks
// ============================================================================

/**
 * Generic AttackId type - can be any string
 * Character-specific AttackId types are defined in their respective folders
 */
export type AttackId = string;

/**
 * Generic Attack identifier for legacy compatibility
 * Characters should define their own specific AttackId union types
 */
export type GenericAttackId = string;