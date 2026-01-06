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
     * @param bossX Boss's X position
     * @param currentTick Current game tick
     * @returns Event result if an event just ended, null otherwise
     */
    tick(
        bossHp: number, bossMaxHp: number, playerX: number, playerY: number, bossX: number, currentTick: number, cameraLeft: number, groundY: number): BossEventResult | null {
        const bossHpPercent = (bossHp / bossMaxHp) * 100;

        // If no active event, check if we should trigger one
        if (!this.activeEvent) {
            this.checkTriggers(bossHpPercent, playerX, bossX, currentTick);
            return null;
        }

        // Update active event
        return this.updateActiveEvent(playerX, playerY, currentTick, cameraLeft, groundY);
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
            successDelayTicks: 0, // Countdown after success before respawn
        } as any;
        
        this.activeEvent = activeEvent;

        // Notify callback
        this.callbacks.onEventStart?.(activeEvent);

        console.log(`[BossEventManager] Event triggered: ${definition.type} at ${definition.hpTrigger}% HP`);
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
        }
    }

    /**
     * Update active event state
     */
    private updateActiveEvent(
        playerX: number, playerY: number, currentTick: number, cameraLeft: number, groundY: number): BossEventResult | null {
        if (!this.activeEvent) return null;

        this.activeEvent.currentTick = currentTick;
        const elapsed = currentTick - this.activeEvent.startTick;
        const def = this.activeEvent.definition;

        const requiredSuccesses = def.requiredSuccesses ?? 1;
        const evt = this.activeEvent as any;

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
            const isInTarget = this.checkCondition(playerX, playerY, cameraLeft, groundY);

            // If player just entered target zone and hasn't been counted yet
            if (isInTarget && !this.activeEvent.conditionMet) {
                this.activeEvent.conditionMet = true;
                this.activeEvent.successCount++;

                console.log(`[EventManager] Success ${this.activeEvent.successCount}/${requiredSuccesses}!`);

                // Check if all successes achieved
                if (this.activeEvent.successCount >= requiredSuccesses) {
                    console.log(`[EventManager] All successes completed! Resolving as SUCCESS.`);
                    return this.resolveEvent(true);
                }

                // More successes needed - start delay to show green state
                evt.successDelayTicks = SUCCESS_DELAY_TICKS;
                console.log(`[EventManager] Starting success delay (${SUCCESS_DELAY_TICKS} ticks) before respawn...`);
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
        groundY: number
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
                const r = definition.targetRadius;
                const hit = (dx * dx + dy * dy) <= (r * r);
                return hit;
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
