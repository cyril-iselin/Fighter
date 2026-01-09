// ============================================================================
// DUMMY RENDERER
// ============================================================================
// Canvas 2D based spritesheet animator for dummy characters
// Renders animated dummies with hitbox visualization
// ============================================================================

import { GROUND_Y } from '../adapters/spine-bone-transform';
import { SpineRenderer } from '../adapters/spine-renderer';
import { PHYSICS } from '../core/config';
import type { 
  DummyDefinition, 
  AtlasData, 
  AtlasFrame 
} from './dummy-registry';
import { 
  loadAtlas, 
  loadSpritesheet, 
  getAnimationFrames,
  getDummy
} from './dummy-registry';

/**
 * Runtime state for an active dummy instance
 */
export interface DummyInstance {
  id: string;
  definition: DummyDefinition;
  
  // Position (game coordinates)
  x: number;
  y: number;
  
  // Direction: 1 = right, -1 = left
  facing: number;
  
  // Animation state
  currentFrame: number;
  frameTimer: number;
  
  // Movement
  isMoving: boolean;
}

/**
 * Loaded assets for a dummy type
 */
interface LoadedDummyAssets {
  spritesheet: HTMLImageElement;
  atlas: AtlasData;
  frames: Array<{ name: string; frame: AtlasFrame }>;
}

/**
 * DummyRenderer - Canvas 2D spritesheet animation renderer
 */
