// ============================================
// Fighter Input - Local/Remote Input Mapping
// ============================================

import { FighterState, HitZone } from './types';
import type { FighterController } from './fighter-controller';

export interface InputState {
  moveDir: 'left' | 'right' | 'none';
  jump: boolean;
  attack: 'none' | 'light' | 'heavy' | 'special';
  block: 'none' | 'top' | 'center' | 'bottom';
  run: boolean;
}

/**
 * Maps input state to fighter actions.
 * Used for both local and remote input handling.
 */
export class FighterInput {
  constructor(private ctrl: FighterController) {}
  
  /**
   * Apply complete input state at once.
   * Maps input → actions exactly like local InputHandler.
   */
  applyInput(input: InputState): void {
    if (this.ctrl.state === FighterState.Dead) return;
    
    // 0. Run modifier
    if (input.run && !this.ctrl.isRunning) {
      this.ctrl.run();
    } else if (!input.run && this.ctrl.isRunning) {
      this.ctrl.walk(this.ctrl.inCombat);
    }
    
    // 1. Movement: facing always, then move
    if (input.moveDir !== 'none') {
      this.ctrl.setFacing(input.moveDir);
      this.ctrl.move(input.moveDir);
    } else if (this.ctrl.moveDirection !== 'none') {
      this.ctrl.stopMove();
    }
    
    // 2. Jump (one-shot trigger)
    if (input.jump) {
      this.ctrl.jump();
    }
    
    // 3. Attacks (one-shot trigger)
    if (input.attack === 'light') {
      this.ctrl.attackLight();
    } else if (input.attack === 'heavy') {
      this.ctrl.attackHeavy();
    } else if (input.attack === 'special') {
      this.ctrl.special();
    }
    
    // 4. Blocking (hold action)
    if (input.block !== 'none') {
      this.ctrl.block(input.block as HitZone);
    } else if (this.ctrl.isBlocking) {
      this.ctrl.unblock();
    }
  }
}
