// ============================================
// Input Handler - Keyboard & Mouse Input Management
// ============================================

import { FighterController } from './fighter-controller';
import { HitZone } from './types';

// Callback für Netzwerk-Input (lokale Eingabe an Server senden)
export interface LocalInputState {
  moveDir: 'left' | 'right' | 'none';
  jump: boolean;
  attack: 'none' | 'light' | 'heavy' | 'special';
  block: 'none' | 'top' | 'center' | 'bottom';
  run: boolean;
}

export type InputCallback = (input: LocalInputState) => void;

export interface KeyBindings {
  // Movement
  moveLeft: string;
  moveRight: string;
  jump: string;
  run: string;
  
  // Combat
  // Light attack: Mouse Left (click)
  // Heavy attack: Mouse Left (hold)
  // Block: Mouse Right (hold)
  special: string;
}

// Default bindings for Player 1 (A/D movement, Space jump, Shift run)
export const PLAYER1_BINDINGS: KeyBindings = {
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  run: 'ShiftLeft',
  special: 'KeyF'
};

// Mouse movement tracking for block zone switching
interface MouseState {
  lastY: number;
  currentY: number;
  movingUp: boolean;
}

export class InputHandler {
  private player: FighterController;
  private bindings: KeyBindings;
  private keysPressed: Set<string> = new Set();
  private onInput: InputCallback | null = null;
  
  // State tracking for hold actions
  private isHoldingBlock: boolean = false;
  private currentBlockZone: HitZone = 'center';
  private isHoldingRun: boolean = false;
  
  // Mouse state for block zone detection
  private mouseState: MouseState = {
    lastY: 0,
    currentY: 0,
    movingUp: false
  };
  
  // Mouse movement threshold for zone switch (lower = more sensitive)
  private readonly MOUSE_MOVE_THRESHOLD = 15;
  private mouseMovementAccumulator: number = 0;
  
  // Left mouse button hold detection for heavy attack
  private leftMouseDownTime: number = 0;
  private leftMouseHeld: boolean = false;
  private heavyChargeTimer: ReturnType<typeof setTimeout> | null = null;
  private heavyChargeStarted: boolean = false;
  private readonly HEAVY_ATTACK_THRESHOLD_MS = 150; // Hold 150ms to trigger heavy charge
  
  // Current input state (für Netzwerk-Sync)
  private currentInput: LocalInputState = {
    moveDir: 'none',
    jump: false,
    attack: 'none',
    block: 'none',
    run: false
  };
  
  constructor(player: FighterController, bindings: KeyBindings, onInput?: InputCallback) {
    this.player = player;
    this.bindings = bindings;
    this.onInput = onInput || null;
  }
  
  private sendInput(changes: Partial<LocalInputState>): void {
    // Update current state
    Object.assign(this.currentInput, changes);
    
    // Callback für Netzwerk
    if (this.onInput) {
      this.onInput({ ...this.currentInput });
    }
    
    // Reset one-shot inputs nach dem Senden
    if (changes.jump) {
      this.currentInput.jump = false;
    }
    if (changes.attack && changes.attack !== 'none') {
      this.currentInput.attack = 'none';
    }
  }
  
  handleKeyDown(code: string): void {
    if (this.keysPressed.has(code)) return;
    this.keysPressed.add(code);
    
    const b = this.bindings;
    
    // Movement - setFacing() wird IMMER aufgerufen (auch während Attack/Jump)
    if (code === b.moveLeft) {
      this.player.setFacing('left');
      this.player.move('left');
      this.sendInput({ moveDir: 'left' });
    } else if (code === b.moveRight) {
      this.player.setFacing('right');
      this.player.move('right');
      this.sendInput({ moveDir: 'right' });
    }
    
    // Run modifier (Shift)
    if (code === b.run || code === 'ShiftRight') {
      this.isHoldingRun = true;
      this.player.run();
      this.sendInput({ run: true });
    }
    
    // Jump (Space)
    if (code === b.jump) {
      this.player.jump('A');
      this.sendInput({ jump: true });
    }
    
    // Special attack (F)
    if (code === b.special) {
      this.player.special();
      this.sendInput({ attack: 'special' });
    }
  }
  
