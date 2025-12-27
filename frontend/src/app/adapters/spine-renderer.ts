// ============================================================================
// Spine Renderer - Main WebGL Rendering Orchestrator
// Responsibility: Asset loading, fighter instances, rendering
// NO game logic - only visualization
// ============================================================================

import * as spine from '@esotericsoftware/spine-webgl';
import type { MatchState, GameEvent, FighterState, AttackId } from '../core/types';
import type { BoneSamples, BonePoint, BoneLine } from '../core/bone-samples';
import { quantize, createEmptyBoneSamples } from '../core/bone-samples';
import { CustomAtlasAttachmentLoader } from './spine-attachment-loader';
import { SpineStageRenderer, TRAINING_STAGE, AVAILABLE_BACKGROUNDS, type BackgroundId, type ParallaxConfig } from './spine-stage';
import { resolveAnimation, getRunStopAnimation } from './animation-resolver';
import { BoneDebugRenderer } from './bone-debug';
import { CombatTextRenderer } from './combat-text';
import { BlockFreezeManager } from './spine/block-freeze';
import { TelegraphFreezeManager } from './spine/telegraph-freeze';
import { getBoneTip, getBoneOrigin, ATTACK_BONES, HURTBOX_BONES, DESIGN_HEIGHT as SPINE_DESIGN_HEIGHT, gameToSpinePosition } from './spine-bone-transform';
import type { SpineSkeleton } from './spine-adapter';
import { getCharacter } from '../characters/registry';

/**
 * Get spine assets for character
 */
function getSpineAssets(characterId: string) {
    const character = getCharacter(characterId);
    if (character) {
        return {
            json: character.spine.assets.skeletonPath,
            atlas: character.spine.assets.atlasPath
        };
    }
    
    // Fallback to stickman assets if character not found
    return {
        json: 'assets/spine/stickman fighter.json',
        atlas: 'assets/spine/stickman fighter.atlas.txt'
    };
}

/**
 * Get default idle animation for character
 */
function getDefaultIdleAnimation(characterId: string): string {
    const character = getCharacter(characterId);
    if (character?.spine.mapping.animations.idle) {
        return character.spine.mapping.animations.idle;
    }
    
    // Fallback to stickman idle animation
    return '1_/idle';
}

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const GROUND_Y = 250; // Y position of ground (matches Legacy)

export type SpineStatus = 'loading' | 'ready' | 'error';

interface FighterInstance {
    skeleton: spine.Skeleton;
    state: spine.AnimationState;
    currentAnimation: string;
    wasRunning: boolean;  // Track previous running state for run stop transition
    lastAttackInstanceId: number;  // Track attack instance to detect cancels
}

/**
 * Wrapper class that implements SpineSkeleton interface for Spine Renderer
 * Uses dynamic lookup to support character switching at runtime
 */
class SpineFighterInstance implements SpineSkeleton {
    constructor(private fighterId: number, private renderer: SpineRenderer) {}

    private get instance(): FighterInstance | null | undefined {
        return this.renderer.getFighterInstance(this.fighterId);
    }

    setAnimation(name: string, loop: boolean): void {
        const inst = this.instance;
        if (!inst) return;
        
        if (inst.currentAnimation !== name) {
            inst.state.setAnimation(0, name, loop);
            inst.currentAnimation = name;
        }
    }

    setPosition(x: number, y: number): void {
        const inst = this.instance;
        if (!inst) return;
        
        // Convert game coordinates to Spine world coordinates
        const spinePos = gameToSpinePosition(x, y);
        inst.skeleton.x = spinePos.x;
        
        // Apply character-specific ground offset
        const characterId = this.renderer.fighterCharacters[this.fighterId];
        const character = getCharacter(characterId);
        const groundOffsetY = character?.spine.profile.groundOffsetY ?? 0;
        
        inst.skeleton.y = spinePos.y + groundOffsetY;
    }

    setFlip(facingRight: boolean): void {
        const inst = this.instance;
        if (!inst) return;
        
        inst.skeleton.scaleX = facingRight ? 1 : -1;
    }

    setTimeScale(scale: number): void {
        const inst = this.instance;
        if (!inst) return;
        
        // Apply timeScale to current animation track
        const entry = inst.state.getCurrent(0);
        if (entry) {
            entry.timeScale = scale;
        }
        // Also set default timeScale for future animations
        inst.state.timeScale = scale;
    }

    setLoadout(loadout: string): void {
        const inst = this.instance;
        if (!inst) return;
        
        // Define loadouts that don't require weapon attachment
        const emptyLoadouts = ['bare', 'none', 'unarmed'];
        
        // Find the weapon slot
        const weaponSlot = inst.skeleton.findSlot('weapon');
        if (!weaponSlot) {
            // Only warn if we actually need a weapon (not bare-handed)
            if (!emptyLoadouts.includes(loadout)) {
                console.warn('[SpineFighterInstance] weapon slot not found');
            }
            return;
        }

        if (emptyLoadouts.includes(loadout)) {
            // Clear weapon slot for bare-handed loadouts
            weaponSlot.setAttachment(null);
        } else {
            // Try to find attachment with same name as loadout
            const weaponAttachment = inst.skeleton.getAttachment(weaponSlot.data.index, loadout);
            if (weaponAttachment) {
                weaponSlot.setAttachment(weaponAttachment);
            } else {
                console.warn(`[SpineFighterInstance] Attachment "${loadout}" not found in weapon slot`);
                weaponSlot.setAttachment(null);
            }
        }
    }
}

export class SpineRenderer {
    private canvas: HTMLCanvasElement;
    private debugCanvas: HTMLCanvasElement | null = null;
    private debugCtx: CanvasRenderingContext2D | null = null;
    private context!: spine.ManagedWebGLRenderingContext;
    private shader!: spine.Shader;
    private batcher!: spine.PolygonBatcher;
    private mvp: spine.Matrix4 = new spine.Matrix4();
    private skeletonRenderer!: spine.SkeletonRenderer;
    private assetManager!: spine.AssetManager;

