// ============================================
// Spine Fighter View - Per-Fighter Rendering Adapter
// ============================================
// Responsible for:
// - Animation playback
// - Bone world positions
// - Attachment vertex calculations (weapon line, etc.)
// ============================================

import * as spine from '@esotericsoftware/spine-webgl';
import { SpinePlayer, SpineTrackEntry } from './types';

// ============================================
// Spine Instance (raw Spine data)
// ============================================

export interface SpineInstance {
  id: string;
  skeleton: spine.Skeleton;
  state: spine.AnimationState;
  bounds: { x: number; y: number; width: number; height: number };
}

// ============================================
// Point and Line types
// ============================================

export interface Point {
  x: number;
  y: number;
}

export interface Line {
  start: Point;
  end: Point;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================
// Attack Bone Positions
// ============================================

export interface AttackBonePositions {
  rightHand: Point | null;
  leftHand: Point | null;
  rightFoot: Point | null;
  leftFoot: Point | null;
  weapon: Point | null;
  weaponLine: Line | null;
}

// ============================================
// Hurtbox Positions
// ============================================

export interface HurtboxPositions {
  head: Circle | null;
  body: Box | null;
}

// ============================================
// Spine Fighter View - implements SpinePlayer
// ============================================

export class SpineFighterView implements SpinePlayer {
  private instance: SpineInstance;

  constructor(instance: SpineInstance) {
    this.instance = instance;
  }

  // ============================================
  // Animation Control (implements SpinePlayer)
  // ============================================

  /**
   * Play an animation on a track
   */
  setAnimation(trackIndex: number, animationName: string, loop: boolean): SpineTrackEntry {
    const entry = this.instance.state.setAnimation(trackIndex, animationName, loop);
    return this.wrapEntry(entry);
  }

  /**
   * Queue an animation after the current one
   */
  addAnimation(trackIndex: number, animationName: string, loop: boolean, delay: number = 0): SpineTrackEntry {
    const entry = this.instance.state.addAnimation(trackIndex, animationName, loop, delay);
    return this.wrapEntry(entry);
  }

  /**
   * Clear a track with mix out
   */
  setEmptyAnimation(trackIndex: number, mixDuration: number = 0): void {
    this.instance.state.setEmptyAnimation(trackIndex, mixDuration);
  }

  /**
   * Hard clear a track (no mix, immediate)
   */
  clearTrack(trackIndex: number): void {
    this.instance.state.clearTrack(trackIndex);
  }

  /**
   * Hard clear all tracks
   */
  clearTracks(): void {
    this.instance.state.clearTracks();
  }

  /**
   * Get current animation on a track
   */
  getCurrent(trackIndex: number): SpineTrackEntry | null {
    const entry = this.instance.state.getCurrent(trackIndex);
    return entry ? this.wrapEntry(entry) : null;
  }

  /**
   * Alias for getCurrent (implements SpinePlayer)
   */
  getCurrentAnimation(trackIndex: number): SpineTrackEntry | null {
    return this.getCurrent(trackIndex);
  }

  /**
   * Set default mix duration between two animations
   */
  setMix(fromAnim: string, toAnim: string, duration: number): void {
    this.instance.state.data.setMix(fromAnim, toAnim, duration);
  }

  /**
   * Set time scale for a track
   */
  setTimeScale(trackIndex: number, scale: number): void {
    const entry = this.instance.state.getCurrent(trackIndex);
    if (entry) {
      entry.timeScale = scale;
    }
  }

  private wrapEntry(entry: spine.TrackEntry): SpineTrackEntry {
    const wrapped: SpineTrackEntry = {
      animationEnd: entry.animationEnd,
      trackTime: entry.trackTime,
      animation: { name: entry.animation?.name ?? '' },
      // Proxy holdPrevious to the native entry
      get holdPrevious(): boolean {
        return entry.holdPrevious;
      },
      set holdPrevious(value: boolean) {
        entry.holdPrevious = value;
      }
    };
    return wrapped;
  }

  // ============================================
  // Position & Transform
  // ============================================

  /**
   * Set skeleton world position
   */
  setPosition(x: number, y: number): void {
    this.instance.skeleton.x = x;
    this.instance.skeleton.y = y;
  }

