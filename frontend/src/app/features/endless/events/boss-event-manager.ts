// ============================================================================
// BOSS EVENT MANAGER
// ============================================================================
// Orchestrates boss fight events: triggers at HP thresholds, tracks state,
// checks win/lose conditions, and reports results
// ============================================================================

import type {
    BossEventDefinition,
    ActiveBossEvent,
    BossEventResult,
    BossEventCallbacks,
} from './boss-event.types';
import { PHYSICS, TICK_RATE } from '../../../core/config';
import { getDummy } from '../../../dummies/dummy-registry';

/** Delay after success before spawning next target (so green state is visible) */
const SUCCESS_DELAY_TICKS = Math.floor(TICK_RATE * 0.5); // 0.5 seconds

export class BossEventManager {
    /** Events configured for this fight */
    private eventDefinitions: BossEventDefinition[] = [];

    /** HP thresholds already triggered (to prevent re-triggering) */
    private triggeredThresholds: Set<number> = new Set();

    /** Currently active event (null if none) */
    private activeEvent: ActiveBossEvent | null = null;

    /** Callbacks for event lifecycle */
    private callbacks: BossEventCallbacks = {};

    /** Last known boss HP percentage */
    private lastBossHpPercent: number = 100;

    constructor(events: BossEventDefinition[] = [], callbacks: BossEventCallbacks = {}) {
        this.eventDefinitions = events;
        this.callbacks = callbacks;
    }

    /**
     * Reset manager for a new fight
     */
    reset(): void {
        this.triggeredThresholds.clear();
        this.activeEvent = null;
        this.lastBossHpPercent = 100;
    }

    /**
     * Check if an event is currently active
     */
    isEventActive(): boolean {
        return this.activeEvent !== null;
    }

    /**
     * Get the currently active event (if any)
     */
    getActiveEvent(): ActiveBossEvent | null {
        return this.activeEvent;
    }

    /**
     * Main tick function - call every game tick
     * @param bossHp Current boss HP
     * @param bossMaxHp Boss maximum HP
     * @param playerX Player's X position
     * @param playerY Player's Y position
     * @param bossX Boss's X position
     * @param currentTick Current game tick
     * @param cameraLeft Camera left position for rendering
     * @param groundY Ground Y position for rendering
     * @param playerAttacking Is player currently in attack state? (for dummy-wave)
     * @param playerFacingRight Is player facing right? (for dummy-wave)
     * @param playerHitbox Player's hitbox for collision (for dummy-wave)
     * @param currentDummyX Current dummy X position from renderer (for dummy-wave)
     * @returns Event result if an event just ended, null otherwise
     */
    tick(
        bossHp: number,
        bossMaxHp: number,
        playerX: number,
        playerY: number,
        bossX: number,
        currentTick: number,
        cameraLeft: number,
        groundY: number,
        playerAttacking?: boolean,
        playerFacingRight?: boolean,
        playerHitbox?: { x: number; y: number; width: number; height: number },
        currentDummyX?: number
    ): BossEventResult | null {
        const bossHpPercent = (bossHp / bossMaxHp) * 100;

        // If no active event, check if we should trigger one
        if (!this.activeEvent) {
            this.checkTriggers(bossHpPercent, playerX, bossX, currentTick);
            return null;
        }

        // Update active event
        return this.updateActiveEvent(
            playerX,
            playerY,
            currentTick,
            cameraLeft,
            groundY,
            playerAttacking,
            playerFacingRight,
            playerHitbox,
            currentDummyX
        );
    }

    /**
     * Check HP thresholds and trigger events
     */
    private checkTriggers(
        bossHpPercent: number,
        playerX: number,
        bossX: number,
        currentTick: number
    ): void {
        // Find events that should trigger (HP dropped below threshold)
        for (const event of this.eventDefinitions) {
            // Skip if already triggered
            if (this.triggeredThresholds.has(event.hpTrigger)) continue;

            // Check if we crossed this threshold
            if (this.lastBossHpPercent > event.hpTrigger && bossHpPercent <= event.hpTrigger) {
                this.triggerEvent(event, playerX, bossX, currentTick);
                break; // Only one event at a time
            }
        }

        this.lastBossHpPercent = bossHpPercent;
    }

