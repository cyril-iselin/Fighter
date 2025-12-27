// ============================================================================
// AI SELECTION SERVICE
// ============================================================================
// Central service for managing available AI profiles and creating brains
// Provides reactive state for UI components
// ============================================================================

import { Injectable, signal, computed } from '@angular/core';
import type { IFighterBrain } from './brain.interface';
import type { CharacterAIProfile } from './profiles/types';
import { GenericBasicBrain } from './profiles/generic-basic-brain';
import { DebugBrain } from './debug-brain';
import { SeededRNG } from './rng';

// ============================================================================
// TYPES
// ============================================================================

/**
 * AI option for selection UI
 */
export interface AIOption {
  /** Unique identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Short description */
  readonly description: string;
  /** Character this AI is designed for (or 'any' for generic) */
  readonly forCharacter: string;
  /** Difficulty rating (1-5) */
  readonly difficulty: number;
  /** Tags for filtering */
  readonly tags: readonly string[];
}

/**
 * Registered AI with profile
 */
interface RegisteredAI {
  readonly option: AIOption;
  readonly profile: CharacterAIProfile;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class AISelectionService {
  // Registry of available AIs
  private readonly registry = new Map<string, RegisteredAI>();

  // Reactive state
  private readonly _availableAIs = signal<AIOption[]>([]);
  private readonly _selectedAIId = signal<string | null>(null);

  // Public computed signals
  readonly availableAIs = computed(() => this._availableAIs());
  readonly selectedAIId = computed(() => this._selectedAIId());
  readonly selectedAI = computed(() => {
    const id = this._selectedAIId();
    return id ? this._availableAIs().find(ai => ai.id === id) ?? null : null;
  });

  constructor() {
    console.log('[AISelectionService] Initialized');
  }

  // ============================================================================
  // REGISTRATION
  // ============================================================================

  /**
   * Register an AI profile with selection metadata
   */
  registerAI(profile: CharacterAIProfile, option: Partial<AIOption> = {}): void {
    const fullOption: AIOption = {
      id: option.id ?? profile.characterId,
      name: option.name ?? profile.name,
      description: option.description ?? `Default AI for ${profile.characterId}`,
      forCharacter: option.forCharacter ?? profile.characterId,
      difficulty: option.difficulty ?? 3,
      tags: option.tags ?? ['default'],
    };

    this.registry.set(fullOption.id, { option: fullOption, profile });
    this.updateAvailableAIs();
    
    console.log(`[AISelectionService] Registered AI: ${fullOption.name}`);
  }

  /**
   * Register multiple AI variants for a character
   */
  registerAIVariants(
    baseProfile: CharacterAIProfile,
    variants: Array<{
      id: string;
      name: string;
      description: string;
      difficulty: number;
      profileOverrides: Partial<CharacterAIProfile>;
    }>
  ): void {
    for (const variant of variants) {
      const mergedProfile: CharacterAIProfile = {
        ...baseProfile,
        ...variant.profileOverrides,
        name: variant.name,
      };

      this.registerAI(mergedProfile, {
        id: variant.id,
        name: variant.name,
        description: variant.description,
        forCharacter: baseProfile.characterId,
        difficulty: variant.difficulty,
        tags: ['variant'],
      });
    }
  }

  private updateAvailableAIs(): void {
    const options = Array.from(this.registry.values()).map(r => r.option);
    this._availableAIs.set(options);
  }

  // ============================================================================
  // SELECTION
  // ============================================================================

  /**
   * Select an AI by ID
   */
  selectAI(id: string): void {
    if (!this.registry.has(id)) {
      console.warn(`[AISelectionService] Unknown AI ID: ${id}`);
      return;
    }
    this._selectedAIId.set(id);
    console.log(`[AISelectionService] Selected AI: ${id}`);
  }

  /**
   * Select default AI for a character
   */
  selectDefaultForCharacter(characterId: string): void {
    // Try character-specific default first
    if (this.registry.has(characterId)) {
      this.selectAI(characterId);
      return;
    }

    // Find any AI for this character
    const forCharacter = Array.from(this.registry.values())
      .find(r => r.option.forCharacter === characterId);
    
    if (forCharacter) {
      this.selectAI(forCharacter.option.id);
      return;
    }

    // Fallback to first available
    const first = this._availableAIs()[0];
    if (first) {
      this.selectAI(first.id);
    }
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this._selectedAIId.set(null);
  }

  // ============================================================================
  // BRAIN CREATION
  // ============================================================================

  /**
   * Create brain instance from selected AI
   */
  createBrain(options: { debug?: boolean; seed?: number } = {}): IFighterBrain | null {
    const id = this._selectedAIId();
    if (!id) {
      console.warn('[AISelectionService] No AI selected');
      return null;
    }
    return this.createBrainById(id, options);
  }

  /**
   * Create brain instance by AI ID
   */
  createBrainById(
    id: string,
    options: { debug?: boolean; seed?: number } = {}
  ): IFighterBrain | null {
    const registered = this.registry.get(id);
    if (!registered) {
      console.warn(`[AISelectionService] Unknown AI ID: ${id}`);
      return null;
    }

    const { profile } = registered;
    const rng = new SeededRNG(options.seed ?? 12345);

    let brain: IFighterBrain = new GenericBasicBrain(
      profile.characterId,
      profile,
      rng
    );

    if (options.debug) {
      brain = new DebugBrain(brain, {
        logInterval: 60,
        prefix: `[AI:${profile.characterId}]`,
      });
    }

    return brain;
  }

  /**
   * Get profile by AI ID
   */
  getProfile(id: string): CharacterAIProfile | null {
    return this.registry.get(id)?.profile ?? null;
  }

  // ============================================================================
  // FILTERING
  // ============================================================================

  /**
   * Get AIs for a specific character
   */
  getAIsForCharacter(characterId: string): AIOption[] {
    return this._availableAIs().filter(
      ai => ai.forCharacter === characterId || ai.forCharacter === 'any'
    );
  }

  /**
   * Get AIs by difficulty
   */
  getAIsByDifficulty(minDifficulty: number, maxDifficulty: number): AIOption[] {
    return this._availableAIs().filter(
      ai => ai.difficulty >= minDifficulty && ai.difficulty <= maxDifficulty
    );
  }

  /**
   * Get AIs by tag
   */
  getAIsByTag(tag: string): AIOption[] {
    return this._availableAIs().filter(ai => ai.tags.includes(tag));
  }
}
