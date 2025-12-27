// ============================================================================
// COLLISION DETECTION SYSTEM
// ============================================================================
// Geometric primitives and collision detection functions
// Used by bone-combat system for hitbox/hurtbox testing
// ============================================================================

// ============================================================================
// COLLISION PRIMITIVES
// ============================================================================

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface Box {
  x: number; // center x
  y: number; // center y
  width: number;
  height: number;
}

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}

// ============================================================================
// COLLISION DETECTION FUNCTIONS
// ============================================================================

/**
 * Circle-Circle collision
 */
export function circleCircleCollision(c1: Circle, c2: Circle): boolean {
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = c1.radius + c2.radius;
  return distSq <= radiusSum * radiusSum;
}

/**
 * Circle-Box collision (for attack-hitbox vs body-hurtbox)
 */
export function circleBoxCollision(circle: Circle, box: Box): boolean {
  // Find the closest point on the box to the circle's center
  const closestX = Math.max(box.x - box.width / 2, Math.min(circle.x, box.x + box.width / 2));
  const closestY = Math.max(box.y - box.height / 2, Math.min(circle.y, box.y + box.height / 2));

  // Calculate the distance between the circle's center and this closest point
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distanceSq = (dx * dx) + (dy * dy);

  // If the distance is less than the circle's radius, they collide
  return distanceSq < (circle.radius * circle.radius);
}

/**
 * Line-Circle collision (for weapon hitboxes)
 */
export function lineCircleCollision(line: Line, circle: Circle): boolean {
  // Vector from line start to end
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lenSq = dx * dx + dy * dy;
  
  if (lenSq === 0) {
    // Degenerate line (point)
    const distSq = (line.x1 - circle.x) ** 2 + (line.y1 - circle.y) ** 2;
    return distSq <= (line.thickness + circle.radius) ** 2;
  }
  
  // Vector from line start to circle center
  const px = circle.x - line.x1;
  const py = circle.y - line.y1;
  
  // Project circle onto line (clamped to segment)
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  
  // Closest point on line segment
  const closestX = line.x1 + t * dx;
  const closestY = line.y1 + t * dy;
  
  // Distance from closest point to circle center
  const distSq = (closestX - circle.x) ** 2 + (closestY - circle.y) ** 2;
  const radiusSum = line.thickness + circle.radius;
  
  return distSq <= radiusSum * radiusSum;
}

/**
 * Line-Box collision (for weapon hitbox vs body hurtbox)
 * Capsule (line + thickness) vs AABB
 */
export function lineBoxCollision(line: Line, box: Box): boolean {
  // Treat line as capsule (line segment + thickness radius)
  // Check if capsule intersects with box
  
  // 1. Check if either endpoint is inside the expanded box
  const expandedBox = {
    minX: box.x - box.width / 2 - line.thickness,
    maxX: box.x + box.width / 2 + line.thickness,
    minY: box.y - box.height / 2 - line.thickness,
    maxY: box.y + box.height / 2 + line.thickness,
  };
  
  if (
    (line.x1 >= expandedBox.minX && line.x1 <= expandedBox.maxX &&
     line.y1 >= expandedBox.minY && line.y1 <= expandedBox.maxY) ||
    (line.x2 >= expandedBox.minX && line.x2 <= expandedBox.maxX &&
     line.y2 >= expandedBox.minY && line.y2 <= expandedBox.maxY)
  ) {
    return true;
  }
  
  // 2. Check if line segment intersects box (with thickness)
  // Find closest point on line to box center
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lenSq = dx * dx + dy * dy;
  
  if (lenSq === 0) {
    // Degenerate line - treat as circle
    return circleBoxCollision(
      { x: line.x1, y: line.y1, radius: line.thickness },
      box
    );
  }
  
  // Project box center onto line
  const px = box.x - line.x1;
  const py = box.y - line.y1;
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  
  // Closest point on line to box center
  const closestX = line.x1 + t * dx;
  const closestY = line.y1 + t * dy;
  
  // Check if this point (with thickness) intersects box
  return circleBoxCollision(
    { x: closestX, y: closestY, radius: line.thickness },
    box
  );
}