    /**
     * Start an event
     */
    private triggerEvent(
        definition: BossEventDefinition,
        playerX: number,
        bossX: number,
        currentTick: number
    ): void {
        // Mark as triggered
        this.triggeredThresholds.add(definition.hpTrigger);

        // Calculate target position (first spawn - no previous position)
        const targetPosition = this.calculateTargetPosition(definition);

        // Create active event
        const activeEvent: ActiveBossEvent = {
            definition,
            startTick: currentTick,
            currentTick,
            targetPosition,
            conditionMet: false,
            successCount: 0,
            phase: 'active',
            successDelayTicks: 0, // Countdown after success before respawn
            holdTime: 0, // Ticks spent inside target (for ground-circle)
        } as any;

        // Initialize dummy-wave specific state
        if (definition.type === 'dummy-wave') {
            const evt = activeEvent as any;
            evt.dummyKilledCount = 0;
            evt.spawnDelayCounter = 0;

            // Spawn first dummy (groundY will be passed from tick)
            // Note: groundY is not available here yet, will be set by callback
            this.spawnDummy(activeEvent, targetPosition.x, 0);
        }

        this.activeEvent = activeEvent;

        // Notify callback
        this.callbacks.onEventStart?.(activeEvent);

        console.log(`[BossEventManager] Event triggered: ${definition.type} at ${definition.hpTrigger}% HP`);
    }

    /**
     * Spawn a dummy for dummy-wave event
     */
    private spawnDummy(event: ActiveBossEvent, x: number, groundY: number): void {
        const def = event.definition;
        if (def.type !== 'dummy-wave') return;

        // Select random dummy from pool
        const dummyId = def.dummyIds[Math.floor(Math.random() * def.dummyIds.length)];

        // Determine facing direction (face towards center)
        const arenaCenter = (PHYSICS.minX + PHYSICS.maxX) / 2;
        const facing = x < arenaCenter ? 1 : -1;

        // Create dummy state (HP will be set from dummy definition by callback)
        const evt = event as any;
        evt.currentDummy = {
            dummyId,
            x,
            y: groundY, // Spawn at stage-specific ground level
            facing,
            hp: 100, // Default, callback should update this
            maxHp: 100,
            alive: true,
            deathAnimationTicks: 0
        };

        // Request spawn via callback
        this.callbacks.onDummySpawnRequest?.(dummyId, x, groundY, facing);

        console.log(`[BossEventManager] Spawned dummy: ${dummyId} at x=${x.toFixed(0)}`);
    }