  handleKeyUp(code: string): void {
    this.keysPressed.delete(code);
    
    const b = this.bindings;
    
    // Stop movement
    if (code === b.moveLeft || code === b.moveRight) {
      const leftHeld = this.keysPressed.has(b.moveLeft);
      const rightHeld = this.keysPressed.has(b.moveRight);
      
      if (code === b.moveLeft && rightHeld) {
        this.player.move('right');
        this.sendInput({ moveDir: 'right' });
      } else if (code === b.moveRight && leftHeld) {
        this.player.move('left');
        this.sendInput({ moveDir: 'left' });
      } else if (!leftHeld && !rightHeld) {
        this.player.stopMove();
        this.sendInput({ moveDir: 'none' });
      }
    }
    
    // Stop run
    if (code === b.run || code === 'ShiftRight') {
      this.isHoldingRun = false;
      this.sendInput({ run: false });
      if (this.player.getMoveDirection() !== 'none') {
        this.player.walk(this.player.isInCombat());
      }
    }
  }
  
  // Mouse button handlers
  handleMouseDown(button: number): void {
    // Left click (0) = Start tracking for light/heavy attack
    if (button === 0) {
      this.leftMouseDownTime = performance.now();
      this.leftMouseHeld = true;
      this.heavyChargeStarted = false;
      
      // Both loadouts now have visual charge-up - start immediately after threshold
      this.heavyChargeTimer = setTimeout(() => {
        if (this.leftMouseHeld && !this.heavyChargeStarted) {
          this.heavyChargeStarted = true;
          // Start heavy attack immediately (will charge and auto-execute)
          this.player.attackHeavy();
          this.sendInput({ attack: 'heavy' });
        }
      }, this.HEAVY_ATTACK_THRESHOLD_MS);
    }
    // Right click (2) = Block
    else if (button === 2) {
      this.isHoldingBlock = true;
      this.currentBlockZone = 'center'; // Default to body block
      this.mouseMovementAccumulator = 0;
      this.player.block(this.currentBlockZone);
      this.sendInput({ block: this.currentBlockZone });
    }
  }
  
  handleMouseUp(button: number): void {
    // Left click release
    if (button === 0 && this.leftMouseHeld) {
      this.leftMouseHeld = false;
      
      // Clear the charge timer if it hasn't fired yet
      if (this.heavyChargeTimer) {
        clearTimeout(this.heavyChargeTimer);
        this.heavyChargeTimer = null;
      }
      
      // If heavy charge already started, do nothing (attack will auto-execute)
      if (this.heavyChargeStarted) {
        this.heavyChargeStarted = false;
        return;
      }
      
      // Quick click = Light Attack (both loadouts)
      this.player.attackLight();
      this.sendInput({ attack: 'light' });
    }
    // Right click release = Stop blocking
    else if (button === 2) {
      this.isHoldingBlock = false;
      this.currentBlockZone = 'center';
      this.player.unblock();
      this.sendInput({ block: 'none' });
    }
  }
  
  handleMouseMove(movementY: number, clientY: number): void {
    // Only process if blocking
    if (!this.isHoldingBlock) {
      // Just track position when not blocking
      this.mouseState.currentY = clientY;
      return;
    }
    
    // Calculate delta from last position (works without pointer lock)
    const deltaY = this.mouseState.currentY - clientY; // positive = moved up
    this.mouseState.lastY = this.mouseState.currentY;
    this.mouseState.currentY = clientY;
    
    // Also use movementY if available (pointer lock mode)
    const movement = movementY !== 0 ? -movementY : deltaY;
    
    // Accumulate mouse movement
    this.mouseMovementAccumulator += movement;
    
    // Check if we've moved enough to switch zones
    if (this.mouseMovementAccumulator > this.MOUSE_MOVE_THRESHOLD) {
      // Mouse moved up significantly - switch to head block
      if (this.currentBlockZone !== 'top') {
        this.currentBlockZone = 'top';
        this.player.block(this.currentBlockZone);
        this.sendInput({ block: 'top' });
        console.log('[InputHandler] Switched to HEAD block');
      }
    } else if (this.mouseMovementAccumulator < -this.MOUSE_MOVE_THRESHOLD) {
      // Mouse moved down significantly - switch back to body block
      if (this.currentBlockZone !== 'center') {
        this.currentBlockZone = 'center';
        this.player.block(this.currentBlockZone);
        this.sendInput({ block: 'center' });
        console.log('[InputHandler] Switched to BODY block');
      }
    }
    
    // Clamp accumulator to prevent extreme values
    this.mouseMovementAccumulator = Math.max(-100, Math.min(100, this.mouseMovementAccumulator));
  }
  
