// ============================================
// Game Engine - Main Game Setup & Loop
// ============================================

import { FighterController } from './fighter-controller';
import { GameInputManager, PLAYER1_BINDINGS, InputCallback } from './input-handler';
import { SpineGameManager, CITY1_PARALLAX, ParallaxConfig } from './spine-manager';
import { FighterAI, AIDifficulty } from './fighter-ai';
import { CombatSystem } from './combat-system';
import { CombatTextRenderer } from './combat-text';
import { Loadout } from './types';

export type GameMode = 'local' | 'online';

// Bonus effects that can be applied to player combat stats
export interface BonusEffects {
    speedMultiplier?: number;      // 1.0 = normal
    damageMultiplier?: number;     // 1.0 = normal
    healthMultiplier?: number;     // 1.0 = normal (applied at initialization)
    stunRateMultiplier?: number;   // 1.0 = normal
    specialChargeMultiplier?: number; // 1.0 = normal
    jumpMultiplier?: number;       // 1.0 = normal
    blockReduction?: number;       // 0.6 = 60% reduction (default)
    vampirism?: number;            // HP healed per hit
    perfectBlockWindowBonus?: number; // Additional ms for perfect block window
}

export interface GameConfig {
    canvas: HTMLCanvasElement;
    player1Loadout?: Loadout;
    player2Loadout?: Loadout;
    player1Skin?: string;
    player2Skin?: string;
    player1MaxHealth?: number;     // Custom max health for player 1
    player1StartingHealth?: number; // Starting health (for carry-over between levels)
    player2MaxHealth?: number;     // Custom max health for player 2 (AI)
    player1BonusEffects?: BonusEffects; // Campaign bonus effects
    mode?: GameMode;
    myPlayerNumber?: 1 | 2;  // Nur für Online-Modus
    onInput?: InputCallback; // Callback für Netzwerk-Inputs
    aiDifficulty?: AIDifficulty; // AI difficulty for local mode
    parallaxConfig?: ParallaxConfig; // Background configuration
    onHealthChange?: (player: 1 | 2, health: number, maxHealth: number) => void;
    onStunMeterChange?: (player: 1 | 2, stunMeter: number) => void;
    onSpecialMeterChange?: (specialMeter: number) => void; // Player special meter
    onStunStart?: (player: 1 | 2) => void;
    onStunEnd?: (player: 1 | 2) => void;
    onHit?: (attacker: 1 | 2, defender: 1 | 2, damage: number, blocked: boolean) => void;
    onKO?: (loser: 1 | 2) => void;
    onAIPause?: (paused: boolean) => void; // Callback when AI is paused/resumed
    onAITelegraph?: (attackType: 'light' | 'heavy' | 'special', totalTimeMs: number) => void; // Callback when AI is about to attack
}

export class FightGame {
    // Spine
    private spineManager!: SpineGameManager;

    // Players
    private player1!: FighterController;
    private player2!: FighterController;

    // Input
    private inputManager!: GameInputManager;

    // AI (for local/single-player mode)
    private ai: FighterAI | null = null;
    private aiUpdateInterval: ReturnType<typeof setInterval> | null = null;

    // Combat System
    private combatSystem!: CombatSystem;
    private combatText!: CombatTextRenderer;

    // Config
    private config: GameConfig;

    // State
    private isInitialized: boolean = false;

    constructor(config: GameConfig) {
        this.config = {
            mode: 'local',
            myPlayerNumber: 1,
            aiDifficulty: 'medium',
            ...config
        };
    }

    // ============================================
    // Initialization
    // ============================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // 1. Setup Spine Game Manager
        this.spineManager = new SpineGameManager(this.config.canvas);

        // Set parallax background
        const parallaxConfig = this.config.parallaxConfig ?? CITY1_PARALLAX;
        this.spineManager.setParallaxConfig(parallaxConfig);

        await this.spineManager.initialize();
        
        // Set camera mode based on game mode
        // PvAI (local): camera follows only player, AI movement doesn't scroll background
        // PvP (online): camera follows center between both players
        this.spineManager.setCameraFollowPlayerOnly(this.config.mode === 'local');

        // 2. Load fighters
        await this.loadFighters();

        // 3. Setup input
        this.setupInput();