    private skeletonData!: spine.SkeletonData;
    private loadedSkeletons: Map<string, spine.SkeletonData> = new Map(); // Cache for loaded characters
    public fighterCharacters: [string, string] = ['stickman', 'stickman']; // Track which character each fighter uses
    private fighters: [FighterInstance | null, FighterInstance | null] = [null, null];

    private stageRenderer!: SpineStageRenderer;
    private debugRenderer: BoneDebugRenderer | null = null;
    private combatTextRenderer: CombatTextRenderer | null = null;

    private status: SpineStatus = 'loading';
    private errorMessage: string = '';

    private scale: number = 1;
    private cameraX: number = 960; // Center

    private showDebugRanges: boolean = false;
    private currentMatchState: MatchState | null = null;
    private lastBoneSamples: [BoneSamples, BoneSamples] | null = null;  // Cache for combat text positioning

    private blockFreezeManager: BlockFreezeManager = new BlockFreezeManager();
    private telegraphFreezeManager: TelegraphFreezeManager = new TelegraphFreezeManager();
    
    // Screen effects
    private screenFlash: { color: string; opacity: number; duration: number; age: number } | null = null;

    constructor(canvas: HTMLCanvasElement, stageConfig: ParallaxConfig = TRAINING_STAGE) {
        this.canvas = canvas;
        this.context = new spine.ManagedWebGLRenderingContext(canvas, {
            alpha: true,
            premultipliedAlpha: true
        });

        const gl = this.context.gl;
        this.stageRenderer = new SpineStageRenderer(gl, stageConfig);
        
        // Create separate overlay canvas for 2D debug rendering
        // (Cannot mix WebGL and 2D context on same canvas)
        this.debugCanvas = this.createDebugOverlayCanvas(canvas);
        if (this.debugCanvas) {
            const ctx2d = this.debugCanvas.getContext('2d', { alpha: true });
            if (ctx2d) {
                this.debugCtx = ctx2d;
                this.debugRenderer = new BoneDebugRenderer(ctx2d);
                this.combatTextRenderer = new CombatTextRenderer(ctx2d);
            }
        }
    }

    /**
     * Create a debug overlay canvas positioned over the main canvas
     * CRITICAL: Buffer is ALWAYS 1920x1080 (design dimensions)
     * CSS scales it to fill the container - coordinates map 1:1
     */
    private createDebugOverlayCanvas(mainCanvas: HTMLCanvasElement): HTMLCanvasElement | null {
        const parent = mainCanvas.parentElement;
        if (!parent) return null;

        const overlay = document.createElement('canvas');
        // FIXED buffer size - NEVER change this!
        overlay.width = DESIGN_WIDTH;   // Always 1920
        overlay.height = DESIGN_HEIGHT; // Always 1080
        
        // CSS stretches to fill container (same as WebGL canvas)
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1000';
        
        // Ensure parent has relative positioning
        const parentStyle = getComputedStyle(parent);
        if (parentStyle.position === 'static') {
            parent.style.position = 'relative';
        }
        
        parent.appendChild(overlay);
        console.log('[SpineRenderer] Debug overlay: buffer=%dx%d, CSS=100%%', overlay.width, overlay.height);
        return overlay;
    }
    
    /**
     * Initialize Spine assets - MUST be called before render
     * Returns Promise that resolves when ready or rejects on error
     */
    async initialize(): Promise<void> {
        this.status = 'loading';

        try {
            console.log('[SpineRenderer] Initializing...');

            const ctx = this.context;
            const gl = ctx.gl;

            // Setup Spine core
            this.shader = spine.Shader.newTwoColoredTextured(ctx);
            this.batcher = new spine.PolygonBatcher(ctx);
            this.skeletonRenderer = new spine.SkeletonRenderer(ctx);
            this.skeletonRenderer.premultipliedAlpha = true;

            // Setup asset manager
            this.assetManager = new spine.AssetManager(ctx, '');

            // Load default character assets (stickman)
            const defaultAssets = getSpineAssets('stickman');
            this.assetManager.loadText(defaultAssets.atlas);
            this.assetManager.loadTexture(defaultAssets.atlas.replace('.atlas.txt', '.png'));
            this.assetManager.loadJson(defaultAssets.json);

            console.log('[SpineRenderer] Loading assets...');

            // Wait for assets to load
            await new Promise<void>((resolve, reject) => {
                const checkLoaded = () => {
                    if (this.assetManager.isLoadingComplete()) {
                        if (this.assetManager.hasErrors()) {
                            const errors = this.assetManager.getErrors();
                            reject(new Error(`Asset loading failed: ${JSON.stringify(errors)}`));
                        } else {
                            resolve();
                        }
                    } else {
                        requestAnimationFrame(checkLoaded);
                    }
                };
                checkLoaded();
            });

            console.log('[SpineRenderer] Assets loaded, creating atlas...');

            // Create TextureAtlas from loaded text (reuse defaultAssets from above)
            const atlasText = this.assetManager.require(defaultAssets.atlas) as string;
            const texture = this.assetManager.require(defaultAssets.atlas.replace('.atlas.txt', '.png'));

            const atlas = new spine.TextureAtlas(atlasText);
            for (const page of atlas.pages) {
                page.setTexture(texture);
            }

            // Use custom attachment loader
            const atlasLoader = new CustomAtlasAttachmentLoader(atlas);
            const skeletonJson = new spine.SkeletonJson(atlasLoader);
            skeletonJson.scale = 0.5;

            const jsonData = this.assetManager.require(defaultAssets.json);
            this.skeletonData = skeletonJson.readSkeletonData(jsonData);
            
            // Cache stickman skeleton data
            this.loadedSkeletons.set('stickman', this.skeletonData);

            console.log('[SpineRenderer] Skeleton data loaded');

            // Initialize stage renderer
            await this.stageRenderer.initialize();

            console.log('[SpineRenderer] Stage renderer initialized');

            // Create fighter instances
            this.createFighterInstances();

            this.status = 'ready';
            console.log('[SpineRenderer] Ready!');

        } catch (error) {
            this.status = 'error';
            this.errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[SpineRenderer] Initialization failed:', this.errorMessage);
            throw error;
        }
    }

