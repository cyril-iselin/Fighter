// ============================================
// Meter System - Stun & Special Meter Management
// ============================================

import { signal, computed, Signal, WritableSignal } from '@angular/core';

// ============================================
// Configuration Constants
// ============================================

// Stun meter configuration (AI only)
export const STUN_METER_MAX = 100;
export const STUN_METER_HEAD_HIT = 30;  // Head hits add 30 to stun meter
export const STUN_METER_BODY_HIT = 10;  // Body hits add 10 to stun meter
export const STUN_DURATION_MS = 2000;   // 2 seconds stunned when meter fills
export const PERFECT_BLOCK_STUN_BONUS = 20; // Perfect block adds this to attacker's stun

// Special meter configuration (Player only)
export const SPECIAL_METER_MAX = 100;

// ============================================
// Meter State Interface
// ============================================

export interface MeterState {
  value: WritableSignal<number>;
  max: number;
  isFull: Signal<boolean>;
}

export interface StunState extends MeterState {
  isStunned: WritableSignal<boolean>;
  stunRemaining: number; // Remaining stun time in ms
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a special meter state (for player)
 */
export function createSpecialMeter(): MeterState {
  const value = signal(0);
  const isFull = computed(() => value() >= SPECIAL_METER_MAX);
  
  return {
    value,
    max: SPECIAL_METER_MAX,
    isFull
  };
}

/**
 * Create a stun meter state (for AI)
 */
export function createStunMeter(): StunState {
  const value = signal(0);
  const isStunned = signal(false);
  const isFull = computed(() => value() >= STUN_METER_MAX);
  
  return {
    value,
    max: STUN_METER_MAX,
    isFull,
    isStunned,
    stunRemaining: 0
  };
}

// ============================================
// Meter Operations
// ============================================

/**
 * Add value to a meter (clamped to max)
 * @returns The new meter value
 */
export function addToMeter(meter: MeterState, amount: number): number {
  const newValue = Math.min(meter.max, meter.value() + amount);
  meter.value.set(newValue);
  return newValue;
}

/**
 * Fill meter to maximum
 * @returns The max value
 */
export function fillMeter(meter: MeterState): number {
  meter.value.set(meter.max);
  return meter.max;
}

/**
 * Empty/consume the meter
 */
export function consumeMeter(meter: MeterState): void {
  meter.value.set(0);
}

/**
 * Reset meter to zero
 */
export function resetMeter(meter: MeterState): void {
  meter.value.set(0);
}

// ============================================
// Stun-specific Operations
// ============================================

/**
 * Calculate stun increase based on hit zone
 */
export function getStunIncrease(isHeadshot: boolean): number {
  return isHeadshot ? STUN_METER_HEAD_HIT : STUN_METER_BODY_HIT;
}

/**
 * Trigger stun state
 */
export function triggerStun(stunState: StunState): void {
  stunState.isStunned.set(true);
  stunState.stunRemaining = STUN_DURATION_MS;
}

/**
 * Update stun timer (call each frame)
 * @returns true if stun just ended
 */
export function updateStun(stunState: StunState, deltaTime: number): boolean {
  if (!stunState.isStunned() || stunState.stunRemaining <= 0) {
    return false;
  }
  
  stunState.stunRemaining -= deltaTime;
  
  if (stunState.stunRemaining <= 0) {
    stunState.isStunned.set(false);
    stunState.value.set(0);
    stunState.stunRemaining = 0;
    return true;
  }
  
  return false;
}

/**
 * End stun state immediately
 */
export function endStun(stunState: StunState): void {
  stunState.isStunned.set(false);
  stunState.value.set(0);
  stunState.stunRemaining = 0;
}

/**
 * Check if stun should be triggered based on meter value
 */
export function shouldTriggerStun(stunState: StunState): boolean {
  return stunState.value() >= STUN_METER_MAX && !stunState.isStunned();
}
