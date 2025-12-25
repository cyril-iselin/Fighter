// ============================================
// Spine Manager - WebGL Spine Rendering
// Responsibility: Asset loading, instance creation, render loop
// All bone/attachment logic lives in SpineFighterView
// ============================================

import * as spine from '@esotericsoftware/spine-webgl';
import { ParallaxBackground, ParallaxConfig, CITY1_PARALLAX, CITY2_PARALLAX, CITY3_PARALLAX, CITY4_PARALLAX } from './parallax-background';
import { DebugRenderer } from './debug-renderer';
import { FighterController } from './fighter-controller';
import { CustomAtlasAttachmentLoader } from './spine-attachment-loader';
import { SpineFighterView } from './spine-fighter-view';

export const SPINE_ASSETS = {
  json: 'assets/spine/stickman fighter.json',
  atlas: 'assets/spine/stickman fighter.atlas.txt'
};

export { CITY1_PARALLAX, CITY2_PARALLAX, CITY3_PARALLAX, CITY4_PARALLAX } from './parallax-background';
export type { ParallaxConfig } from './parallax-background';

// Re-export SpineInstance from spine-fighter-view
export type { SpineInstance } from './spine-fighter-view';
import type { SpineInstance } from './spine-fighter-view';

// ============================================
// Spine Game Manager
// ============================================

export class SpineGameManager {
  private canvas: HTMLCanvasElement;
  private context!: spine.ManagedWebGLRenderingContext;
  private shader!: spine.Shader;
  private batcher!: spine.PolygonBatcher;
  private mvp: spine.Matrix4 = new spine.Matrix4();
  private skeletonRenderer!: spine.SkeletonRenderer;
  private assetManager!: spine.AssetManager;
  
  private skeletonData!: spine.SkeletonData;
  private skeletons: Map<string, SpineInstance> = new Map();
  
  private lastFrameTime: number = 0;
  private isInitialized: boolean = false;
  private isDisposed: boolean = false;
  
  // Design-Viewport
  private readonly DESIGN_WIDTH = 1920;
  private readonly DESIGN_HEIGHT = 1080;
  private scale: number = 1;
  
  // Parallax Background
  private parallax: ParallaxBackground | null = null;
  private parallaxConfig: ParallaxConfig | null = null;
  
  // Debug Renderer
  private debugRenderer: DebugRenderer | null = null;
  
  // Camera position (for parallax)
  private cameraX: number = 960;
  
  // Camera mode: true = follow only player1 (for PvAI), false = follow center of both (for PvP)
  private cameraFollowPlayerOnly: boolean = false;
  
  // Game update callback
  private onUpdate: ((delta: number) => void) | null = null;
  