  /**
   * Get skeleton world position
   */
  getPosition(): Point {
    return {
      x: this.instance.skeleton.x,
      y: this.instance.skeleton.y
    };
  }

  /**
   * Set facing direction (flips skeleton horizontally)
   */
  setFacingRight(facingRight: boolean): void {
    this.instance.skeleton.scaleX = Math.abs(this.instance.skeleton.scaleX) * (facingRight ? 1 : -1);
  }

  /**
   * Check if facing right
   */
  isFacingRight(): boolean {
    return this.instance.skeleton.scaleX > 0;
  }

  // ============================================
  // Bone World Positions
  // ============================================

  /**
   * Get a bone's tip position (end point) in world coordinates
   */
  getBoneTip(boneName: string): Point | null {
    const bone = this.instance.skeleton.findBone(boneName);
    if (!bone) return null;

    const boneLength = bone.data.length;
    const worldPos = new spine.Vector2();
    bone.localToWorld(worldPos.set(boneLength, 0));

    return { x: worldPos.x, y: worldPos.y };
  }

  /**
   * Get a bone's origin position (start point) in world coordinates
   */
  getBoneOrigin(boneName: string): Point | null {
    const bone = this.instance.skeleton.findBone(boneName);
    if (!bone) return null;

    const worldPos = new spine.Vector2();
    bone.localToWorld(worldPos.set(0, 0));

    return { x: worldPos.x, y: worldPos.y };
  }

  /**
   * Get attack bone positions (hands, feet, weapon)
   */
  getAttackBonePositions(): AttackBonePositions {
    return {
      rightHand: this.getBoneTip('arm_R2'),
      leftHand: this.getBoneTip('arm_L2'),
      rightFoot: this.getBoneTip('leg_R2'),
      leftFoot: this.getBoneTip('leg_L2'),
      weapon: this.getWeaponTip(),
      weaponLine: this.getWeaponLine()
    };
  }

  // ============================================
  // Attachment Vertex Calculations
  // ============================================

  /**
   * Get world vertices for a slot's attachment
   * Works for both RegionAttachment and MeshAttachment
   */
  getAttachmentWorldVertices(slotName: string): number[] | null {
    const slot = this.instance.skeleton.findSlot(slotName);
    if (!slot) return null;

    const att = slot.getAttachment();
    if (!att) return null;

    if (att instanceof spine.RegionAttachment) {
      const world = new Array(8);
      att.computeWorldVertices(slot, world, 0, 2);
      return world;
    }

    if (att instanceof spine.MeshAttachment) {
      const world = new Array(att.worldVerticesLength);
      att.computeWorldVertices(slot, 0, att.worldVerticesLength, world, 0, 2);
      return world;
    }

    return null;
  }

  /**
   * Get weapon tip position from attachment data
   * Uses attachment height/y for accurate positioning (no magic numbers)
   */
  getWeaponTip(): Point | null {
    const slot = this.instance.skeleton.findSlot('weapon');
    if (!slot) return null;

    const att = slot.getAttachment();
    if (!att) return null;

    const bone = slot.bone;

    // For RegionAttachment, calculate tip from attachment data
    if (att instanceof spine.RegionAttachment) {
      // In Spine, y is offset from image CENTER to bone origin
      // Tip (top of sword) is at height/2 + y from bone
      const tipLocalY = att.height / 2 + att.y;
      const tipWorld = new spine.Vector2();
      bone.localToWorld(tipWorld.set(0, tipLocalY));
      return { x: tipWorld.x, y: tipWorld.y };
    }

    // For MeshAttachment, find furthest vertex from grip
    if (att instanceof spine.MeshAttachment) {
      const verts = new Array(att.worldVerticesLength);
      att.computeWorldVertices(slot, 0, att.worldVerticesLength, verts, 0, 2);

      const gripPos = new spine.Vector2();
      bone.localToWorld(gripPos.set(0, 0));

      let tip: Point = { x: verts[0], y: verts[1] };
      let maxDist = 0;

      for (let i = 0; i < verts.length; i += 2) {
        const dx = verts[i] - gripPos.x;
        const dy = verts[i + 1] - gripPos.y;
        const dist = dx * dx + dy * dy;
        if (dist > maxDist) {
          maxDist = dist;
          tip = { x: verts[i], y: verts[i + 1] };
        }
      }
      return tip;
    }

    return null;
  }

