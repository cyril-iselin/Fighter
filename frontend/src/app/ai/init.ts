// ============================================================================
// AI INITIALIZATION
// ============================================================================
// Registers all character AI profiles at startup
// Called from app initialization
// ============================================================================

import { inject } from '@angular/core';
import { registerAIProfile } from './factory';
import { AISelectionService } from './ai-selection.service';

// Character AI Profiles
import { STICKMAN_AI_PROFILE } from '../characters/stickman/ai';
import { BOSS1_AI_PROFILE } from '../characters/boss1/ai';
import { BOSS2_AI_PROFILE } from '../characters/boss2/ai';
import { BOSS3_AI_PROFILE } from '../characters/boss3/ai';

/**
 * Initialize all AI profiles (for factory)
 * Call this once at app startup
 */
export function initializeAI(): void {
  console.log('[AI] Initializing AI profiles...');
  
  // Register all character profiles with factory
  registerAIProfile(STICKMAN_AI_PROFILE);
  registerAIProfile(BOSS1_AI_PROFILE);
  registerAIProfile(BOSS2_AI_PROFILE);
  registerAIProfile(BOSS3_AI_PROFILE);
  
  console.log('[AI] AI initialization complete');
}

/**
 * Initialize AI selection service with all profiles
 * Call this from a component or service that has DI access
 */
export function initializeAISelection(service: AISelectionService): void {
  console.log('[AI] Initializing AI selection service...');
  
  // Register Stickman variants
  service.registerAI(STICKMAN_AI_PROFILE, {
    id: 'stickman-normal',
    name: 'Stickman (Normal)',
    description: 'Balanced fighter, 80% light attacks',
    difficulty: 3,
    tags: ['default', 'balanced'],
  });
  
  // Register Boss1
  service.registerAI(BOSS1_AI_PROFILE, {
    id: 'boss1-aggressive',
    name: 'Boss1 (Aggressive)',
    description: 'Heavy attacks, high aggression',
    difficulty: 4,
    tags: ['boss', 'aggressive'],
  });
  
  // Register Boss2
  service.registerAI(BOSS2_AI_PROFILE, {
    id: 'boss2-defensive',
    name: 'Boss2 (Defensive)',
    description: 'Patient counter-attacker, berserker at low HP',
    difficulty: 4,
    tags: ['boss', 'defensive'],
  });
  
  // Register Boss3
  service.registerAI(BOSS3_AI_PROFILE, {
    id: 'boss3-tank',
    name: 'Boss3 (Tank)',
    description: 'Slow juggernaut, unstoppable at low HP',
    difficulty: 5,
    tags: ['boss', 'tank'],
  });
  
  // Select default
  service.selectAI('stickman-normal');
  
  console.log('[AI] AI selection service initialized');
}
