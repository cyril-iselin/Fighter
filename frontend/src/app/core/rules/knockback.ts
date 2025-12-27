import { Fighter } from '../types';

// Knockback multipliers
const KNOCKBACK_MULTIPLIERS = {
  hit: 1.0,
  block: 0.5,
  parry: 10.0  // Strong parry knockback
};

/**
 * Apply knockback impulse when hitting opponent
 */
export function applyHitKnockback(attacker: Fighter, defender: Fighter, knockback: number): void {
  const direction = attacker.facingRight ? 1 : -1;
  defender.impulseVx += direction * knockback * KNOCKBACK_MULTIPLIERS.hit;

}

/**
 * Apply knockback impulse when opponent blocks
 */
export function applyBlockKnockback(attacker: Fighter, defender: Fighter, knockback: number): void {
  const direction = attacker.facingRight ? 1 : -1;
  defender.impulseVx += direction * knockback * KNOCKBACK_MULTIPLIERS.block;
}

/**
 * Apply knockback impulse when opponent parries (perfect block)
 */
export function applyParryKnockback(attacker: Fighter, defender: Fighter, knockback: number): void {
  const direction = defender.facingRight ? 1 : -1;  // Parry knockback goes toward attacker
  attacker.impulseVx += direction * knockback * KNOCKBACK_MULTIPLIERS.parry;
}