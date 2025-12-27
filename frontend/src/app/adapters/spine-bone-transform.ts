// ============================================================================
// Spine Bone Transform - Single Source of Truth for Bone Coordinate Transforms
// ============================================================================
//
// COORDINATE SYSTEMS:
// ------------------
// 1. Spine Local: Bone-relative coordinates (length along bone axis)
//    - X = along bone (0 = origin, bone.data.length = tip)
//    - Y = perpendicular to bone
//
// 2. Spine World: Design-space coordinates (1920x1080)
//    - Y+ is UP (standard Spine convention)
//    - skeleton.y = GROUND_Y - gameState.y
//
// 3. Canvas/Screen: Y+ is DOWN (standard canvas convention)
//    - Must flip Y: canvasY = DESIGN_HEIGHT - spineY
//
// KEY INSIGHT:
// bone.worldX/worldY gives the ORIGIN of the bone (joint position)
// To get the TIP (hand/foot), use: bone.localToWorld(boneLength, 0)
// Then flip Y for canvas rendering!
// ============================================================================

import * as spine from '@esotericsoftware/spine-webgl';
import type { BonePoint } from '../core/bone-samples';
import { quantize } from '../core/bone-samples';

// Design constants
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;
export const GROUND_Y = 250;

/**
 * Get a bone's TIP position (end point) in world coordinates.
 * This is where hands/feet visually appear.
 * 
 * NOTE: Coordinates are in Spine world space (same as WebGL ortho2d projection).
 * For Canvas 2D overlay, NO Y-flip needed because both coordinate systems align
 * after the CSS scaling.
 * 
 * @param skeleton - The Spine skeleton
 * @param boneName - Name of the bone (e.g., 'arm_R2' for right hand)
 * @returns World position of bone tip, or null if bone not found
 */
export function getBoneTip(skeleton: spine.Skeleton, boneName: string): BonePoint | null {
    const bone = skeleton.findBone(boneName);
    if (!bone) {
        console.warn(`[SpineBoneTransform] Bone not found: ${boneName}`);
        return null;
    }

    // Transform the tip (at bone length along local X axis) to world space
    const boneLength = bone.data.length;
    const worldPos = new spine.Vector2();
    bone.localToWorld(worldPos.set(boneLength, 0));

    // Return Spine world coordinates directly; skeleton mirroring is already baked into localToWorld
    return {
        x: quantize(worldPos.x),
        y: quantize(worldPos.y),
    };
}

/**
 * Get a bone's ORIGIN position (start point/joint) in world coordinates.
 * Use for bones like head/chest where origin IS the relevant point.
 * 
 * @param skeleton - The Spine skeleton
 * @param boneName - Name of the bone
 * @returns World position of bone origin, or null if bone not found
 */
export function getBoneOrigin(skeleton: spine.Skeleton, boneName: string): BonePoint | null {
    const bone = skeleton.findBone(boneName);
    if (!bone) {
        console.warn(`[SpineBoneTransform] Bone not found: ${boneName}`);
        return null;
    }

    // Transform the origin (0,0 in local space) to world space
    const worldPos = new spine.Vector2();
    bone.localToWorld(worldPos.set(0, 0));

    // Return Spine world coordinates directly; skeleton mirroring is already baked into localToWorld
    return {
        x: quantize(worldPos.x),
        y: quantize(worldPos.y),
    };
}

/**
 * Get bone TIP without quantization (for debugging raw positions)
 */
export function getBoneTipRaw(skeleton: spine.Skeleton, boneName: string): { x: number; y: number } | null {
    const bone = skeleton.findBone(boneName);
    if (!bone) return null;

    const worldPos = new spine.Vector2();
    bone.localToWorld(worldPos.set(bone.data.length, 0));

    return { x: worldPos.x, y: worldPos.y };
}

/**
 * Get bone ORIGIN without quantization (for debugging raw positions)
 */
export function getBoneOriginRaw(skeleton: spine.Skeleton, boneName: string): { x: number; y: number } | null {
    const bone = skeleton.findBone(boneName);
    if (!bone) return null;

    const worldPos = new spine.Vector2();
    bone.localToWorld(worldPos.set(0, 0));

    return { x: worldPos.x, y: worldPos.y };
}

/**
 * Convert game state position to Spine skeleton position
 * Note: Y-axis is inverted (game Y=0 is ground, Spine Y=GROUND_Y is ground)
 */
export function gameToSpinePosition(gameX: number, gameY: number): { x: number; y: number } {
    return {
        x: gameX,
        y: GROUND_Y - gameY  // Y is inverted
    };
}

/**
 * Convert Spine world position back to game coordinates
 * Inverse of gameToSpinePosition
 */
export function spineToGamePosition(spineX: number, spineY: number): { x: number; y: number } {
    return {
        x: spineX,
        y: GROUND_Y - spineY  // Y inversion is symmetric
    };
}

/**
 * Convert Spine world Y to Canvas Y
 * Spine: Y+ is up, Canvas: Y+ is down
 */
export function spineYToCanvasY(spineY: number): number {
    return DESIGN_HEIGHT - spineY;
}

// ============================================================================
// Bone Name Constants (match actual Spine skeleton structure for stickman)
// These are fallback values when character-specific mapping is not available
// ============================================================================
export const ATTACK_BONES = {
    RIGHT_HAND: 'arm_R2',   // Right forearm - tip is hand position
    LEFT_HAND: 'arm_L2',    // Left forearm - tip is hand position
    RIGHT_FOOT: 'leg_R2',   // Right shin - tip is foot position
    LEFT_FOOT: 'leg_L2',    // Left shin - tip is foot position
} as const;

export const HURTBOX_BONES = {
    HEAD: 'head',           // Head bone - origin is head center
    CHEST: 'chest',         // Chest bone - origin is chest center
} as const;