    private createFighterInstances(): void {
        // Fighter 0 (Player) - Blue skin
        const skeleton0 = new spine.Skeleton(this.skeletonData);
        skeleton0.x = 600;
        skeleton0.y = GROUND_Y;
        skeleton0.scaleX = 1;
        skeleton0.scaleY = 1;

        const skin0 = new spine.Skin('combined');
        const defaultSkin = this.skeletonData.findSkin('default');
        const blueSkin = this.skeletonData.findSkin('blue');
        if (defaultSkin) skin0.addSkin(defaultSkin);
        if (blueSkin) skin0.addSkin(blueSkin);
        skeleton0.setSkin(skin0);
        skeleton0.setToSetupPose();

        const stateData0 = new spine.AnimationStateData(skeleton0.data);
        stateData0.defaultMix = 0.2;
        const state0 = new spine.AnimationState(stateData0);
        const defaultIdle0 = getDefaultIdleAnimation('stickman');
        state0.setAnimation(0, defaultIdle0, true);
        
        this.fighters[0] = {
            skeleton: skeleton0,
            state: state0,
            currentAnimation: defaultIdle0,
            wasRunning: false,
            lastAttackInstanceId: -1
        };

        // Attach global event logger for Fighter 0
        this.fighters[0].state.addListener({
            event: (entry, event) => {
                console.log(
                    '[SpineEvent] Fighter 0:',
                    event.data.name,
                    'event.time=', event.time.toFixed(3) + 's',
                    'trackTime=', entry.trackTime.toFixed(3) + 's',
                    'anim=', entry.animation?.name
                );
            },
            complete: () => { },
            start: () => { },
            end: () => { },
            dispose: () => { },
            interrupt: () => { }
        });

        // Fighter 1 (AI) - Red skin
        const skeleton1 = new spine.Skeleton(this.skeletonData);
        skeleton1.x = 1320;
        skeleton1.y = GROUND_Y;
        skeleton1.scaleX = -1; // Face left
        skeleton1.scaleY = 1;

        const skin1 = new spine.Skin('combined');
        const redSkin = this.skeletonData.findSkin('red');
        if (defaultSkin) skin1.addSkin(defaultSkin);
        if (redSkin) skin1.addSkin(redSkin);
        skeleton1.setSkin(skin1);
        skeleton1.setToSetupPose();

        const stateData1 = new spine.AnimationStateData(skeleton1.data);
        stateData1.defaultMix = 0.2;
        const state1 = new spine.AnimationState(stateData1);
        const defaultIdle1 = getDefaultIdleAnimation('stickman');
        state1.setAnimation(0, defaultIdle1, true);

        this.fighters[1] = {
            skeleton: skeleton1,
            state: state1,
            currentAnimation: defaultIdle1,
            wasRunning: false,
            lastAttackInstanceId: -1
        };
        
        // Attach global event logger for Fighter 1
        this.fighters[1].state.addListener({
            event: (entry, event) => {
                console.log(
                    '[SpineEvent] Fighter 1:',
                    event.data.name,
                    'event.time=', event.time.toFixed(3) + 's',
                    'trackTime=', entry.trackTime.toFixed(3) + 's',
                    'anim=', entry.animation?.name
                );
            },
            complete: () => { },
            start: () => { },
            end: () => { },
            dispose: () => { },
            interrupt: () => { }
        });

        console.log('[SpineRenderer] Fighter instances created');
    }

    /**
     * Apply game state to visual representation
     */
    applySnapshot(state: MatchState): void {
        if (this.status !== 'ready') return;

        // Store for debug rendering
        this.currentMatchState = state;

        // === CAMERA SYSTEM ===
        // Follow the player (Fighter 0) for full parallax scrolling effect
        // Like classic beat'em ups, opponent can be off-screen
        const player = state.fighters[0];
        
        // CRITICAL: Camera must respect arena bounds (doubled for larger arena)
        const ARENA_MIN = -2000;  // PHYSICS.arenaMinX (doubled)
        const ARENA_MAX = 7840;   // PHYSICS.arenaMaxX (doubled)
        const VIEWPORT_HALF = DESIGN_WIDTH / 2;
        
        const cameraMinX = ARENA_MIN + VIEWPORT_HALF;
        const cameraMaxX = ARENA_MAX - VIEWPORT_HALF;
        
        // Ideal: center on player; clamped to arena bounds
        const idealCameraX = player.x;
        this.cameraX = Math.max(cameraMinX, Math.min(cameraMaxX, idealCameraX));
        
        // Update stage camera
        this.stageRenderer.setCameraX(this.cameraX);

        // Update each fighter
        for (let i = 0; i < 2; i++) {
            const fighter = this.fighters[i];
            const gameState = state.fighters[i];
            if (!fighter) continue;

            // Convert World-Space to Screen-Space
            // World: gameState.x in [arenaMinX, arenaMaxX]
            // Screen: skeleton.x in [0, DESIGN_WIDTH]
            // Formula: screenX = worldX - cameraX + (DESIGN_WIDTH / 2)
            const worldCenter = DESIGN_WIDTH / 2;
            const screenX = gameState.x - this.cameraX + worldCenter;
            fighter.skeleton.x = screenX;
            
            // Y-axis: Game Y+ is DOWN, Spine Y+ is UP
            // When gameY=0 (at ground), skeleton.y should be at groundY
            // When gameY increases (jumps up), skeleton.y should increase
            const groundY = this.getGroundY();
            
            // Apply character-specific ground offset
            const characterId = this.fighterCharacters[i];
            const character = getCharacter(characterId);
            const groundOffsetY = character?.spine.profile.groundOffsetY ?? 0;
            
            fighter.skeleton.y = groundY - gameState.y + groundOffsetY;
            
            // Update root bone transforms immediately so bones reflect current skeleton.x/y
            fighter.skeleton.getRootBone()!.updateWorldTransform();

            // Update facing direction
            fighter.skeleton.scaleX = gameState.facingRight ? 1 : -1;

            // Update animation based on state
            this.updateAnimation(fighter, gameState);
        }
    }