  // Post-render callback (for 2D overlays like combat text)
  private onPostRender: (() => void) | null = null;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = new spine.ManagedWebGLRenderingContext(canvas, { alpha: true, premultipliedAlpha: true });
  }
  
  setParallaxConfig(config: ParallaxConfig): void {
    this.parallaxConfig = config;
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    const ctx = this.context;
    const gl = ctx.gl;
    
    this.shader = spine.Shader.newTwoColoredTextured(ctx);
    this.batcher = new spine.PolygonBatcher(ctx);
    this.skeletonRenderer = new spine.SkeletonRenderer(ctx);
    this.skeletonRenderer.premultipliedAlpha = true;
    
    // Setup asset manager
    this.assetManager = new spine.AssetManager(ctx, '');
    
    // Load assets
    this.assetManager.loadText(SPINE_ASSETS.atlas);
    this.assetManager.loadTexture(SPINE_ASSETS.atlas.replace('.atlas.txt', '.png'));
    this.assetManager.loadJson(SPINE_ASSETS.json);
    
    // Wait for assets to load
    await new Promise<void>((resolve, reject) => {
      const checkLoaded = () => {
        if (this.assetManager.isLoadingComplete()) {
          if (this.assetManager.hasErrors()) {
            const errors = this.assetManager.getErrors();
            reject(new Error(String(errors)));
          } else {
            resolve();
          }
        } else {
          requestAnimationFrame(checkLoaded);
        }
      };
      checkLoaded();
    });
    
    // Create TextureAtlas from loaded text
    const atlasText = this.assetManager.require(SPINE_ASSETS.atlas) as string;
    const texture = this.assetManager.require(SPINE_ASSETS.atlas.replace('.atlas.txt', '.png'));
    
    const atlas = new spine.TextureAtlas(atlasText);
    for (const page of atlas.pages) {
      page.setTexture(texture);
    }
      
    // Use custom attachment loader
    const atlasLoader = new CustomAtlasAttachmentLoader(atlas);
    const skeletonJson = new spine.SkeletonJson(atlasLoader);
    skeletonJson.scale = 0.5;
    
    const jsonData = this.assetManager.require(SPINE_ASSETS.json);
    this.skeletonData = skeletonJson.readSkeletonData(jsonData);
    
    // Initialize parallax background if configured
    if (this.parallaxConfig) {
      this.parallax = new ParallaxBackground(ctx.gl, this.parallaxConfig);
      await this.parallax.initialize();
    }
    
    // Initialize debug renderer
    this.debugRenderer = new DebugRenderer(ctx.gl);
        
    this.isInitialized = true;
  }
  
  createFighter(id: string, x: number, y: number, skinName: string = 'black'): SpineInstance {
    if (!this.isInitialized) {
      throw new Error('SpineGameManager not initialized');
    }
    
    // Create skeleton
    const skeleton = new spine.Skeleton(this.skeletonData);
    skeleton.x = x;
    skeleton.y = y;
    skeleton.scaleX = 1;
    skeleton.scaleY = 1;
    
    // Set skin - combine default with color skin
    const newSkin = new spine.Skin('combined');
    const defaultSkin = this.skeletonData.findSkin('default');
    const colorSkin = this.skeletonData.findSkin(skinName);
    
    if (defaultSkin) newSkin.addSkin(defaultSkin);
    if (colorSkin) newSkin.addSkin(colorSkin);
    
    skeleton.setSkin(newSkin);
    skeleton.setToSetupPose();
    
    // Create animation state
    const stateData = new spine.AnimationStateData(skeleton.data);
    stateData.defaultMix = 0.2;
    const state = new spine.AnimationState(stateData);
    
    // Set initial animation
    state.setAnimation(0, '1_/idle', true);
    
    const instance: SpineInstance = {
      id,
      skeleton,
      state,
      bounds: { x: 0, y: 0, width: 0, height: 0 }
    };
    
    // Calculate bounds
    skeleton.updateWorldTransform(spine.Physics.update);
    const offset = new spine.Vector2();
    const size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    instance.bounds = { x: offset.x, y: offset.y, width: size.x, height: size.y };
    
    this.skeletons.set(id, instance);
    
    return instance;
  }
  
  /**
   * Get a SpineFighterView adapter for the given fighter
   * SpineFighterView handles all animation, bone, and attachment logic
   */
  getAdapter(id: string): SpineFighterView {
    const instance = this.skeletons.get(id);
    if (!instance) throw new Error(`Fighter ${id} not found`);
    return new SpineFighterView(instance);
  }
  
  startRenderLoop(): void {
    this.lastFrameTime = performance.now() / 1000;
    
    const render = () => {
      // Stop loop if disposed
      if (this.isDisposed) return;
      
      const now = performance.now() / 1000;
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;
      
      this.update(delta);
      this.render();
      
      requestAnimationFrame(render);
    };
    
    requestAnimationFrame(render);
  }
  
  private update(delta: number): void {
    // Call game update callback first (physics, AI, etc.)
    this.onUpdate?.(delta);
    
    // Update camera to follow fighters
    this.updateCameraFromFighters();
    
    // Update Spine animations
    for (const instance of this.skeletons.values()) {
      instance.state.update(delta);
      instance.state.apply(instance.skeleton);
      instance.skeleton.update(delta);
      instance.skeleton.updateWorldTransform(spine.Physics.update);
    }
  }
  
  /**
   * Set callback for game logic updates (physics, AI, etc.)
   */
  setUpdateCallback(callback: (delta: number) => void): void {
    this.onUpdate = callback;
  }
  
  /**
   * Set callback for post-render operations (2D overlays like damage numbers)
   */
  setPostRenderCallback(callback: () => void): void {
    this.onPostRender = callback;
  }
  
  private render(): void {
    const gl = this.context.gl;
    
    // Guard: check if context is still valid
    if (gl.isContextLost()) {
      console.warn('WebGL context lost, skipping render');
      return;
    }
    
    // Guard: check if shader is valid
    if (!this.shader || !this.isInitialized) {
      return;
    }
    
    this.resize();
    
    // Clear
    gl.clearColor(0.1, 0.1, 0.15, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Setup blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    
    // Berechne Skalierung basierend auf Canvas-Grösse
    const scaleX = this.canvas.width / this.DESIGN_WIDTH;
    const scaleY = this.canvas.height / this.DESIGN_HEIGHT;
    this.scale = Math.min(scaleX, scaleY);
    
    // Zentriere den Viewport
    const scaledWidth = this.DESIGN_WIDTH * this.scale;
    const scaledHeight = this.DESIGN_HEIGHT * this.scale;
    const offsetX = (this.canvas.width - scaledWidth) / 2;
    const offsetY = (this.canvas.height - scaledHeight) / 2;
    
    // Setup MVP matrix - verwende Design-Koordinaten
    // Die ortho2d Projektion mappt Design-Koordinaten auf Pixel
    this.mvp.ortho2d(
      -offsetX / this.scale,
      -offsetY / this.scale,
      this.canvas.width / this.scale,
      this.canvas.height / this.scale
    );
    
    // ============================================
    // 1. Render Parallax Background
    // ============================================
    if (this.parallax) {
      this.parallax.setCameraX(this.cameraX);
      this.parallax.render(this.mvp, this.canvas.width, this.canvas.height, this.scale);
    }
    
    // ============================================
    // 2. Render Spine Characters
    // ============================================
    // Reset blend mode for Spine (uses premultiplied alpha)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    
    this.shader.bind();
    this.shader.setUniformi(spine.Shader.SAMPLER, 0);
    this.shader.setUniform4x4f(spine.Shader.MVP_MATRIX, this.mvp.values);
    
    this.batcher.begin(this.shader);
    
    // Render all skeletons sorted by x position
    const sortedSkeletons = [...this.skeletons.values()].sort((a, b) => a.skeleton.x - b.skeleton.x);
    for (const instance of sortedSkeletons) {
      this.skeletonRenderer.draw(this.batcher, instance.skeleton);
    }
    
    this.batcher.end();
    this.shader.unbind();
    
    // ============================================
    // 3. Render Debug Overlays (if enabled)
    // ============================================
    if (this.debugRenderer) {
      this.debugRenderer.render(this.mvp);
    }
    
    // ============================================
    // 4. Post-render callback (2D overlays)
    // ============================================
    this.onPostRender?.();
  }
  
  /**
   * Set camera X position (affects parallax scrolling)
   * @param x Camera X in design coordinates
   */
  setCameraX(x: number): void {
    this.cameraX = x;
  }
  
  /**
   * Set camera to follow only player1 (for PvAI mode)
   * When true, AI movement won't cause background scrolling
   */
  setCameraFollowPlayerOnly(followPlayerOnly: boolean): void {
    this.cameraFollowPlayerOnly = followPlayerOnly;
  }
  
  /**
   * Update camera to follow fighters
   * - PvAI: follows only player1
   * - PvP: follows center between both players
   */
  updateCameraFromFighters(): void {
    if (this.cameraFollowPlayerOnly) {
      // PvAI mode: camera follows only player1
      const player = this.skeletons.get('player1');
      if (player) {
        this.cameraX = player.skeleton.x;
      }
    } else {
      // PvP mode: camera follows center between all fighters
      const fighters = [...this.skeletons.values()];
      if (fighters.length === 0) return;
      
      let sumX = 0;
      for (const f of fighters) {
        sumX += f.skeleton.x;
      }
      this.cameraX = sumX / fighters.length;
    }
  }
  
  private resize(): void {
    const canvas = this.canvas;
    const gl = this.context.gl;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }
  
  // ============================================
  // Debug Methods
  // ============================================
  
  /**
   * Toggle debug hitbox visualization
   */
  toggleDebug(): void {
    this.debugRenderer?.toggle();
  }
  
  /**
   * Set debug mode enabled/disabled
   */
  setDebugEnabled(enabled: boolean): void {
    if (this.debugRenderer) {
      this.debugRenderer.enabled = enabled;
    }
  }
  
  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return this.debugRenderer?.enabled ?? false;
  }
  
  /**
   * Set debug player references for hitbox visualization
   */
  setDebugPlayers(player1: FighterController, player2: FighterController): void {
    this.debugRenderer?.setPlayers(player1, player2);
  }
  
  /**
   * Set world boundaries for debug visualization
   */
  setDebugBoundaries(minX: number, maxX: number): void {
    this.debugRenderer?.setBoundaries(minX, maxX);
  }
  
  setFighterVisible(id: string, visible: boolean): void {
    const instance = this.skeletons.get(id);
    if (instance) {
      instance.skeleton.color.a = visible ? 1 : 0;
    }
  }
  
  getFighterPosition(id: string): { x: number; y: number } {
    const instance = this.skeletons.get(id);
    if (!instance) {
      return { x: 0, y: 0 };
    }
    return { x: instance.skeleton.x, y: instance.skeleton.y };
  }
  
  dispose(): void {
    this.isDisposed = true;       // Stop render loop
    this.isInitialized = false;   // Guard render from using resources
    this.skeletons.clear();
    this.shader?.dispose();
    this.batcher?.dispose();
    this.assetManager?.dispose();
    this.parallax?.dispose();
  }
}