  // Handle context menu (prevent on right click)
  handleContextMenu(e: Event): void {
    e.preventDefault();
  }
  
  getPressedKeys(): Set<string> {
    return new Set(this.keysPressed);
  }
  
  isBlocking(): boolean {
    return this.isHoldingBlock;
  }
  
  getBlockZone(): HitZone {
    return this.currentBlockZone;
  }
}

// ============================================
// Game Input Manager - Coordinates all players
// ============================================

export class GameInputManager {
  private handlers: Map<number, InputHandler> = new Map();
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundContextMenu: (e: Event) => void;
  
  // Pointer lock handlers (stored for cleanup)
  private boundCanvasClick: (() => void) | null = null;
  private boundPointerLockChange: (() => void) | null = null;
  
  // Pointer lock state
  private isPointerLocked: boolean = false;
  private canvas: HTMLCanvasElement | null = null;
  
  constructor() {
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);
  }
  
  registerPlayer(
    playerId: number, 
    controller: FighterController, 
    bindings: KeyBindings,
    onInput?: InputCallback
  ): void {
    const handler = new InputHandler(controller, bindings, onInput);
    this.handlers.set(playerId, handler);
  }
  
  unregisterPlayer(playerId: number): void {
    this.handlers.delete(playerId);
  }
  
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }
  
  start(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('contextmenu', this.boundContextMenu);
    
    // Request pointer lock on canvas click for better mouse tracking
    if (this.canvas) {
      // Store bound handlers for cleanup
      this.boundCanvasClick = () => {
        if (!this.isPointerLocked && document.pointerLockElement !== this.canvas) {
          this.canvas?.requestPointerLock();
        }
      };
      this.boundPointerLockChange = () => {
        this.isPointerLocked = document.pointerLockElement === this.canvas;
      };
      
      this.canvas.addEventListener('click', this.boundCanvasClick);
      document.addEventListener('pointerlockchange', this.boundPointerLockChange);
    }
  }
  
  stop(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('contextmenu', this.boundContextMenu);
    
    // Clean up pointer lock listeners
    if (this.canvas && this.boundCanvasClick) {
      this.canvas.removeEventListener('click', this.boundCanvasClick);
    }
    if (this.boundPointerLockChange) {
      document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
    }
    this.boundCanvasClick = null;
    this.boundPointerLockChange = null;
    
    // Exit pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
  
  private onKeyDown(e: KeyboardEvent): void {
    if (this.isGameKey(e.code)) {
      e.preventDefault();
    }
    
    for (const handler of this.handlers.values()) {
      handler.handleKeyDown(e.code);
    }
  }
  
  private onKeyUp(e: KeyboardEvent): void {
    for (const handler of this.handlers.values()) {
      handler.handleKeyUp(e.code);
    }
  }
  
  private onMouseDown(e: MouseEvent): void {
    for (const handler of this.handlers.values()) {
      handler.handleMouseDown(e.button);
    }
  }
  
  private onMouseUp(e: MouseEvent): void {
    for (const handler of this.handlers.values()) {
      handler.handleMouseUp(e.button);
    }
  }
  
  private onMouseMove(e: MouseEvent): void {
    for (const handler of this.handlers.values()) {
      handler.handleMouseMove(e.movementY, e.clientY);
    }
  }
  
  private onContextMenu(e: Event): void {
    e.preventDefault();
    for (const handler of this.handlers.values()) {
      handler.handleContextMenu(e);
    }
  }
  
  private isGameKey(code: string): boolean {
    const gameKeys = [
      'KeyA', 'KeyD',
      'Space', 'KeyF',
      'ShiftLeft', 'ShiftRight'
    ];
    return gameKeys.includes(code);
  }
}