export class DummyRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // Loaded assets cache (by dummy ID)
  private assetsCache = new Map<string, LoadedDummyAssets>();
  
  // Active dummy instances
  private instances: DummyInstance[] = [];
  
  // Design dimensions (match Spine renderer)
  private readonly DESIGN_WIDTH = 1920;
  private readonly DESIGN_HEIGHT = 1080;
  private readonly GROUND_Y = 250;  // Y position of ground from bottom
  
  // Arena bounds (for bounce behavior during events)
  private arenaBoundsEnabled = false;
  private arenaBounds = { minX: -500, maxX: 500 }; // Default bounds
  
  // Debug options
  private showHitboxes = true;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
  }
  
  // ============================================================================
  // Asset Loading
  // ============================================================================
  
  /**
   * Preload assets for a dummy type
   */
  async loadDummy(dummyId: string): Promise<void> {
    if (this.assetsCache.has(dummyId)) {
      return; // Already loaded
    }
    
    const definition = getDummy(dummyId);
    if (!definition) {
      throw new Error(`Unknown dummy: ${dummyId}`);
    }
    
    console.log(`[DummyRenderer] Loading dummy: ${definition.name}`);
    
    // Load atlas and spritesheet in parallel
    const [atlas, spritesheet] = await Promise.all([
      loadAtlas(definition.atlasPath),
      loadSpritesheet(definition.spritesheetPath)
    ]);
    
    // Extract animation frames (all frames, sorted numerically)
    const frames = getAnimationFrames(atlas);
    
    if (frames.length === 0) {
      throw new Error(`No frames found in atlas: ${definition.atlasPath}`);
    }
    
    console.log(`[DummyRenderer] Loaded ${frames.length} frames for ${definition.name}`);
    
    this.assetsCache.set(dummyId, { spritesheet, atlas, frames });
  }
  
  /**
   * Check if a dummy's assets are loaded
   */
  isLoaded(dummyId: string): boolean {
    return this.assetsCache.has(dummyId);
  }
  
  // ============================================================================
  // Instance Management
  // ============================================================================
  
  /**
   * Spawn a new dummy instance
   */
  spawnDummy(dummyId: string, x: number, y: number, facing: number = 1): DummyInstance {
    const definition = getDummy(dummyId);
    if (!definition) {
      throw new Error(`Unknown dummy: ${dummyId}`);
    }
    
    if (!this.assetsCache.has(dummyId)) {
      throw new Error(`Dummy assets not loaded: ${dummyId}`);
    }
    
    const instance: DummyInstance = {
      id: `${dummyId}_${Date.now()}`,
      definition,
      x,
      y,
      facing,
      currentFrame: 0,
      frameTimer: 0,
      isMoving: true
    };
    
    this.instances.push(instance);
    console.log('[DummyRenderer] Spawned instance, total count:', this.instances.length, 'id:', instance.id);
    return instance;
  }
  
  /**
   * Remove a dummy instance
   */
  removeDummy(instance: DummyInstance): void {
    const index = this.instances.indexOf(instance);
    if (index >= 0) {
      this.instances.splice(index, 1);
    }
  }
  
  /**
   * Clear all instances and canvas
   */
  clearInstances(): void {
    console.log('[DummyRenderer] Clearing instances, count:', this.instances.length);
    this.instances = [];
    // Clear canvas immediately to remove any rendered dummies
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  /**
   * Get all active instances
   */
  getInstances(): DummyInstance[] {
    return this.instances;
  }
  
  // ============================================================================
  // Update & Animation
  // ============================================================================
  
  // Maximum delta time to prevent animation jumps when tab is in background
  private readonly MAX_DELTA_TIME = 0.1;  // 100ms max (prevents jumps after tab switch)
  
  /**
   * Update all dummy instances
   * @param deltaTime Time since last frame in seconds
   */
  update(deltaTime: number): void {
    // Clamp deltaTime to prevent huge jumps after tab was in background
    const clampedDelta = Math.min(deltaTime, this.MAX_DELTA_TIME);
    
    for (const instance of this.instances) {
      this.updateInstance(instance, clampedDelta);
    }
  }
  
  /**
   * Update a single dummy instance
   */
  private updateInstance(instance: DummyInstance, deltaTime: number): void {
    const assets = this.assetsCache.get(instance.definition.id);
    if (!assets) return;
    
    const { definition } = instance;
    const frameCount = definition.animation.frameCount ?? assets.frames.length;
    const frameDuration = 1 / definition.animation.frameRate;
    
    // Update animation frame
    instance.frameTimer += deltaTime;
    // Use while loop to handle multiple frame skips properly, but with clamped deltaTime
    // this should only trigger once per update
    while (instance.frameTimer >= frameDuration) {
      instance.frameTimer -= frameDuration;
      instance.currentFrame = (instance.currentFrame + 1) % frameCount;
    }
    
    // Update position if moving
    if (instance.isMoving) {
      instance.x += definition.speed * instance.facing * deltaTime;
      
      if (this.arenaBoundsEnabled) {
        // Bounce at arena bounds (for events)
        if (instance.x > this.arenaBounds.maxX) {
          instance.x = this.arenaBounds.maxX;
          instance.facing = -1; // Flip to face left
        } else if (instance.x < this.arenaBounds.minX) {
          instance.x = this.arenaBounds.minX;
          instance.facing = 1; // Flip to face right
        }
      } else {
        // Wrap around screen (for test mode)
        const margin = 100;
        if (instance.x > this.DESIGN_WIDTH + margin) {
          instance.x = -margin;
        } else if (instance.x < -margin) {
          instance.x = this.DESIGN_WIDTH + margin;
        }
      }
    }
  }
  
  // ============================================================================
  // Rendering
  // ============================================================================
  
  /**
   * Set hitbox visibility
   */
  setShowHitboxes(show: boolean): void {
    this.showHitboxes = show;
  }

  /**
   * Enable arena bounds (for bounce behavior during events)
   */
  setArenaBounds(enabled: boolean, minX?: number, maxX?: number): void {
    this.arenaBoundsEnabled = enabled;
    if (minX !== undefined && maxX !== undefined) {
      this.arenaBounds = { minX, maxX };
    }
  }
  
  /**
   * Render all dummy instances
   * @param cameraLeft Optional camera left position for world-to-screen conversion
   */
  render(cameraLeft: number = 0): void {
    // Always clear canvas first (even if no instances, to remove old pixels)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // If no instances, nothing to render
    if (this.instances.length === 0) {
      return;
    }

    // Get actual canvas size
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // Calculate scale to fit design dimensions
    const scaleX = canvasWidth / this.DESIGN_WIDTH;
    const scaleY = canvasHeight / this.DESIGN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    // Calculate offset to center
    const offsetX = (canvasWidth - this.DESIGN_WIDTH * scale) / 2;
    const offsetY = (canvasHeight - this.DESIGN_HEIGHT * scale) / 2;
    
    // Save context state
    this.ctx.save();
    
    // Apply viewport transform
    this.ctx.translate(offsetX, offsetY);
    this.ctx.scale(scale, scale);
    
    // Render each instance with camera offset
    for (const instance of this.instances) {
      this.renderInstance(instance, cameraLeft);
    }
    
    // Restore context
    this.ctx.restore();
  }
  
  /**
   * Render a single dummy instance
   * NOTE: Rotation is NOT supported - export spritesheets with "Allow rotation = OFF"
   */
  private renderInstance(instance: DummyInstance, cameraLeft: number = 0): void {
    const assets = this.assetsCache.get(instance.definition.id);
    if (!assets) return;
    
    const { definition } = instance;
    const frameData = assets.frames[instance.currentFrame];
    if (!frameData) return;
    
    const { frame: atlasFrame } = frameData;
    const { spriteSourceSize, sourceSize } = atlasFrame;
    
    // Apply scale
    const renderScale = definition.scale;
    const scaledWidth = sourceSize.w * renderScale;
    const scaledHeight = sourceSize.h * renderScale;
    
    // Convert Spine world Y to canvas Y (Y+ is down in canvas, up in Spine)
    const groundLineY = this.DESIGN_HEIGHT - GROUND_Y; // z.B. 830
    const canvasY = groundLineY + instance.y;;
    
    // Position (x is center, y is bottom) - convert from world to screen coordinates
    const screenX = instance.x - cameraLeft;
    const renderX = screenX - scaledWidth / 2;
    const renderY = canvasY - scaledHeight;
    
    // Save for sprite transform
    this.ctx.save();
    
    // Calculate effective facing: combine instance facing with definition flipX
    const baseFlip = definition.flipX ? -1 : 1;
    const effectiveFacing = instance.facing * baseFlip;
    
    // Flip if facing left (or if sprite needs horizontal flip)
    if (effectiveFacing < 0) {
      this.ctx.translate(screenX, 0);
      this.ctx.scale(-1, 1);
      this.ctx.translate(-screenX, 0);
    }
    
    // Source rectangle (from spritesheet)
    const sx = atlasFrame.frame.x;
    const sy = atlasFrame.frame.y;
    const sw = atlasFrame.frame.w;
    const sh = atlasFrame.frame.h;
    
    // Handle trimmed sprites - offset within source size
    const trimOffsetX = spriteSourceSize.x * renderScale;
    const trimOffsetY = spriteSourceSize.y * renderScale;
    
    // Destination rectangle
    const dx = renderX + trimOffsetX;
    const dy = renderY + trimOffsetY;
    const dw = sw * renderScale;
    const dh = sh * renderScale;
    
    this.ctx.drawImage(
      assets.spritesheet,
      sx, sy, sw, sh,
      dx, dy, dw, dh
    );
    
    this.ctx.restore();
    
    // Draw hitbox if enabled
    if (this.showHitboxes) {
      this.renderHitbox(instance, cameraLeft, canvasY, renderScale);
    }
  }
  
  /**
   * Render hitbox overlay for a dummy
   */
  private renderHitbox(instance: DummyInstance, cameraLeft: number, canvasY: number, renderScale: number): void {
    const { hitbox } = instance.definition;
    
    // Calculate hitbox position (in screen coordinates, same as sprite)
    const screenX = instance.x - cameraLeft;
    const hitboxWidth = hitbox.width * renderScale;
    const hitboxHeight = hitbox.height * renderScale;
    const offsetX = (hitbox.offsetX ?? 0) * renderScale;
    const offsetY = (hitbox.offsetY ?? 0) * renderScale;
    
    const hitboxX = screenX - hitboxWidth / 2 + offsetX;
    const hitboxY = canvasY - hitboxHeight - offsetY;
    
    // Draw hitbox rectangle
    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(hitboxX, hitboxY, hitboxWidth, hitboxHeight);
    
    // Fill with semi-transparent red
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    this.ctx.fillRect(hitboxX, hitboxY, hitboxWidth, hitboxHeight);
  }
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  /**
   * Dispose renderer and release resources
   */
  dispose(): void {
    this.instances = [];
    this.assetsCache.clear();
  }
}
