// ============================================
// Hitbox Provider - Data-Driven Hitbox Resolution
// ============================================
// Uses AttackConfig to determine which hitbox shape to use
// for the current attack, without parsing animation names.
// ============================================

import { Point, Line, Circle, Box, AttackBonePositions, HurtboxPositions } from './spine-fighter-view';
import { AttackId, getAttackConfig, HitboxSource } from './attack-data';
import { Loadout } from './types';

// ============================================
// Hitbox Types
// ============================================

export interface PointHitbox {
  type: 'point';
  position: Point;
  radius: number;
}

export interface LineHitbox {
  type: 'line';
  line: Line;
  thickness: number;
}

export type AttackHitbox = PointHitbox | LineHitbox;

// ============================================
// Hitbox Provider
// ============================================

export class HitboxProvider {
  
  /**
   * Get the active attack hitbox based on attack config and bone positions
   */
  static getAttackHitbox(
    attackId: AttackId | null,
    bonePositions: AttackBonePositions,
    loadout: Loadout
  ): AttackHitbox | null {
    if (!attackId) return null;
    
    const config = getAttackConfig(attackId);
    if (!config) return null;
    
    // Get position from configured bone
    const position = this.getPositionForSource(config.hitboxSource, bonePositions, loadout);
    if (!position) return null;
    
    // Check if this attack uses line hitbox (weapon)
    if (config.usesLineHitbox && config.hitboxSource === 'weapon') {
      const weaponLine = bonePositions.weaponLine;
      if (weaponLine) {
        return {
          type: 'line',
          line: weaponLine,
          thickness: config.hitboxRadius
        };
      }
      // Fallback to point if no weapon line available
    }
    
    // Point hitbox (hand, foot, or weapon tip)
    return {
      type: 'point',
      position,
      radius: config.hitboxRadius
    };
  }
  
  /**
   * Get position from the configured hitbox source
   */
  private static getPositionForSource(
    source: HitboxSource,
    bones: AttackBonePositions,
    loadout: Loadout
  ): Point | null {
    switch (source) {
      case 'rightHand':
        return bones.rightHand;
      case 'leftHand':
        return bones.leftHand;
      case 'rightFoot':
        return bones.rightFoot;
      case 'leftFoot':
        return bones.leftFoot;
      case 'weapon':
        // Only use weapon if loadout supports it
        if (loadout === 'sword' && bones.weapon) {
          return bones.weapon;
        }
        // Fallback to hand for non-sword loadouts
        return bones.rightHand;
      default:
        return bones.rightHand;
    }
  }
  
  // ============================================
  // Collision Detection Helpers
  // ============================================
  
  /**
   * Check if attack hitbox collides with a circle (head)
   */
  static hitboxCollidesWithCircle(hitbox: AttackHitbox, circle: Circle): boolean {
    if (hitbox.type === 'point') {
      return this.circleCircleCollision(
        hitbox.position.x, hitbox.position.y, hitbox.radius,
        circle.x, circle.y, circle.radius
      );
    } else {
      return this.lineCircleCollision(hitbox.line, hitbox.thickness, circle);
    }
  }
  
  /**
   * Check if attack hitbox collides with a box (body)
   */
  static hitboxCollidesWithBox(hitbox: AttackHitbox, box: Box): boolean {
    if (hitbox.type === 'point') {
      return this.circleBoxCollision(
        hitbox.position.x, hitbox.position.y, hitbox.radius,
        box
      );
    } else {
      return this.lineBoxCollision(hitbox.line, hitbox.thickness, box);
    }
  }
  
  /**
   * Check collision against all hurtboxes, return which was hit
   */
  static checkHurtboxCollision(
    hitbox: AttackHitbox,
    hurtboxes: HurtboxPositions
  ): 'head' | 'body' | null {
    // Check head first (smaller, harder to hit, usually more damage)
    if (hurtboxes.head && this.hitboxCollidesWithCircle(hitbox, hurtboxes.head)) {
      return 'head';
    }
    
    // Check body
    if (hurtboxes.body && this.hitboxCollidesWithBox(hitbox, hurtboxes.body)) {
      return 'body';
    }
    
    return null;
  }
  
  // ============================================
  // Primitive Collision Functions
  // ============================================
  
  private static circleCircleCollision(
    x1: number, y1: number, r1: number,
    x2: number, y2: number, r2: number
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distSq = dx * dx + dy * dy;
    const radiusSum = r1 + r2;
    return distSq <= radiusSum * radiusSum;
  }
  
