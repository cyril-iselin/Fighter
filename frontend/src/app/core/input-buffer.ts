// ============================================================================
// INPUT BUFFER SYSTEM
// Deterministic input buffering for responsive gameplay
// ============================================================================

import type { AttackCommand } from './types';

/**
 * Buffered attack input with tick timestamp
 */
export interface BufferedInput {
  command: AttackCommand;
  tickPressed: number;      // When was it pressed
  expiresAtTick: number;    // When does it expire (tickPressed + bufferWindow)
}

/**
 * Input Buffer Manager (per fighter)
 * Stores attack inputs that were pressed during non-cancelable windows
 */
export class InputBuffer {
  private buffer: BufferedInput | null = null;

  /**
   * Store an attack input with expiration time
   * Overwrites previous buffer (latest input wins)
   */
  store(command: AttackCommand, currentTick: number, bufferWindowTicks: number): void {
    this.buffer = {
      command,
      tickPressed: currentTick,
      expiresAtTick: currentTick + bufferWindowTicks,
    };
  }

  /**
   * Check if buffer has valid input at current tick
   * Returns command if valid, null otherwise
   */
  peek(currentTick: number): AttackCommand | null {
    if (!this.buffer) return null;
    if (currentTick > this.buffer.expiresAtTick) {
      this.buffer = null; // Expired, clear
      return null;
    }
    return this.buffer.command;
  }

  /**
   * Consume buffered input (clears it)
   * Returns command if valid, null otherwise
   */
  consume(currentTick: number): AttackCommand | null {
    const command = this.peek(currentTick);
    if (command) {
      this.buffer = null; // Clear after consuming
    }
    return command;
  }

  /**
   * Clear buffer (e.g., when hit or state changes)
   */
  clear(): void {
    this.buffer = null;
  }

  /**
   * Debug: check if buffer is active
   */
  hasBuffer(): boolean {
    return this.buffer !== null;
  }
}
