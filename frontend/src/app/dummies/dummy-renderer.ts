// ============================================================================
// DUMMY RENDERER
// ============================================================================
// Canvas 2D based spritesheet animator for dummy characters
// Renders animated dummies with hitbox visualization
// ============================================================================

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
   * Clear all instances
   */
  clearInstances(): void {
    this.instances = [];
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
  
  /**
   * Update all dummy instances
   * @param deltaTime Time since last frame in seconds
   */
  update(deltaTime: number): void {
    for (const instance of this.instances) {
      this.updateInstance(instance, deltaTime);
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
    if (instance.frameTimer >= frameDuration) {
      instance.frameTimer -= frameDuration;
      instance.currentFrame = (instance.currentFrame + 1) % frameCount;
    }
    
    // Update position if moving
    if (instance.isMoving) {
      instance.x += definition.speed * instance.facing * deltaTime;
      
      // Wrap around screen
      const margin = 100;
      if (instance.x > this.DESIGN_WIDTH + margin) {
        instance.x = -margin;
      } else if (instance.x < -margin) {
        instance.x = this.DESIGN_WIDTH + margin;
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
   * Render all dummy instances
   */
  render(): void {
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
    
    // Render each instance
    for (const instance of this.instances) {
      this.renderInstance(instance);
    }
    
    // Restore context
    this.ctx.restore();
  }
  
  /**
   * Render a single dummy instance
   */
  private renderInstance(instance: DummyInstance): void {
    const assets = this.assetsCache.get(instance.definition.id);
    if (!assets) return;
    
    const { definition } = instance;
    const frameData = assets.frames[instance.currentFrame];
    if (!frameData) return;
    
    const { frame: atlasFrame } = frameData;
    const { spriteSourceSize, sourceSize } = atlasFrame;
    
    // Calculate ground position (from bottom)
    const groundY = this.DESIGN_HEIGHT - this.GROUND_Y;
    
    // Apply scale
    const renderScale = definition.scale;
    const scaledWidth = sourceSize.w * renderScale;
    const scaledHeight = sourceSize.h * renderScale;
    
    // Position (x is center, y is bottom)
    const renderX = instance.x - scaledWidth / 2;
    const renderY = groundY - scaledHeight;
    
    // Save for sprite transform
    this.ctx.save();
    
    // Flip if facing left
    if (instance.facing < 0) {
      this.ctx.translate(instance.x, 0);
      this.ctx.scale(-1, 1);
      this.ctx.translate(-instance.x, 0);
    }
    
    // Draw sprite
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
      this.renderHitbox(instance, groundY, renderScale);
    }
  }
  
  /**
   * Render hitbox overlay for a dummy
   */
  private renderHitbox(instance: DummyInstance, groundY: number, renderScale: number): void {
    const { hitbox } = instance.definition;
    
    // Calculate hitbox position
    const hitboxWidth = hitbox.width * renderScale;
    const hitboxHeight = hitbox.height * renderScale;
    const offsetX = (hitbox.offsetX ?? 0) * renderScale;
    const offsetY = (hitbox.offsetY ?? 0) * renderScale;
    
    const hitboxX = instance.x - hitboxWidth / 2 + offsetX;
    const hitboxY = groundY - hitboxHeight - offsetY;
    
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
