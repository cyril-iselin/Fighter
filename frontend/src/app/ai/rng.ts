// ============================================================================
// RANDOM NUMBER GENERATOR (Seedable, Deterministic)
// ============================================================================

/**
 * RNG Interface for deterministic AI behavior
 */
export interface IRNG {
  /**
   * Returns a random float in [0, 1)
   */
  next(): number;

  /**
   * Returns a random integer in [0, max)
   */
  nextInt(max: number): number;

  /**
   * Returns true with given probability
   */
  chance(probability: number): boolean;

  /**
   * Resets RNG to initial seed
   */
  reset(): void;
}

/**
 * Simple LCG (Linear Congruential Generator)
 * Deterministic, seedable, fast
 */
export class SeededRNG implements IRNG {
  private state: number;
  private readonly initialSeed: number;

  // LCG parameters (from Numerical Recipes)
  private readonly a = 1664525;
  private readonly c = 1013904223;
  private readonly m = 2 ** 32;

  constructor(seed: number = 12345) {
    this.initialSeed = seed;
    this.state = seed;
  }

  next(): number {
    this.state = (this.a * this.state + this.c) % this.m;
    return this.state / this.m;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  reset(): void {
    this.state = this.initialSeed;
  }
}

/**
 * Default RNG instance (can be replaced for testing)
 */
export const defaultRNG: IRNG = new SeededRNG();