  private static circleBoxCollision(
    cx: number, cy: number, radius: number,
    box: Box
  ): boolean {
    // Find closest point on box to circle center
    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const closestX = Math.max(box.x - halfW, Math.min(cx, box.x + halfW));
    const closestY = Math.max(box.y - halfH, Math.min(cy, box.y + halfH));
    
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= radius * radius;
  }
  
  private static lineCircleCollision(line: Line, thickness: number, circle: Circle): boolean {
    // Check if circle collides with thick line (capsule collision)
    const combinedRadius = thickness / 2 + circle.radius;
    
    // Vector from start to end
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq === 0) {
      // Line is a point
      return this.circleCircleCollision(
        line.start.x, line.start.y, thickness / 2,
        circle.x, circle.y, circle.radius
      );
    }
    
    // Project circle center onto line, clamped to segment
    const t = Math.max(0, Math.min(1, 
      ((circle.x - line.start.x) * dx + (circle.y - line.start.y) * dy) / lenSq
    ));
    
    const closestX = line.start.x + t * dx;
    const closestY = line.start.y + t * dy;
    
    const distX = circle.x - closestX;
    const distY = circle.y - closestY;
    
    return (distX * distX + distY * distY) <= combinedRadius * combinedRadius;
  }
  
  private static lineBoxCollision(line: Line, thickness: number, box: Box): boolean {
    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const left = box.x - halfW;
    const right = box.x + halfW;
    const top = box.y + halfH;
    const bottom = box.y - halfH;
    
    // Expand box by line thickness/2 for thick line collision
    const expand = thickness / 2;
    const expandedLeft = left - expand;
    const expandedRight = right + expand;
    const expandedTop = top + expand;
    const expandedBottom = bottom - expand;
    
    // Check if either endpoint is inside expanded box
    if (this.pointInBox(line.start.x, line.start.y, expandedLeft, expandedRight, expandedTop, expandedBottom) ||
        this.pointInBox(line.end.x, line.end.y, expandedLeft, expandedRight, expandedTop, expandedBottom)) {
      return true;
    }
    
    // Check line intersection with EXPANDED box edges
    const edges: [Point, Point][] = [
      [{ x: expandedLeft, y: expandedBottom }, { x: expandedRight, y: expandedBottom }],  // Bottom
      [{ x: expandedRight, y: expandedBottom }, { x: expandedRight, y: expandedTop }],     // Right
      [{ x: expandedRight, y: expandedTop }, { x: expandedLeft, y: expandedTop }],         // Top
      [{ x: expandedLeft, y: expandedTop }, { x: expandedLeft, y: expandedBottom }]        // Left
    ];
    
    for (const [p1, p2] of edges) {
      if (this.linesIntersect(line.start, line.end, p1, p2)) {
        return true;
      }
    }
    
    // Also check if closest point on line is inside expanded box
    const closestPoint = this.closestPointOnLineSegment(line, { x: box.x, y: box.y });
    if (this.pointInBox(closestPoint.x, closestPoint.y, expandedLeft, expandedRight, expandedTop, expandedBottom)) {
      return true;
    }
    
    return false;
  }

  /**
   * Find the closest point on a line segment to a target point
   */
  private static closestPointOnLineSegment(line: Line, target: Point): Point {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq === 0) {
      return { x: line.start.x, y: line.start.y };
    }
    
    const t = Math.max(0, Math.min(1, 
      ((target.x - line.start.x) * dx + (target.y - line.start.y) * dy) / lenSq
    ));
    
    return {
      x: line.start.x + t * dx,
      y: line.start.y + t * dy
    };
  }
  
  private static pointInBox(
    x: number, y: number,
    left: number, right: number, top: number, bottom: number
  ): boolean {
    return x >= left && x <= right && y >= bottom && y <= top;
  }
  
  private static linesIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
    const d1 = this.direction(p3, p4, p1);
    const d2 = this.direction(p3, p4, p2);
    const d3 = this.direction(p1, p2, p3);
    const d4 = this.direction(p1, p2, p4);
    
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    
    if (d1 === 0 && this.onSegment(p3, p4, p1)) return true;
    if (d2 === 0 && this.onSegment(p3, p4, p2)) return true;
    if (d3 === 0 && this.onSegment(p1, p2, p3)) return true;
    if (d4 === 0 && this.onSegment(p1, p2, p4)) return true;
    
    return false;
  }
  
  private static direction(p1: Point, p2: Point, p3: Point): number {
    return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
  }
  
  private static onSegment(p1: Point, p2: Point, p: Point): boolean {
    return p.x >= Math.min(p1.x, p2.x) && p.x <= Math.max(p1.x, p2.x) &&
           p.y >= Math.min(p1.y, p2.y) && p.y <= Math.max(p1.y, p2.y);
  }
}