    /**
     * Update dummy-wave event logic
     */
    private updateDummyWaveEvent(
        playerX: number,
        playerY: number,
        cameraLeft: number,
        groundY: number,
        playerAttacking?: boolean,
        playerFacingRight?: boolean,
        playerHitbox?: { x: number; y: number; width: number; height: number },
        elapsed?: number,
        currentDummyX?: number
    ): BossEventResult | null {
        if (!this.activeEvent) return null;
        const def = this.activeEvent.definition;
        if (def.type !== 'dummy-wave') return null;

        const evt = this.activeEvent as any;
        const dummy = evt.currentDummy;

        // Handle spawn delay counter
        if (evt.spawnDelayCounter > 0) {
            evt.spawnDelayCounter--;

            // Spawn next dummy when delay expires (only if no current dummy)
            if (evt.spawnDelayCounter === 0 && evt.dummyKilledCount < def.totalDummies && !evt.currentDummy) {
                const newPosition = this.calculateTargetPosition(def, evt.currentDummy?.x);
                // groundY is passed from updateDummyWaveEvent
                this.spawnDummy(this.activeEvent, newPosition.x, groundY);
            }
        }

        // Handle death animation
        if (dummy && !dummy.alive && dummy.deathAnimationTicks > 0) {
            dummy.deathAnimationTicks--;

            // Animation complete - check victory or spawn next
            if (dummy.deathAnimationTicks === 0) {
                // Notify that animation is complete (so renderer can cleanup)
                this.callbacks.onDummyAnimationComplete?.();

                evt.currentDummy = null;

                // Check if all dummies defeated
                if (evt.dummyKilledCount >= def.totalDummies) {
                    console.log(`[EventManager] All dummies defeated! Resolving as SUCCESS.`);
                    return this.resolveEvent(true);
                }

                // Start spawn delay for next dummy
                evt.spawnDelayCounter = def.spawnDelayTicks;
            }
        }

        // Check for hit on dummy
        if (dummy && dummy.alive) {
            const isHit = this.checkCondition(
                playerX,
                playerY,
                cameraLeft,
                groundY,
                playerAttacking,
                playerFacingRight,
                playerHitbox,
                currentDummyX
            );

            if (isHit) {
                // Kill dummy
                dummy.alive = false;
                dummy.deathAnimationTicks = 25; // ~0.4s animation
                evt.dummyKilledCount++;

                console.log(`[EventManager] Dummy killed! ${evt.dummyKilledCount}/${def.totalDummies}`);

                // Notify callback
                this.callbacks.onDummyDeath?.(dummy.dummyId, dummy.x, dummy.y);
            }
        }

        // Check if time ran out
        if (elapsed !== undefined && elapsed >= def.durationTicks) {
            console.log(`[EventManager] Time ran out! Resolving as FAIL.`);
            return this.resolveEvent(false);
        }

        this.callbacks.onEventTick?.(this.activeEvent);
        return null;
    }

    /**
     * Calculate where the event target should appear
     * Always random spawn, with minimum distance from previous position to avoid overlap
     */
    private calculateTargetPosition(
        definition: BossEventDefinition,
        previousX?: number
    ): { x: number; y: number } {
        switch (definition.type) {
            case 'ground-circle': {
                let targetX: number;

                // Try to spawn away from previous position
                if (previousX !== undefined) {
                    // Spawn on opposite side or far away
                    const arenaCenter = (PHYSICS.minX + PHYSICS.maxX) / 2;
                    const isLeftSide = previousX < arenaCenter;
                    const preferredSide = isLeftSide ? 1 : -1; // Opposite side

                    const sideMin = preferredSide > 0 ? arenaCenter : PHYSICS.minX;
                    const sideMax = preferredSide > 0 ? PHYSICS.maxX : arenaCenter;

                    targetX = sideMin + Math.random() * (sideMax - sideMin);
                } else {
                    // First spawn - anywhere in arena
                    targetX = PHYSICS.minX + Math.random() * (PHYSICS.maxX - PHYSICS.minX);
                }

                return { x: targetX, y: 0 };
            }

            case 'quick-dash': {
                let targetX: number;

                // Try to spawn away from previous position
                if (previousX !== undefined) {
                    // Spawn on opposite side or far away
                    const arenaCenter = (PHYSICS.minX + PHYSICS.maxX) / 2;
                    const isLeftSide = previousX < arenaCenter;
                    const preferredSide = isLeftSide ? 1 : -1; // Opposite side

                    const sideMin = preferredSide > 0 ? arenaCenter : PHYSICS.minX;
                    const sideMax = preferredSide > 0 ? PHYSICS.maxX : arenaCenter;

                    targetX = sideMin + Math.random() * (sideMax - sideMin);
                } else {
                    // First spawn - anywhere in arena
                    targetX = PHYSICS.minX + Math.random() * (PHYSICS.maxX - PHYSICS.minX);
                }

                // Add random height variation (0-100) for variety
                const baseHeight = definition.spawnHeight ?? 0;
                const height = baseHeight + Math.random() * 100;
                return { x: targetX, y: height };
            }

            case 'dummy-wave': {
                let targetX: number;

                // Try to spawn away from previous position
                if (previousX !== undefined) {
                    // Spawn on opposite side or far away
                    const arenaCenter = (PHYSICS.minX + PHYSICS.maxX) / 2;
                    const isLeftSide = previousX < arenaCenter;
                    const preferredSide = isLeftSide ? 1 : -1; // Opposite side

                    const sideMin = preferredSide > 0 ? arenaCenter : PHYSICS.minX;
                    const sideMax = preferredSide > 0 ? PHYSICS.maxX : arenaCenter;

                    targetX = sideMin + Math.random() * (sideMax - sideMin);
                } else {
                    // First spawn - anywhere in arena
                    targetX = PHYSICS.minX + Math.random() * (PHYSICS.maxX - PHYSICS.minX);
                }

                // Dummies spawn on ground
                return { x: targetX, y: 0 };
            }
        }
    }

