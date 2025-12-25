// ============================================
// Timer Bag - Centralized Timeout Management
// ============================================

/**
 * Manages named timeouts with easy cleanup.
 * Prevents memory leaks and forgotten clearTimeout calls.
 */
export class TimerBag {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  
  /**
   * Set a named timeout. Automatically clears any existing timer with the same name.
   */
  set(name: string, fn: () => void, ms: number): void {
    this.clear(name);
    this.timers.set(name, setTimeout(() => {
      this.timers.delete(name);
      fn();
    }, ms));
  }
  
  /**
   * Clear a specific timer by name.
   */
  clear(name: string): void {
    const timer = this.timers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(name);
    }
  }
  
  /**
   * Clear all timers.
   */
  clearAll(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
  
  /**
   * Check if a timer is currently active.
   */
  has(name: string): boolean {
    return this.timers.has(name);
  }
  
  /**
   * Clear timers matching a prefix (for subsystem cleanup)
   */
  clearByPrefix(prefix: string): void {
    for (const [name, timer] of this.timers.entries()) {
      if (name.startsWith(prefix)) {
        clearTimeout(timer);
        this.timers.delete(name);
      }
    }
  }
}

// Timer name constants - namespaced by subsystem
export const TIMER = {
  // Combat timers
  ATTACK_HITBOX: 'combat.attackHitbox',
  TELEGRAPH: 'combat.telegraph',
  CHARGE_WINDUP: 'combat.chargeWindup',
  CHARGE_EXECUTE: 'combat.chargeExecute',
  SPECIAL_DURATION: 'combat.specialDuration',
  
  // Animation timers
  IDLE_TRANSITION: 'anim.idleTransition',
  
  // Movement timers
  JUMP: 'movement.jump',
  
  // AI timers (for AI-controlled fighters)
  AI_BLOCK_RELEASE: 'ai.blockRelease',
  AI_TELEGRAPH_EXECUTE: 'ai.telegraphExecute',
  AI_ATTACK_RECOVERY: 'ai.attackRecovery',
  AI_RETREAT_STOP: 'ai.retreatStop',
} as const;

// Prefixes for subsystem cleanup
export const TIMER_PREFIX = {
  COMBAT: 'combat.',
  ANIM: 'anim.',
  MOVEMENT: 'movement.',
  AI: 'ai.',
} as const;
