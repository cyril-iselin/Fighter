import type { Intent, HitZone } from '../core/types';

// ============================================================================
// INPUT CONFIGURATION (Central Keymap)
// ============================================================================

export const INPUT_CONFIG = {
  // Movement
  MOVE_LEFT: ['KeyA'],
  MOVE_RIGHT: ['KeyD'],
  JUMP: ['Space'],
  RUN: ['ShiftLeft', 'ShiftRight'],

  // Combat
  LIGHT_ATTACK: 'mouse0',  // LMB
  HEAVY_ATTACK_HOLD_MS: 200,  // Hold threshold for heavy attack
  BLOCK: 'mouse2',  // RMB
  SPECIAL: ['KeyF'],

  // Block zones (mouse delta thresholds)
  BLOCK_ZONE_THRESHOLD: 20,  // pixels mouse must move for zone change
} as const;

// ============================================================================
// ENHANCED INPUT HANDLER (Mouse + Keyboard)
// ============================================================================

/**
 * Enhanced Input Handler with mouse support
 * - LMB: light attack (tap) or heavy attack (hold >200ms)
 * - RMB: block with mouse delta for zones (up=top, down=bottom, none=center)
 * - Keyboard: movement, jump, run, special
 */
export class InputHandler {
  private pressedKeys = new Set<string>();
  private mouseButtons = new Set<number>();

  // Mouse tracking
  private mouseX = 0;
  private mouseY = 0;
  private blockStartY = 0;
  private blockZone: HitZone = 'center';  // Stable block zone

  // Attack hold tracking
  private lmbPressTime = 0;
  private lmbPressed = false;
  private heavyFired = false;  // Prevents multiple heavy triggers per press
  private lmbReleased = false;

  constructor() {
    this.setupListeners();
  }

  /**
   * Reset all input state (call on game reset/restart)
   */
  reset(): void {
    this.pressedKeys.clear();
    this.mouseButtons.clear();
    this.lmbPressed = false;
    this.lmbReleased = false;
    this.heavyFired = false;
    this.blockZone = 'center';
  }

  /**
   * Gets current Intent based on inputs
   */
  getIntent(): Intent {
    const intent: Intent = {
      move: 'none',
      attack: null,
      block: null,
      jump: false,
      run: false,
    };

    // === MOVEMENT ===
    intent.run = this.isKeyPressed(...INPUT_CONFIG.RUN);

    if (this.isKeyPressed(...INPUT_CONFIG.MOVE_LEFT)) {
      intent.move = 'left';
    } else if (this.isKeyPressed(...INPUT_CONFIG.MOVE_RIGHT)) {
      intent.move = 'right';
    }

    // === JUMP ===
    if (this.isKeyPressed(...INPUT_CONFIG.JUMP)) {
      intent.jump = true;
    }

    // === BLOCK (RMB) ===
    if (this.isMousePressed(2)) {  // RMB
      intent.block = this.blockZone;  // Use stable zone
    }

    // === ATTACK ===
    // Special (F key, highest priority)
    if (this.isKeyPressed(...INPUT_CONFIG.SPECIAL)) {
      intent.attack = 'special';
    }
    // Heavy attack: charge while holding (legacy pattern)
    else if (this.lmbPressed && !this.heavyFired) {
      const holdDuration = performance.now() - this.lmbPressTime;
      if (holdDuration >= INPUT_CONFIG.HEAVY_ATTACK_HOLD_MS) {
        intent.attack = 'heavy';
        this.heavyFired = true;  // Fire only once per press
      }
    }
    // Light attack: quick tap (decided on release)
    else if (this.lmbReleased && !this.heavyFired) {
      intent.attack = 'light';
      this.lmbReleased = false;  // Consume the release
    }

    return intent;
  }

  /**
   * Cleans up event listeners
   */
  dispose(): void {
    this.reset();  // Clear state flags
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('contextmenu', this.handleContextMenu);
  }

  // ============================================================================
  // PRIVATE
  // ============================================================================

  private setupListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('contextmenu', this.handleContextMenu);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.pressedKeys.add(e.code);

    // Prevent default for game keys
    const allGameKeys: string[] = [
      ...INPUT_CONFIG.MOVE_LEFT,
      ...INPUT_CONFIG.MOVE_RIGHT,
      ...INPUT_CONFIG.JUMP,
      ...INPUT_CONFIG.RUN,
      ...INPUT_CONFIG.SPECIAL,
    ];

    if (allGameKeys.includes(e.code)) {
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.pressedKeys.delete(e.code);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    this.mouseButtons.add(e.button);

    // Track LMB press time for hold detection
    if (e.button === 0) {
      this.lmbPressTime = performance.now();
      this.lmbPressed = true;
      this.heavyFired = false;  // Reset flag for new press
      this.lmbReleased = false;
    }

    // Track RMB start position for block zone
    if (e.button === 2) {
      this.blockStartY = e.clientY;
      this.blockZone = 'center';  // Reset to center on new block
    }

    e.preventDefault();
  };

  private handleMouseUp = (e: MouseEvent): void => {
    this.mouseButtons.delete(e.button);

    // Trigger attack decision on LMB release (if heavy wasn't already fired)
    if (e.button === 0) {
      this.lmbPressed = false;
      if (!this.heavyFired) {
        this.lmbReleased = true;
      }
    }

    // Reset block zone when RMB released
    if (e.button === 2) {
      this.blockZone = 'center';
    }

    e.preventDefault();
  };

  private handleMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    // Update block zone during RMB hold based on mouse delta
    if (this.isMousePressed(2)) {
      const deltaY = e.clientY - this.blockStartY;
      const threshold = INPUT_CONFIG.BLOCK_ZONE_THRESHOLD;

      if (deltaY < -threshold) {
        this.blockZone = 'top';
      } else {
        this.blockZone = 'center';
      }
    }
  };

  private handleBlur = (): void => {
    // Clear all inputs when window loses focus
    this.pressedKeys.clear();
    this.mouseButtons.clear();
    this.lmbReleased = false;
    this.blockZone = 'center';
  };

  private handleContextMenu = (e: Event): void => {
    // Prevent right-click menu
    e.preventDefault();
  };

  private isKeyPressed(...codes: string[]): boolean {
    return codes.some(code => this.pressedKeys.has(code));
  }

  private isMousePressed(button: number): boolean {
    return this.mouseButtons.has(button);
  }
}