    /**
     * Update active event state
     */
    private updateActiveEvent(
        playerX: number,
        playerY: number,
        currentTick: number,
        cameraLeft: number,
        groundY: number,
        playerAttacking?: boolean,
        playerFacingRight?: boolean,
        playerHitbox?: { x: number; y: number; width: number; height: number },
        currentDummyX?: number
    ): BossEventResult | null {
        if (!this.activeEvent) return null;

        this.activeEvent.currentTick = currentTick;
        const elapsed = currentTick - this.activeEvent.startTick;
        const def = this.activeEvent.definition;

        const requiredSuccesses = def.requiredSuccesses ?? 1;
        const evt = this.activeEvent as any;

        // Handle dummy-wave specific logic
        if (def.type === 'dummy-wave') {
            return this.updateDummyWaveEvent(playerX, playerY, cameraLeft, groundY, playerAttacking, playerFacingRight, playerHitbox, elapsed, currentDummyX);
        }

        // If in success delay countdown, decrement and skip condition check
        if (evt.successDelayTicks > 0) {
            evt.successDelayTicks--;

            // When delay expires, respawn at new location
            if (evt.successDelayTicks === 0) {
                this.activeEvent.targetPosition = this.calculateTargetPosition(
                    def,
                    this.activeEvent.targetPosition.x
                );
                this.activeEvent.conditionMet = false; // Reset for next catch

                console.log(`[EventManager] Respawning at new position: x=${this.activeEvent.targetPosition.x.toFixed(0)} y=${this.activeEvent.targetPosition.y.toFixed(0)}`);
            }
        } else {
            // Normal condition checking - not in delay
            const isInTarget = this.checkCondition(playerX, playerY, cameraLeft, groundY, playerAttacking, playerFacingRight, playerHitbox);

            // Ground circle: requires holding for time
            if (def.type === 'ground-circle') {
                const REQUIRED_HOLD_TICKS = 30; // 0.5 seconds @ 60fps
                const evt = this.activeEvent as any;

                if (isInTarget) {
                    evt.holdTime = (evt.holdTime || 0) + 1;

                    // Check if held long enough
                    if (evt.holdTime >= REQUIRED_HOLD_TICKS && !this.activeEvent.conditionMet) {
                        this.activeEvent.conditionMet = true;
                        this.activeEvent.successCount++;
                        console.log(`[EventManager] Ground circle success ${this.activeEvent.successCount}/${requiredSuccesses}!`);

                        // Check if all successes achieved
                        if (this.activeEvent.successCount >= requiredSuccesses) {
                            console.log(`[EventManager] All successes completed! Resolving as SUCCESS.`);
                            return this.resolveEvent(true);
                        }

                        // More successes needed - start delay
                        evt.successDelayTicks = SUCCESS_DELAY_TICKS;
                        evt.holdTime = 0; // Reset for next round
                    }
                } else {
                    // Not in target - reset hold time
                    evt.holdTime = 0;
                }
            } else {
                // Quick-dash: instant on touch
                if (isInTarget && !this.activeEvent.conditionMet) {
                    this.activeEvent.conditionMet = true;
                    this.activeEvent.successCount++;
                    console.log(`[EventManager] Quick-dash success ${this.activeEvent.successCount}/${requiredSuccesses}!`);

                    if (this.activeEvent.successCount >= requiredSuccesses) {
                        console.log(`[EventManager] All successes completed! Resolving as SUCCESS.`);
                        return this.resolveEvent(true);
                    }

                    const evt = this.activeEvent as any;
                    evt.successDelayTicks = SUCCESS_DELAY_TICKS;
                }
            }
        }

        this.callbacks.onEventTick?.(this.activeEvent);

        // Check if event duration is over - if time runs out, it's a FAIL
        if (elapsed >= def.durationTicks) {
            console.log(`[EventManager] Time ran out! Resolving as FAIL.`);
            return this.resolveEvent(false);
        }

        return null;
    }