        // 4. Setup Combat System
        this.setupCombatSystem();

        // 5. Setup F4 key listener for AI pause/resume
        this.setupAIToggle();

        // 6. Setup update callback
        this.spineManager.setUpdateCallback((delta) => this.update(delta));

        // 6. Setup post-render callback for combat text
        this.spineManager.setPostRenderCallback(() => this.combatText?.render());

        // 7. Start render loop
        this.spineManager.startRenderLoop();

        this.isInitialized = true;
    }

    private setupCombatSystem(): void {
        // Initialize combat text renderer
        this.combatText = new CombatTextRenderer({
            canvas: this.config.canvas
        });

        // Get health values (use config values or defaults)
        // In campaign mode, these are pre-calculated with bonus effects
        const player1Health = this.config.player1MaxHealth ?? (this.config.mode === 'local' ? 100 : 100);
        const player1StartHealth = this.config.player1StartingHealth ?? player1Health;
        const player2Health = this.config.player2MaxHealth ?? (this.config.mode === 'local' ? 200 : 100);
        
        // Get bonus effects for player 1 (campaign bonuses)
        const bonusEffects = this.config.player1BonusEffects ?? {};

        this.combatSystem = new CombatSystem({
            player1: this.player1,
            player2: this.player2,
            player1MaxHealth: player1Health,
            player1StartingHealth: player1StartHealth,
            player2MaxHealth: player2Health,
            player1DamageMultiplier: bonusEffects.damageMultiplier,
            player1BlockReduction: bonusEffects.blockReduction,
            player1Vampirism: bonusEffects.vampirism,
            player1StunMultiplier: bonusEffects.stunRateMultiplier,
            player1SpecialChargeMultiplier: bonusEffects.specialChargeMultiplier,
            player1PerfectBlockWindowBonus: bonusEffects.perfectBlockWindowBonus,
            onHealthChange: this.config.onHealthChange,
            onStunMeterChange: this.config.onStunMeterChange,
            onSpecialMeterChange: this.config.onSpecialMeterChange,
            onStunStart: this.config.onStunStart,
            onStunEnd: this.config.onStunEnd,
            onHit: (attacker, defender, damage, blocked, hitZone, perfectBlock) => {
                // Show floating combat text at top center of screen
                const centerX = 960; // Design width center (1920 / 2)
                const topY = 900;    // Top area in design coordinates (well above health bars)

                if (perfectBlock) {
                    this.combatText.showBlock(centerX, topY, true);
                } else if (blocked) {
                    this.combatText.showBlock(centerX, topY, false);
                    if (damage > 0) {
                        const isHeadshot = hitZone === 'head';
                        this.combatText.showDamage(damage, centerX, topY - 50, isHeadshot);
                    }
                } else if (hitZone === 'stomp') {
                    // Jump stomp attack
                    this.combatText.showStomp(centerX, topY);
                    this.combatText.showDamage(damage, centerX, topY - 100, false);
                } else if (damage > 0) {
                    const isHeadshot = hitZone === 'head';
                    this.combatText.showDamage(damage, centerX, topY, isHeadshot);
                }

                // NOTIFY AI when it gets hit - critical for anti-stunlock!
                if (defender === 2 && this.ai && !blocked) {
                    this.ai.onHit(performance.now());
                }

                // Call original callback
                this.config.onHit?.(attacker, defender, damage, blocked);
            },
            onKO: this.config.onKO
        });
        
        // Wire up special meter callbacks for player 1
        this.player1.setSpecialCallbacks(
            () => this.combatSystem.canUseSpecial(),
            () => this.combatSystem.consumeSpecialMeter()
        );
    }

    /**
     * Game logic update (called every frame)
     * @param delta Time since last frame in seconds
     */
    private update(delta: number): void {
        // Update fighter physics
        this.player1?.update(delta);
        this.player2?.update(delta);

        // Update combat system (collision detection, damage)
        // Convert delta from seconds to milliseconds for combat system
        this.combatSystem?.update(delta * 1000);

        // Update combat text animations
        this.combatText?.update(delta);

        // Update AI if active
        // (AI update is handled by its own interval)
    }

    private async loadFighters(): Promise<void> {
        const p1Skin = this.config.player1Skin || 'black';
        const p2Skin = this.config.player2Skin || 'red';

        // Design-Koordinaten (basierend auf 1920x1080)
        // Fighter werden mittig im unteren Bereich positioniert
        const centerX = 960;  // Mitte des Design-Viewports
        const groundY = 250;  // Bodenlinie
        const fighterSpacing = 550; // Abstand vom Zentrum (weiter an den Rand)

        // World boundaries
        const minX = 100;
        const maxX = 1820;

        // Load Player 1 (left side, facing right)
        this.spineManager.createFighter('player1', centerX - fighterSpacing, groundY, p1Skin);
        const adapter1 = this.spineManager.getAdapter('player1');
        adapter1.setFacingRight(true);

        // Get bonus effects for movement multipliers (campaign mode)
        const bonusEffects = this.config.player1BonusEffects ?? {};

        this.player1 = new FighterController({
            spine: adapter1,
            playerId: 1,
            defaultLoadout: this.config.player1Loadout || 'bare',
            startX: centerX - fighterSpacing,
            startY: groundY,
            groundY: groundY,
            minX: minX,
            maxX: maxX,
            facingRight: true,
            speedMultiplier: bonusEffects.speedMultiplier,
            jumpMultiplier: bonusEffects.jumpMultiplier
        });

        // Load Player 2 (right side, facing left)
        this.spineManager.createFighter('player2', centerX + fighterSpacing, groundY, p2Skin);
        const adapter2 = this.spineManager.getAdapter('player2');
        adapter2.setFacingRight(false);

        this.player2 = new FighterController({
            spine: adapter2,
            playerId: 2,
            defaultLoadout: this.config.player2Loadout || 'bare',
            startX: centerX + fighterSpacing,
            startY: groundY,
            groundY: groundY,
            minX: minX,
            maxX: maxX,
            facingRight: false
        });

        // Enter combat mode
        this.player1.enterCombat(true);
        this.player2.enterCombat(true);

        // Setup debug renderer with player references and boundaries
        this.spineManager.setDebugPlayers(this.player1, this.player2);
        this.spineManager.setDebugBoundaries(minX, maxX);
    }

    private setupInput(): void {
        this.inputManager = new GameInputManager();
        
        // Set canvas for pointer lock support
        this.inputManager.setCanvas(this.config.canvas);

        if (this.config.mode === 'online') {
            // Online: Nur eigenen Spieler registrieren (erstmal Player 1)
            // Wird bei setMyPlayerNumber() aktualisiert wenn nötig
            const myPlayer = this.config.myPlayerNumber === 1 ? this.player1 : this.player2;
            const myBindings = PLAYER1_BINDINGS; // Online-Spieler nutzen immer WASD

            this.inputManager.registerPlayer(
                this.config.myPlayerNumber!,
                myPlayer,
                myBindings,
                this.config.onInput
            );
        } else {
            // Local/Single-Player: Player 1 with WASD, AI controls Player 2
            this.inputManager.registerPlayer(1, this.player1, PLAYER1_BINDINGS);
            this.setupAI();
        }

        this.inputManager.start();
    }

    private setupAI(): void {
        this.ai = new FighterAI({
            difficulty: this.config.aiDifficulty || 'medium',
            fighter: this.player2,
            getPlayerFighter: () => this.player1,
            getPlayerPosition: () => this.spineManager.getFighterPosition('player1').x,
            getAIPosition: () => this.spineManager.getFighterPosition('player2').x
        });

        // Connect telegraph callback if provided
        if (this.config.onAITelegraph) {
            this.ai.onTelegraph = this.config.onAITelegraph;
        }

        // Start AI update loop (runs at ~60fps)
        this.ai.start();
        this.aiUpdateInterval = setInterval(() => {
            if (this.ai) {
                this.ai.update(16.67, performance.now());
            }
        }, 16);
    }

    private setupAIToggle(): void {
        if (this.config.mode !== 'local') return; // Only for local mode

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'F4') {
                e.preventDefault();
                if (this.ai) {
                    const currentlyActive = this.ai.getActive();
                    if (currentlyActive) {
                        this.ai.stop();
                        console.log('[Game] AI Paused (F4)');
                    } else {
                        this.ai.start();
                        console.log('[Game] AI Resumed (F4)');
                    }
                    this.config.onAIPause?.(!currentlyActive);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
    }

    // ============================================
    // Public API - Health
    // ============================================

    getPlayer1Health(): number {
        return this.combatSystem?.getPlayer1Health() ?? 100;
    }

    getPlayer2Health(): number {
        return this.combatSystem?.getPlayer2Health() ?? 100;
    }

    isMatchActive(): boolean {
        return this.combatSystem?.isMatchActive() ?? true;
    }

    resetMatch(): void {
        // Reset combat system (health, stun, etc.)
        this.combatSystem?.reset();
        
        // Reset fighter positions to starting positions
        const centerX = 960;
        const fighterSpacing = 550;
        
        this.player1?.reset(centerX - fighterSpacing, true);
        this.player2?.reset(centerX + fighterSpacing, false);
        
        // Restart AI if in local mode
        if (this.config.mode === 'local' && this.ai) {
            this.ai.stop();
            this.ai.start();
        }
    }

    // ============================================
    // Public API - Player Control
    // ============================================

    /**
     * Ändert welchen Spieler wir steuern (für Online-Modus)
     * Wird aufgerufen wenn Server uns als Player 1 oder 2 zuweist
     */
    setMyPlayerNumber(playerNumber: 1 | 2): void {
        if (this.config.myPlayerNumber === playerNumber) return;

        this.config.myPlayerNumber = playerNumber;

        // Input-Handler neu registrieren für den richtigen Spieler
        if (this.config.mode === 'online' && this.inputManager) {
            // Alten Handler entfernen
            this.inputManager.unregisterPlayer(this.config.myPlayerNumber === 1 ? 2 : 1);
            this.inputManager.unregisterPlayer(playerNumber);

            // Neuen Handler für korrekten Spieler
            const myPlayer = playerNumber === 1 ? this.player1 : this.player2;
            this.inputManager.registerPlayer(
                playerNumber,
                myPlayer,
                PLAYER1_BINDINGS, // Immer WASD
                this.config.onInput
            );
        }
    }

    getPlayer1(): FighterController {
        return this.player1;
    }

    getPlayer2(): FighterController {
        return this.player2;
    }

    getMyPlayer(): FighterController {
        return this.config.myPlayerNumber === 1 ? this.player1 : this.player2;
    }

    getOpponentPlayer(): FighterController {
        return this.config.myPlayerNumber === 1 ? this.player2 : this.player1;
    }

    setPlayer2Visible(visible: boolean): void {
        this.spineManager?.setFighterVisible('player2', visible);
    }

    setPlayer1Visible(visible: boolean): void {
        this.spineManager?.setFighterVisible('player1', visible);
    }

    // AI Control
    setAIDifficulty(difficulty: AIDifficulty): void {
        if (this.ai) {
            this.ai.setDifficulty(difficulty);
        }
        this.config.aiDifficulty = difficulty;
    }

    getAIDifficulty(): AIDifficulty {
        return this.config.aiDifficulty || 'medium';
    }

    getAI(): FighterAI | null {
        return this.ai;
    }

    /**
     * Check if AI is currently telegraphing an attack
     * Can be used to show a warning indicator to the player
     */
    isAITelegraphing(): boolean {
        return this.ai?.isTelegraphing() ?? false;
    }

    // ============================================
    // Debug Methods
    // ============================================

    /**
     * Toggle debug hitbox visualization (press F3)
     */
    toggleDebug(): void {
        this.spineManager?.toggleDebug();
    }

    /**
     * Set debug mode enabled/disabled
     */
    setDebugEnabled(enabled: boolean): void {
        this.spineManager?.setDebugEnabled(enabled);
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugEnabled(): boolean {
        return this.spineManager?.isDebugEnabled() ?? false;
    }

    pause(): void {
        if (this.config.mode === 'local' && this.ai) {
            this.ai?.stop();
        }
    }

    resume(): void {
        if (this.config.mode === 'local' && this.ai) {
            this.ai.start();
        }
    }

    dispose(): void {
        // Stop AI
        if (this.aiUpdateInterval) {
            clearInterval(this.aiUpdateInterval);
            this.aiUpdateInterval = null;
        }
        this.ai?.stop();
        this.ai = null;

        this.inputManager?.stop();
        this.spineManager?.dispose();
    }
}