  /**
   * Get weapon line (grip to tip) for collision detection
   */
  getWeaponLine(): Line | null {
    const slot = this.instance.skeleton.findSlot('weapon');
    if (!slot) return null;

    const att = slot.getAttachment();
    if (!att) return null;

    const bone = slot.bone;
    const gripPos = new spine.Vector2();
    bone.localToWorld(gripPos.set(0, 0));
    const start: Point = { x: gripPos.x, y: gripPos.y };

    // For RegionAttachment, calculate tip from attachment data
    if (att instanceof spine.RegionAttachment) {
      const tipLocalY = att.height / 2 + att.y;
      const tipWorld = new spine.Vector2();
      bone.localToWorld(tipWorld.set(0, tipLocalY));
      return { start, end: { x: tipWorld.x, y: tipWorld.y } };
    }

    // For MeshAttachment, find furthest vertex from grip
    if (att instanceof spine.MeshAttachment) {
      const verts = new Array(att.worldVerticesLength);
      att.computeWorldVertices(slot, 0, att.worldVerticesLength, verts, 0, 2);

      let front: Point = { x: verts[0], y: verts[1] };
      let maxDist = 0;

      for (let i = 0; i < verts.length; i += 2) {
        const dx = verts[i] - start.x;
        const dy = verts[i + 1] - start.y;
        const dist = dx * dx + dy * dy;
        if (dist > maxDist) {
          maxDist = dist;
          front = { x: verts[i], y: verts[i + 1] };
        }
      }
      return { start, end: front };
    }

    return null;
  }

  // ============================================
  // Hurtbox Positions
  // ============================================

  /**
   * Get dynamic hurtbox positions based on skeleton bones
   */
  getHurtboxPositions(): HurtboxPositions {
    const skeleton = this.instance.skeleton;

    // Head hurtbox
    const headBone = skeleton.findBone('head');
    let head: Circle | null = null;
    if (headBone) {
      const headCenter = new spine.Vector2();
      headBone.localToWorld(headCenter.set(headBone.data.length * 0.5, 0));
      head = {
        x: headCenter.x,
        y: headCenter.y,
        radius: 45
      };
    }

    // Body hurtbox - extends from feet to chest for better hit detection
    const hipBone = skeleton.findBone('hip');
    const chestBone = skeleton.findBone('chest');
    let body: Box | null = null;
    if (hipBone && chestBone) {
      const hipPos = new spine.Vector2();
      const chestTop = new spine.Vector2();

      hipBone.localToWorld(hipPos.set(0, 0));
      chestBone.localToWorld(chestTop.set(chestBone.data.length, 0));

      const centerX = (hipPos.x + chestTop.x) / 2;
      // Extend body downward to cover legs (hip to ~100px below hip)
      const bottomY = hipPos.y - 100;  // Extend 100px below hip
      const topY = chestTop.y;
      const centerY = (bottomY + topY) / 2;
      const height = Math.abs(topY - bottomY);

      body = {
        x: centerX,
        y: centerY,
        width: 70,  // Wider body hitbox
        height: Math.max(height, 150)
      };
    }

    return { head, body };
  }

  // ============================================
  // Event Listeners
  // ============================================

  /**
   * Register callback for animation complete
   */
  onAnimationComplete(callback: (entry: spine.TrackEntry) => void): void {
    this.instance.state.addListener({ complete: callback });
  }

  /**
   * Register callback for animation events
   */
  onEvent(callback: (entry: spine.TrackEntry, event: spine.Event) => void): void {
    this.instance.state.addListener({ event: callback });
  }

  // ============================================
  // Utility
  // ============================================

  /**
   * Get all available animation names
   */
  getAnimationNames(): string[] {
    return this.instance.skeleton.data.animations.map(a => a.name);
  }

  /**
   * Get the raw Spine instance (for advanced use)
   */
  getInstance(): SpineInstance {
    return this.instance;
  }
}