    /**
     * Check if player is meeting the event condition
     */
    private checkCondition(
        playerX: number,
        playerY: number,
        cameraLeft: number,
        groundY: number,
        playerAttacking?: boolean,
        playerFacingRight?: boolean,
        playerHitbox?: { x: number; y: number; width: number; height: number },
        currentDummyX?: number
    ): boolean {
        if (!this.activeEvent) return false;
        const { definition, targetPosition } = this.activeEvent;

        const targetX = targetPosition.x - cameraLeft;

        const playerY_height = playerY - PHYSICS.groundY;
        const playerY_screen = groundY + playerY_height;
        const targetY_screen = groundY + targetPosition.y

        const dx = playerX - targetX;
        const dy = playerY_screen - targetY_screen;

        switch (definition.type) {
            case 'ground-circle': {
                const r = definition.radius;
                const hit = (dx * dx + dy * dy) <= (r * r);
                return hit;
            }

            case 'quick-dash': {
                const orbR = definition.targetRadius;
                const playerCatchR = 40;

                const r = orbR + playerCatchR;

                const yBias = -20;
                const dyBiased = dy + yBias;

                return (dx * dx + dyBiased * dyBiased) <= (r * r);
            }

            case 'dummy-wave': {
                if (!playerAttacking) return false;
                if (!playerHitbox) return false;
                if (currentDummyX === undefined) return false;

                const hitPaddingX = 60;
                const dummyW = 120 + hitPaddingX * 2;
                const dummyH = 250;

                const dummyX = currentDummyX - dummyW / 2;
                const dummyY = groundY - dummyH; // Dummy steht am Boden

                const overlap =
                    playerHitbox.x < dummyX + dummyW &&
                    playerHitbox.x + playerHitbox.width > dummyX &&
                    playerHitbox.y < dummyY + dummyH &&
                    playerHitbox.y + playerHitbox.height > dummyY;
                    
                return overlap;
            }
        }
    }

    /**
     * Resolve the event (success or failure)
     */
    private resolveEvent(success: boolean): BossEventResult {
        if (!this.activeEvent) {
            throw new Error('No active event to resolve');
        }

        const def = this.activeEvent.definition;

        const result: BossEventResult = {
            eventId: def.id,
            success,
            reward: success ? def.successReward : undefined,
            penalty: !success ? def.failPenalty : undefined,
        };

        console.log(`[BossEventManager] Event resolved: ${success ? 'SUCCESS' : 'FAIL'}`);

        // Notify callback
        this.callbacks.onEventEnd?.(result);

        // Clear active event
        this.activeEvent = null;

        return result;
    }

    /**
     * Force-end current event (e.g., if boss dies during event)
     */
    forceEnd(): void {
        this.activeEvent = null;
    }

    /**
     * Get progress of current event (0-1)
     */
    getProgress(): number {
        if (!this.activeEvent) return 0;

        const elapsed = this.activeEvent.currentTick - this.activeEvent.startTick;
        const duration = this.activeEvent.definition.durationTicks;

        return Math.max(0, Math.min(1, elapsed / duration));
    }

    /**
     * Get remaining time in seconds
     */
    getRemainingTime(): number {
        if (!this.activeEvent) return 0;

        const elapsed = this.activeEvent.currentTick - this.activeEvent.startTick;
        const remaining = this.activeEvent.definition.durationTicks - elapsed;

        return Math.max(0, remaining / 60); // Convert ticks to seconds
    }
}