    private updateAnimation(
        fighter: FighterInstance,
        gameState: MatchState['fighters'][0]
    ): void {
        // Determine if fighter is running (vx > threshold between walk and run speed)
        // Core physics: walkSpeed=200, runSpeed=400 (2x with SHIFT)
        // Use 300 as threshold (halfway between walk and run)
        const isRunning = Math.abs(gameState.vx) > 300;

        // Debug: Log running state transitions
        if (fighter.wasRunning !== isRunning) {
            console.log(`[Animation] Fighter ${gameState.id}: wasRunning=${fighter.wasRunning} → isRunning=${isRunning}, vx=${gameState.vx.toFixed(2)}, state=${gameState.state}`);
        }

        // Check if we need to play run stop transition
        const shouldPlayRunStop = fighter.wasRunning && !isRunning && (gameState.state === 'idle' || gameState.state === 'move');

        let animKey: { name: string; loop: boolean };

        if (shouldPlayRunStop) {
            // Play run stop animation (one-shot)
            animKey = { name: getRunStopAnimation(gameState.characterId, gameState.loadout), loop: false };
            console.log(`[Animation] Fighter ${gameState.id}: Playing run stop transition`);
        } else {
            // Normal animation resolution
            animKey = resolveAnimation(gameState.state, gameState.characterId, gameState.loadout, {
                activeAttack: gameState.activeAttack as AttackId | null,
                blockZone: gameState.blockZone,
                attackZone: gameState.attackZone,
                facingRight: gameState.facingRight,
                vx: gameState.vx,
                run: isRunning,
                pressureStunTicks: gameState.pressureStunTicks,  // Pass pressure stun info
            });
            
            // Debug: Log animation resolution when running state changes
            if (fighter.wasRunning !== isRunning && (gameState.state === 'move' || gameState.state === 'idle')) {
                console.log(`[Animation] Fighter ${gameState.id}: Resolved to "${animKey.name}" (state=${gameState.state}, run=${isRunning}, vx=${gameState.vx.toFixed(2)})`);
            }
        }

        // Build animation key with loop flag for idempotent comparison
        const animKeyId = `${animKey.name}:${animKey.loop}`;
        const currentKeyId = `${fighter.currentAnimation}:${fighter.state.getCurrent(0)?.loop ?? true}`;

        // Check if attack instance changed (for cancel detection)
        const attackInstanceChanged = gameState.attackInstanceId !== fighter.lastAttackInstanceId;

        // Debug: Log idempotent check
        if (fighter.wasRunning !== isRunning) {
            console.log(`[Animation] Fighter ${gameState.id}: animKeyId="${animKeyId}" vs currentKeyId="${currentKeyId}" => changed=${currentKeyId !== animKeyId}`);
        }

        // Set animation if:
        // 1. Animation changed (normal case)
        // 2. Attack instance changed (cancel/new attack with same animation)
        // NOTE: We do NOT restart on telegraph→attack transition!
        // Animation plays to freezeAtSpineFrame, pauses for freezeDurationMs, then continues
        if (currentKeyId !== animKeyId || attackInstanceChanged) {
            fighter.state.setAnimation(0, animKey.name, animKey.loop);
            fighter.currentAnimation = animKey.name;
            fighter.lastAttackInstanceId = gameState.attackInstanceId;  // Update tracked instance

            // Start telegraph freeze if entering telegraph with attack
            if (gameState.state === 'telegraph' && gameState.activeAttack) {
                this.telegraphFreezeManager.startTelegraph(
                    gameState.id,
                    gameState.activeAttack as AttackId,
                    gameState.characterId
                );
            }
        }

        // Update running state tracker
        fighter.wasRunning = isRunning;

        // End telegraph freeze if leaving telegraph state
        if (gameState.state !== 'telegraph' && this.telegraphFreezeManager.isActive(gameState.id)) {
            this.telegraphFreezeManager.endTelegraph(gameState.id);
        }

        // Apply block freeze logic (modular, state-tracked)
        // This handles: play once -> freeze at end -> unfreeze on release
        this.blockFreezeManager.applyBlockFreeze(
            gameState.id,
            gameState.state,
            fighter.state
        );
    }

    /**
     * Handle game events (optional visual feedback)
     */
    handleEvents(events: GameEvent[]): void {
        if (this.status !== 'ready') return;
        for (const event of events) {
            // Handle attackStart event: release telegraph freeze
            if (event.type === 'attackStart') {
                this.telegraphFreezeManager.endTelegraph(event.fighter);
                console.log(`[SpineRenderer] attackStart for fighter ${event.fighter}: ${event.attack}`);
            }
            
            // Handle combat text events (hit, block, parry, stun, rageBurst, phaseChange)
            if (event.type === 'hit' || event.type === 'block' || event.type === 'parry' || event.type === 'stun' || event.type === 'rageBurst' || event.type === 'phaseChange') {
                console.log(`[SpineRenderer] Combat event detected:`, event.type, 'combatTextRenderer:', !!this.combatTextRenderer, 'lastBoneSamples:', !!this.lastBoneSamples);
                
                if (this.combatTextRenderer && this.lastBoneSamples) {
                    this.combatTextRenderer.handleEvent(event, this.lastBoneSamples);
                } else if (!this.combatTextRenderer) {
                    console.warn('[SpineRenderer] combatTextRenderer not initialized!');
                } else if (!this.lastBoneSamples) {
                    console.warn('[SpineRenderer] lastBoneSamples is null, bones not sampled yet');
                }
                
                // Trigger screen flash for rage burst
                if (event.type === 'rageBurst') {
                    this.triggerScreenFlash('#ff3300', 0.4, 20);  // Orange-red flash, 20 ticks
                }
                
                // Trigger screen flash for phase change (gold color, longer)
                if (event.type === 'phaseChange') {
                    this.triggerScreenFlash('#ffaa00', 0.3, 30);  // Gold flash, 30 ticks
                }
            }
        }
    }
    
