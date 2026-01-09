// ============================================================================
// DUMMY REGISTRY SYSTEM
// ============================================================================
// Central registration for all dummy characters (simple spritesheet enemies)
// Dummies are simpler than Spine characters - single walk animation + hitbox
// ============================================================================

/**
 * Hitbox configuration for a dummy
 */
export interface DummyHitbox {
  width: number;
  height: number;
  offsetX?: number;  // Offset from center
  offsetY?: number;  // Offset from bottom
}

/**
 * Animation configuration for spritesheet
 */
export interface DummyAnimation {
  frameRate: number;     // Frames per second
  frameCount?: number;   // Optional: limit frame count (auto-detected if not set)
}

/**
 * Complete dummy definition
 */
export interface DummyDefinition {
  id: string;
  name: string;
  
  // Asset paths
  spritesheetPath: string;  // Path to spritesheet image (e.g., 'assets/dummies/donald/texture.png')
  atlasPath: string;        // Path to atlas JSON (e.g., 'assets/dummies/donald/texture.json')
  
  // Visual properties
  scale: number;            // Render scale (1.0 = original size)
  flipX?: boolean;          // Flip sprite horizontally (for mirrored sprites)
  
  // Gameplay properties
  speed: number;            // Movement speed in pixels per second
  hp: number;               // Hit points
  
  // Hitbox
  hitbox: DummyHitbox;
  
  // Animation
  animation: DummyAnimation;
}

/**
 * Parsed atlas frame data (from texture.json)
 */
export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  pivot: { x: number; y: number };
}

/**
 * Parsed atlas data
 */
export interface AtlasData {
  frames: Record<string, AtlasFrame>;
  meta: {
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: number;
  };
}

// ============================================================================
// Registry Storage
// ============================================================================

const dummies = new Map<string, DummyDefinition>();

/**
 * Register a new dummy
 */
export function registerDummy(dummy: DummyDefinition): void {
  dummies.set(dummy.id, dummy);
  console.log(`[DummyRegistry] Registered dummy: ${dummy.name}`);
}

/**
 * Get dummy by ID
 */
export function getDummy(id: string): DummyDefinition | undefined {
  return dummies.get(id);
}

/**
 * List all registered dummies
 */
export function getAllDummies(): DummyDefinition[] {
  return Array.from(dummies.values());
}

/**
 * Check if a dummy exists
 */
export function hasDummy(id: string): boolean {
  return dummies.has(id);
}

// ============================================================================
// Atlas Loading Utilities
// ============================================================================

/**
 * Load and parse atlas JSON
 */
export async function loadAtlas(atlasPath: string): Promise<AtlasData> {
  const response = await fetch(atlasPath);
  if (!response.ok) {
    throw new Error(`Failed to load atlas: ${atlasPath}`);
  }
  return response.json();
}

/**
 * Load spritesheet image
 */
export async function loadSpritesheet(imagePath: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load spritesheet: ${imagePath}`));
    img.src = imagePath;
  });
}

/**
 * Get all animation frames from atlas (sorted numerically by name)
 */
export function getAnimationFrames(atlas: AtlasData): Array<{ name: string; frame: AtlasFrame }> {
  const frames: Array<{ name: string; frame: AtlasFrame }> = [];
  
  for (const [name, frame] of Object.entries(atlas.frames)) {
    frames.push({ name, frame });
  }
  
  // Sort by name numerically to ensure correct animation order
  // e.g., tile007.png, tile008.png, tile022.png -> sorted correctly
  frames.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  
  return frames;
}
