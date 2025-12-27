// ============================================================================
// BUFFER MANAGER
// Manages input buffers for both fighters in a match
// ============================================================================

import { InputBuffer } from './input-buffer';

/**
 * Global buffer manager for a match (non-serialized, lives in step context)
 * Stores buffers for both fighters
 */
export class BufferManager {
  private buffers: [InputBuffer, InputBuffer];

  constructor() {
    this.buffers = [new InputBuffer(), new InputBuffer()];
  }

  /**
   * Get buffer for specific fighter
   */
  getBuffer(fighterId: 0 | 1): InputBuffer {
    return this.buffers[fighterId];
  }

  /**
   * Clear all buffers (e.g., round reset)
   */
  clearAll(): void {
    this.buffers[0].clear();
    this.buffers[1].clear();
  }
}