    /**
     * Trigger a screen flash effect
     */
    private triggerScreenFlash(color: string, opacity: number, duration: number): void {
        this.screenFlash = { color, opacity, duration, age: 0 };
    }
    
    /**
     * Update and render screen flash effect
     */
    private renderScreenFlash(ctx: CanvasRenderingContext2D): void {
        if (!this.screenFlash) return;
        
        this.screenFlash.age++;
        
        // Fade out over duration
        const progress = this.screenFlash.age / this.screenFlash.duration;
        const alpha = this.screenFlash.opacity * (1 - progress);
        
        if (alpha > 0) {
            ctx.save();
            ctx.fillStyle = this.screenFlash.color;
            ctx.globalAlpha = alpha;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
        
        // Clear when done
        if (this.screenFlash.age >= this.screenFlash.duration) {
            this.screenFlash = null;
        }
    }

    /**
     * Render a frame - call this every tick/frame
     */
    render(delta: number = 0.016): void {
        if (this.status !== 'ready') return;

        const gl = this.context.gl;

        // Guard: check context validity
        if (gl.isContextLost()) {
            console.warn('[SpineRenderer] WebGL context lost');
            return;
        }

        this.resize();

        // Clear
        gl.clearColor(0.02, 0.05, 0.13, 1.0); // slate-950
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Setup blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // Simple orthographic projection - stretch to fill (like CSS 100%)
        // NO letterboxing - both WebGL and Debug canvas fill 100%
        // This means aspect ratio is NOT preserved, but coordinates match exactly
        this.mvp.ortho2d(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
        
        // Calculate scale for stage renderer (still needs it for parallax)
        const scaleX = this.canvas.width / DESIGN_WIDTH;
        const scaleY = this.canvas.height / DESIGN_HEIGHT;
        this.scale = Math.min(scaleX, scaleY);

        // 1. Render Stage/Background
        this.stageRenderer.render(this.mvp, this.canvas.width, this.canvas.height, this.scale);

        // 2. Update and render Spine characters
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        for (let i = 0; i < this.fighters.length; i++) {
            const fighter = this.fighters[i];
            if (fighter) {
                // Update telegraph freeze timer (if active)
                // This must happen BEFORE checking isFrozen, using original delta
                if (this.telegraphFreezeManager.isActive(i)) {
                    this.telegraphFreezeManager.update(i, delta);
                }
                
                // Check if fighter is frozen (telegraph freeze)
                const isFrozen = this.telegraphFreezeManager.isFrozen(i);
                const effectiveDelta = isFrozen ? 0 : delta;
                
                // Update animation with conditional delta (0 if frozen)
                fighter.state.update(effectiveDelta);
                fighter.state.apply(fighter.skeleton);
                fighter.skeleton.update(effectiveDelta);
                fighter.skeleton.updateWorldTransform(spine.Physics.update);
            }
        }

        this.shader.bind();
        this.shader.setUniformi(spine.Shader.SAMPLER, 0);
        this.shader.setUniform4x4f(spine.Shader.MVP_MATRIX, this.mvp.values);

        this.batcher.begin(this.shader);

        // Render fighters sorted by X position (depth)
        const sortedFighters = [...this.fighters]
            .filter((f): f is FighterInstance => f !== null)
            .sort((a, b) => a.skeleton.x - b.skeleton.x);

        for (const fighter of sortedFighters) {
            this.skeletonRenderer.draw(this.batcher, fighter.skeleton);
        }

        this.batcher.end();
        this.shader.unbind();

        // 3. Debug Range Overlay (2D Canvas over WebGL)
        if (this.showDebugRanges && this.currentMatchState && this.debugRenderer) {
            const bones0 = this.sampleBones(0, this.currentMatchState.tick);
            const bones1 = this.sampleBones(1, this.currentMatchState.tick);
            this.debugRenderer.render(this.currentMatchState, [bones0, bones1]);
        } else if (this.debugRenderer) {
            // Clear debug overlay when disabled
            this.debugRenderer.clear();
        }
        
        // 4. Screen Flash (behind combat text)
        if (this.debugCtx) {
            this.renderScreenFlash(this.debugCtx);
        }
        
        // 5. Combat Text (always visible, rendered over everything)
        if (this.combatTextRenderer) {
            this.combatTextRenderer.update();
            this.combatTextRenderer.render();
        }
    }

    private resize(): void {
        const canvas = this.canvas;
        const gl = this.context.gl;
        
        // Get CSS display size
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        
        // Account for device pixel ratio for sharp rendering on high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        const pixelWidth = Math.floor(displayWidth * dpr);
        const pixelHeight = Math.floor(displayHeight * dpr);

        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;

            // DEBUG CANVAS: DO NOT RESIZE!
            // Buffer stays fixed at 1920x1080, CSS handles scaling
            // This is critical - bone coordinates are always in design space

            // Simple viewport - NO letterboxing (like Legacy)
            // Both WebGL and Debug canvas fill 100% - coordinates match
            gl.viewport(0, 0, canvas.width, canvas.height);
            
            console.log(`[SpineRenderer] Resized canvas: ${displayWidth}x${displayHeight} CSS -> ${pixelWidth}x${pixelHeight} pixels (DPR: ${dpr})`);
        }
    }

    getStatus(): SpineStatus {
        return this.status;
    }

    getErrorMessage(): string {
        return this.errorMessage;
    }

    /**
     * Get a fighter instance by ID (for dynamic lookup by SpineFighterInstance)
     */
    getFighterInstance(fighterId: number): FighterInstance | null | undefined {
        return this.fighters[fighterId];
    }

    /**
     * Get SpineSkeleton wrappers for the GameLoop
     * Uses fighter ID for dynamic lookup to support character switching
     */
    getSkeletons(): SpineSkeleton[] {
        return this.fighters.map((fighter, index) => 
            fighter ? new SpineFighterInstance(index, this) : null
        ).filter((skeleton): skeleton is SpineFighterInstance => skeleton !== null);
    }

    setShowDebugRanges(show: boolean): void {
        this.showDebugRanges = show;
        // Enable/disable all hitbox types when toggling debug ranges
        if (this.debugRenderer) {
            this.debugRenderer.setConfig({ 
                showBones: show,
                showHurtboxes: show,
                showHitboxes: show,
                showCollisions: show,
                showAllHitboxes: show
            });
        }
    }
    
    /**
     * Toggle showing all possible hitboxes for each fighter
     */
    setShowAllHitboxes(show: boolean): void {
        if (this.debugRenderer) {
            this.debugRenderer.setConfig({ showAllHitboxes: show });
        }
    }
    
    /**
     * Toggle calibration mode for bone alignment debugging
     * Shows detailed position info to verify transforms are correct
     */
    setShowCalibration(show: boolean): void {
        if (this.debugRenderer) {
            this.debugRenderer.setConfig({ showCalibration: show });
        }
    }

    /**
     * Sample bone positions from Spine skeleton (bone-driven hitboxes)
     * Returns quantized world positions for combat calculations
     * Uses character-specific bone mapping from registry
     */
    sampleBones(fighterId: number, gameTick: number): BoneSamples {
        const fighter = this.fighters[fighterId];
        if (!fighter) {
            return createEmptyBoneSamples(fighterId, gameTick);
        }

        const skeleton = fighter.skeleton;
        
        // Get character-specific bone names from registry
        const characterId = this.fighterCharacters[fighterId] || 'stickman';
        const character = getCharacter(characterId);
        const boneMap = character?.spine.mapping.bones;
        
        // Resolve bone names (use character-specific or fallback to stickman defaults)
        const rightHandBone = (boneMap?.['rightHand'] as string) || ATTACK_BONES.RIGHT_HAND;
        const leftHandBone = (boneMap?.['leftHand'] as string) || ATTACK_BONES.LEFT_HAND;
        const rightFootBone = (boneMap?.['rightFoot'] as string) || ATTACK_BONES.RIGHT_FOOT;
        const leftFootBone = (boneMap?.['leftFoot'] as string) || ATTACK_BONES.LEFT_FOOT;
        const headBone = (boneMap?.['head'] as string) || HURTBOX_BONES.HEAD;
        const chestBone = (boneMap?.['chest'] as string) || HURTBOX_BONES.CHEST;
        
        // Attack bones: use TIP position (end of bone = hand/foot visual position)
        // This is the KEY fix - localToWorld(boneLength, 0) gives tip, not origin!
        const rightHand = getBoneTip(skeleton, rightHandBone);
        const leftHand = getBoneTip(skeleton, leftHandBone);
        const rightFoot = getBoneTip(skeleton, rightFootBone);
        const leftFoot = getBoneTip(skeleton, leftFootBone);
        
        // Hurtbox bones: use ORIGIN position (bone origin = center of body part)
        const head = getBoneOrigin(skeleton, headBone);
        const chest = getBoneOrigin(skeleton, chestBone);
        
        // Weapon line (character-specific or fallback to slot-based)
        const weaponLine = this.getWeaponLine(skeleton, characterId);
        
        // Build samples with quantized positions
        const samples: BoneSamples = {
            fighterId: fighterId as 0 | 1,
            timestamp: gameTick,
            head: head ? { x: quantize(head.x), y: quantize(head.y) } : { x: 0, y: 0 },
            chest: chest ? { x: quantize(chest.x), y: quantize(chest.y) } : { x: 0, y: 0 },
            rightHand: rightHand ? { x: quantize(rightHand.x), y: quantize(rightHand.y) } : { x: 0, y: 0 },
            leftHand: leftHand ? { x: quantize(leftHand.x), y: quantize(leftHand.y) } : { x: 0, y: 0 },
            rightFoot: rightFoot ? { x: quantize(rightFoot.x), y: quantize(rightFoot.y) } : { x: 0, y: 0 },
            leftFoot: leftFoot ? { x: quantize(leftFoot.x), y: quantize(leftFoot.y) } : { x: 0, y: 0 },
            weaponLine: weaponLine ? {
                x1: quantize(weaponLine.x1),
                y1: quantize(weaponLine.y1),
                x2: quantize(weaponLine.x2),
                y2: quantize(weaponLine.y2),
            } : null,
        };
        
        // Cache samples for combat text positioning
        if (!this.lastBoneSamples) {
            this.lastBoneSamples = [createEmptyBoneSamples(0, gameTick), createEmptyBoneSamples(1, gameTick)];
        }
        this.lastBoneSamples[fighterId] = samples;
        
        return samples;
    }
    
    /**
     * Get weapon line (grip to tip) for collision detection
     * Uses character-specific weapon line bone mapping or falls back to slot-based detection
     */
    private getWeaponLine(skeleton: spine.Skeleton, characterId: string): BoneLine | null {
        // Get character-specific bone config
        const character = getCharacter(characterId);
        const boneMap = character?.spine.mapping.bones;
        const weaponLine = boneMap?.['weaponLine'] as { start: string; end: string } | undefined;
        
        // If weaponLine mapping exists with TWO DIFFERENT bones, use bone-based calculation
        if (weaponLine && weaponLine.start !== weaponLine.end) {
            const startBone = skeleton.findBone(weaponLine.start);
            const endBone = skeleton.findBone(weaponLine.end);
            
            if (startBone && endBone) {
                // Start: Use ORIGIN of start bone (grip/hand position)
                const startPos = new spine.Vector2();
                startBone.localToWorld(startPos.set(0, 0));
                
                // End: Use TIP of end bone (weapon tip = bone length along local X)
                const endPos = new spine.Vector2();
                const endBoneLength = endBone.data.length;
                endBone.localToWorld(endPos.set(endBoneLength, 0));
                
                return {
                    x1: quantize(startPos.x),
                    y1: quantize(startPos.y),
                    x2: quantize(endPos.x),
                    y2: quantize(endPos.y),
                };
            }
        }
        
        // Slot-based weapon detection using character-specific weaponSlot config
        // weaponSlot can be:
        // - string: slot name (uses default 'height' axis)
        // - object: { slot: string, axis?: 'height' | 'width' | 'corners' }
        const weaponSlotConfig = boneMap?.['weaponSlot'] as string | { slot: string; axis?: 'height' | 'width' | 'corners' } | undefined;
        const slotName = typeof weaponSlotConfig === 'string' ? weaponSlotConfig : weaponSlotConfig?.slot;
        const axis = typeof weaponSlotConfig === 'object' ? (weaponSlotConfig.axis ?? 'height') : 'height';
        
        const slot = slotName ? skeleton.findSlot(slotName) : null;
        if (!slot) return null;

        const att = slot.getAttachment();
        if (!att) return null;

        const bone = slot.bone;
        
        // Grip is at bone origin (where weapon is attached)
        const gripPos = new spine.Vector2();
        bone.localToWorld(gripPos.set(0, 0));
        const start = { x: quantize(gripPos.x), y: quantize(gripPos.y) };

        // For RegionAttachment (simple sprite), calculate weapon line based on axis config
        if (att instanceof spine.RegionAttachment) {
            const halfWidth = att.width / 2;
            const halfHeight = att.height / 2;
            const attRotationRad = (att.rotation * Math.PI) / 180;
            const cos = Math.cos(attRotationRad);
            const sin = Math.sin(attRotationRad);
            
            let tipWorld: spine.Vector2;
            
            if (axis === 'corners') {
                // Use all 4 corners - find furthest from grip (for complex weapon shapes)
                const corners = [
                    { x: att.x + cos * halfWidth - sin * halfHeight, y: att.y + sin * halfWidth + cos * halfHeight },
                    { x: att.x - cos * halfWidth - sin * halfHeight, y: att.y - sin * halfWidth + cos * halfHeight },
                    { x: att.x - cos * halfWidth + sin * halfHeight, y: att.y - sin * halfWidth - cos * halfHeight },
                    { x: att.x + cos * halfWidth + sin * halfHeight, y: att.y + sin * halfWidth - cos * halfHeight },
                ];
                
                let maxDist = 0;
                tipWorld = new spine.Vector2();
                bone.localToWorld(tipWorld.set(corners[0].x, corners[0].y));
                
                for (const corner of corners) {
                    const worldCorner = new spine.Vector2();
                    bone.localToWorld(worldCorner.set(corner.x, corner.y));
                    const dist = (worldCorner.x - start.x) ** 2 + (worldCorner.y - start.y) ** 2;
                    if (dist > maxDist) {
                        maxDist = dist;
                        tipWorld = worldCorner;
                    }
                }
            } else {
                // Use center line along height or width axis (default: height)
                const halfLength = axis === 'width' ? halfWidth : halfHeight;
                
                // Calculate both ends along the chosen axis
                // Height axis: rotated Y direction, Width axis: rotated X direction
                const dirX = axis === 'width' ? cos : -sin;
                const dirY = axis === 'width' ? sin : cos;
                
                const end1LocalX = att.x + dirX * halfLength;
                const end1LocalY = att.y + dirY * halfLength;
                const end2LocalX = att.x - dirX * halfLength;
                const end2LocalY = att.y - dirY * halfLength;
                
                const end1World = new spine.Vector2();
                const end2World = new spine.Vector2();
                bone.localToWorld(end1World.set(end1LocalX, end1LocalY));
                bone.localToWorld(end2World.set(end2LocalX, end2LocalY));
                
                // Pick the end furthest from grip as weapon tip
                const dist1 = (end1World.x - start.x) ** 2 + (end1World.y - start.y) ** 2;
                const dist2 = (end2World.x - start.x) ** 2 + (end2World.y - start.y) ** 2;
                tipWorld = dist1 > dist2 ? end1World : end2World;
            }
            
            return {
                x1: start.x,
                y1: start.y,
                x2: quantize(tipWorld.x),
                y2: quantize(tipWorld.y),
            };
        }

        // For MeshAttachment (complex mesh), find furthest vertex from grip
        if (att instanceof spine.MeshAttachment) {
            const verts = new Array(att.worldVerticesLength);
            att.computeWorldVertices(slot, 0, att.worldVerticesLength, verts, 0, 2);

            let maxDist = 0;
            let tip = { x: quantize(verts[0]), y: quantize(verts[1]) };

            for (let i = 0; i < verts.length; i += 2) {
                const dx = verts[i] - start.x;
                const dy = verts[i + 1] - start.y;
                const dist = dx * dx + dy * dy;
                if (dist > maxDist) {
                    maxDist = dist;
                    tip = { x: quantize(verts[i]), y: quantize(verts[i + 1]) };
                }
            }
            
            return {
                x1: start.x,
                y1: start.y,
                x2: tip.x,
                y2: tip.y,
            };
        }

        return null;
    }

    /**
     * Get current ground Y position from stage configuration
     */
    getGroundY(): number {
        return this.stageRenderer.getGroundY();
    }

    /**
     * Load a character's skeleton data if not already loaded
     */
    async loadCharacter(characterId: string): Promise<spine.SkeletonData | null> {
        // Check cache first
        if (this.loadedSkeletons.has(characterId)) {
            console.log(`[SpineRenderer] Character ${characterId} already loaded (cached)`);
            return this.loadedSkeletons.get(characterId)!;
        }

        console.log(`[SpineRenderer] Loading character: ${characterId}`);

        const assets = getSpineAssets(characterId);
        const character = getCharacter(characterId);
        
        if (!character) {
            console.error(`[SpineRenderer] Character not found in registry: ${characterId}`);
            return null;
        }

        try {
            // Compute texture path - handle both .atlas.txt and .atlas extensions
            const texturePath = assets.atlas.endsWith('.atlas.txt')
                ? assets.atlas.replace('.atlas.txt', '.png')
                : assets.atlas.replace('.atlas', '.png');

            console.log(`[SpineRenderer] Loading assets for ${characterId}:`, {
                atlas: assets.atlas,
                texture: texturePath,
                json: assets.json
            });

            // Load assets
            this.assetManager.loadText(assets.atlas);
            this.assetManager.loadTexture(texturePath);
            this.assetManager.loadJson(assets.json);

            // Wait for assets to load
            await new Promise<void>((resolve, reject) => {
                const checkLoaded = () => {
                    if (this.assetManager.isLoadingComplete()) {
                        if (this.assetManager.hasErrors()) {
                            const errors = this.assetManager.getErrors();
                            reject(new Error(`Asset loading failed: ${JSON.stringify(errors)}`));
                        } else {
                            resolve();
                        }
                    } else {
                        requestAnimationFrame(checkLoaded);
                    }
                };
                checkLoaded();
            });

            // Create atlas
            const atlasText = this.assetManager.require(assets.atlas) as string;
            const texture = this.assetManager.require(texturePath);

            const atlas = new spine.TextureAtlas(atlasText);
            for (const page of atlas.pages) {
                page.setTexture(texture);
            }

            // Create skeleton data
            const atlasLoader = new CustomAtlasAttachmentLoader(atlas);
            const skeletonJson = new spine.SkeletonJson(atlasLoader);
            skeletonJson.scale = character.spine.profile.scale * 0.5; // Apply character scale

            const jsonData = this.assetManager.require(assets.json);
            const skeletonData = skeletonJson.readSkeletonData(jsonData);

            // Cache the loaded skeleton
            this.loadedSkeletons.set(characterId, skeletonData);
            console.log(`[SpineRenderer] Character ${characterId} loaded successfully`);

            return skeletonData;
        } catch (error) {
            console.error(`[SpineRenderer] Failed to load character ${characterId}:`, error);
            return null;
        }
    }

    /**
     * Switch a fighter to a different character
     */
    async switchFighterCharacter(fighterId: 0 | 1, characterId: string): Promise<boolean> {
        console.log(`[SpineRenderer] Switching Fighter ${fighterId} to character: ${characterId}`);

        // Skip if already using this character
        if (this.fighterCharacters[fighterId] === characterId) {
            console.log(`[SpineRenderer] Fighter ${fighterId} already using ${characterId}`);
            return true;
        }

        // Load character skeleton
        const skeletonData = await this.loadCharacter(characterId);
        if (!skeletonData) {
            console.error(`[SpineRenderer] Cannot switch - character ${characterId} failed to load`);
            return false;
        }

        // Get character config
        const character = getCharacter(characterId);
        if (!character) {
            console.error(`[SpineRenderer] Character not found: ${characterId}`);
            return false;
        }

        // Create new skeleton and animation state
        const skeleton = new spine.Skeleton(skeletonData);
        const oldFighter = this.fighters[fighterId];
        
        // Preserve position from old skeleton
        if (oldFighter) {
            skeleton.x = oldFighter.skeleton.x;
            skeleton.y = oldFighter.skeleton.y;
            skeleton.scaleX = fighterId === 0 ? 1 : -1; // Player faces right, AI faces left
        } else {
            skeleton.x = fighterId === 0 ? 600 : 1320;
            skeleton.y = GROUND_Y;
            skeleton.scaleX = fighterId === 0 ? 1 : -1;
        }
        skeleton.scaleY = 1;

        // Apply skin - stickman needs combined skin (default + color)
        if (characterId === 'stickman') {
            const combinedSkin = new spine.Skin('combined');
            const defaultSkin = skeletonData.findSkin('default');
            const colorSkin = skeletonData.findSkin(fighterId === 0 ? 'blue' : 'red');
            if (defaultSkin) combinedSkin.addSkin(defaultSkin);
            if (colorSkin) combinedSkin.addSkin(colorSkin);
            skeleton.setSkin(combinedSkin);
        } else {
            // Other characters: just use default skin
            const defaultSkin = skeletonData.findSkin('default');
            if (defaultSkin) {
                skeleton.setSkin(defaultSkin);
            }
        }
        skeleton.setToSetupPose();

        // Create animation state
        const stateData = new spine.AnimationStateData(skeleton.data);
        stateData.defaultMix = 0.2;
        const state = new spine.AnimationState(stateData);
        
        // Set default idle animation
        const idleAnim = character.spine.mapping.animations.idle || 'idle';
        state.setAnimation(0, idleAnim, true);

        // Create new fighter instance
        this.fighters[fighterId] = {
            skeleton,
            state,
            currentAnimation: idleAnim,
            wasRunning: false,
            lastAttackInstanceId: -1
        };

        // Update tracking
        this.fighterCharacters[fighterId] = characterId;

        console.log(`[SpineRenderer] Fighter ${fighterId} switched to ${characterId}`);
        return true;
    }

    /**
     * Get current character ID for a fighter
     */
    getFighterCharacter(fighterId: 0 | 1): string {
        return this.fighterCharacters[fighterId];
    }

    dispose(): void {
        this.debugRenderer?.dispose();
        this.stageRenderer?.dispose();
        this.shader?.dispose();
        this.batcher?.dispose();
        this.assetManager?.dispose();
        this.fighters = [null, null];
        this.loadedSkeletons.clear();
        this.fighterCharacters = ['stickman', 'stickman'];
        this.status = 'loading';
        
        // Remove debug overlay canvas
        if (this.debugCanvas && this.debugCanvas.parentElement) {
            this.debugCanvas.parentElement.removeChild(this.debugCanvas);
            this.debugCanvas = null;
        }
    }

    /**
     * Change background dynamically
     */
    async setBackground(backgroundId: BackgroundId): Promise<void> {
        const newConfig = AVAILABLE_BACKGROUNDS[backgroundId];
        if (!newConfig) {
            console.warn(`[SpineRenderer] Unknown background ID: ${backgroundId}`);
            return;
        }

        console.log(`[SpineRenderer] Switching to background: ${backgroundId}`);
        
        // Dispose old stage renderer
        this.stageRenderer.dispose();
        
        // Create new stage renderer with new config
        const gl = this.context.gl;
        this.stageRenderer = new SpineStageRenderer(gl, newConfig);
        
        // Initialize new stage
        await this.stageRenderer.initialize();
        
        console.log(`[SpineRenderer] Background switched to: ${backgroundId}`);
    }
}
