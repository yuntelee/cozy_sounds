import React, { useEffect, useRef, useState } from "react";

import mapData from "../assets/mapData.json";
import playerSpriteUrl from "../assets/player.png";

import mapImageUrl from "../assets/map.png";

const MAP_WIDTH = 998;
const MAP_HEIGHT = 707;
const MAP_STROKE_WIDTH = 8;

// player.png is arranged as 5 columns by 6 rows. The first four rows are
// front, back, right, and left-facing walking animations.
const SPRITE_SHEET = {
  columns: 5,
  rows: 6,
  sourceWidth: 852 / 5,
  sourceHeight: 1117 / 6,
  drawWidth: 48,
  drawHeight: 63,
  directionRows: {
    down: 0,
    left: 3,
    right: 2,
    up: 1,
  },
};

const isPointInRect = (point, rect) => (
  point.x >= rect.x &&
  point.x <= rect.x + rect.w &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.h
);

const orientation = (a, b, c) => (
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
);

const onSegment = (a, b, c) => (
  Math.min(a.x, c.x) <= b.x &&
  b.x <= Math.max(a.x, c.x) &&
  Math.min(a.y, c.y) <= b.y &&
  b.y <= Math.max(a.y, c.y)
);

const segmentsIntersect = (firstStart, firstEnd, secondStart, secondEnd) => {
  const firstOrientation = orientation(firstStart, firstEnd, secondStart);
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);

  if (
    ((firstOrientation > 0 && secondOrientation < 0) ||
      (firstOrientation < 0 && secondOrientation > 0)) &&
    ((thirdOrientation > 0 && fourthOrientation < 0) ||
      (thirdOrientation < 0 && fourthOrientation > 0))
  ) {
    return true;
  }

  return (
    (firstOrientation === 0 && onSegment(firstStart, secondStart, firstEnd)) ||
    (secondOrientation === 0 && onSegment(firstStart, secondEnd, firstEnd)) ||
    (thirdOrientation === 0 && onSegment(secondStart, firstStart, secondEnd)) ||
    (fourthOrientation === 0 && onSegment(secondStart, firstEnd, secondEnd))
  );
};

const expandRect = (rect, padding) => ({
  x: rect.x - padding,
  y: rect.y - padding,
  w: rect.w + padding * 2,
  h: rect.h + padding * 2,
});

const lineIntersectsRect = (start, end, rect) => {
  if (isPointInRect(start, rect) || isPointInRect(end, rect)) {
    return true;
  }

  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.w, y: rect.y };
  const bottomRight = { x: rect.x + rect.w, y: rect.y + rect.h };
  const bottomLeft = { x: rect.x, y: rect.y + rect.h };

  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
};

const strokeIntersectsRect = (stroke, rect) => {
  if (!stroke.points || stroke.points.length === 0) {
    return false;
  }

  const paddedRect = expandRect(rect, MAP_STROKE_WIDTH / 2);
  return stroke.points.some((point, index) => (
    index > 0 && lineIntersectsRect(stroke.points[index - 1], point, paddedRect)
  ));
};

const drawStroke = (ctx, stroke) => {
  if (!stroke.points || stroke.points.length < 2) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  stroke.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.stroke();
};

// --- 2. LINE-BASED COLLISION DETECTION ---
const checkStrokeCollision = (rect, stroke) => {
  return (
    stroke.type === "boundary" &&
    strokeIntersectsRect(stroke, rect)
  );
};

export default function TopDownGame() {
  const canvasRef = useRef(null);

  // Debug HUD overlay state
  const [debugMode, setDebugMode] = useState(true);
  const [inForeground, setInForeground] = useState(false);

  // Normalize map data once
  const zones = useRef(
    mapData.filter((item) => (
      (item.type === "boundary" || item.type === "foreground") &&
      Array.isArray(item.points) &&
      item.points.length >= 2
    ))
  );

  // Player state container (ref-based to avoid frame-lag in RAF loop)
  const player = useRef({
    x: (MAP_WIDTH - SPRITE_SHEET.drawWidth) / 2,
    y: (MAP_HEIGHT - SPRITE_SHEET.drawHeight) / 2,
    speed: 3,
    // Destination size of one sprite frame on the game canvas.
    spriteWidth: SPRITE_SHEET.drawWidth,
    spriteHeight: SPRITE_SHEET.drawHeight,
    // Collision box offset (feet/base of character)
    hitboxOffset: { x: 19, y: 15, w: 8, h: 20
     },
    // Animation & Directions: 0: Down, 1: Left, 2: Right, 3: Up
    direction: 0,
    frameIndex: 0,
    ticks: 0,
    ticksPerFrame: 2,
    isMoving: false,
    underForeground: false,
  });

  // Track active keys
  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false,
  });

  const mapImageRef = useRef(null);
  const spriteSheetRef = useRef(null);

  useEffect(() => {
    const map = new Image();
    map.onload = () => {
      mapImageRef.current = map;
    };
    map.onerror = () => {
      console.error(`Unable to load map image: ${mapImageUrl}`);
    };
    map.src = mapImageUrl;

    const sprite = new Image();
    sprite.onload = () => {
      spriteSheetRef.current = sprite;
    };
    sprite.onerror = () => {
      console.error(`Unable to load player sprite sheet: ${playerSpriteUrl}`);
    };
    sprite.src = playerSpriteUrl;

    // Keyboard handlers
    const handleKeyDown = (e) => {
      if (e.key === "h" || e.key === "H") {
        setDebugMode((prev) => !prev);
      }
      if (keys.current.hasOwnProperty(e.key) || ["w", "a", "s", "d"].includes(e.key.toLowerCase())) {
        keys.current[e.key.toLowerCase()] = true;
        keys.current[e.key] = true;
      }
    };

    const handleKeyUp = (e) => {
      if (keys.current.hasOwnProperty(e.key) || ["w", "a", "s", "d"].includes(e.key.toLowerCase())) {
        keys.current[e.key.toLowerCase()] = false;
        keys.current[e.key] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // --- 3. MAIN GAME LOOP (requestAnimationFrame) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const gameLoop = () => {
      const p = player.current;

      // 1. Calculate input vector
      let dx = 0;
      let dy = 0;

      if (keys.current.w || keys.current.ArrowUp) {
        dy -= 1;
        p.direction = 3;
      }
      if (keys.current.s || keys.current.ArrowDown) {
        dy += 1;
        p.direction = 0;
      }
      if (keys.current.a || keys.current.ArrowLeft) {
        dx -= 1;
        p.direction = 1;
      }
      if (keys.current.d || keys.current.ArrowRight) {
        dx += 1;
        p.direction = 2;
      }

      // Diagonal speed normalization
      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      p.isMoving = dx !== 0 || dy !== 0;

      // Current hitbox helper
      const getHitbox = (posX, posY) => ({
        x: posX + p.hitboxOffset.x,
        y: posY + p.hitboxOffset.y,
        w: p.hitboxOffset.w,
        h: p.hitboxOffset.h,
      });

      // 2. Separate X and Y movement for smooth wall sliding
      const boundaries = zones.current.filter((z) => z.type === "boundary");

      // Attempt X movement
      if (dx !== 0) {
        const nextX = p.x + dx * p.speed;
        const candidateHitboxX = getHitbox(nextX, p.y);
        const collidesX = boundaries.some((wall) => checkStrokeCollision(candidateHitboxX, wall));
        if (!collidesX) {
          p.x = nextX;
        }
      }

      // Attempt Y movement
      if (dy !== 0) {
        const nextY = p.y + dy * p.speed;
        const candidateHitboxY = getHitbox(p.x, nextY);
        const collidesY = boundaries.some((wall) => checkStrokeCollision(candidateHitboxY, wall));
        if (!collidesY) {
          p.y = nextY;
        }
      }

      // 3. Check Foreground Zones (Layering / Under Roof detection)
      const foregrounds = zones.current.filter((z) => z.type === "foreground");
      const currentHitbox = getHitbox(p.x, p.y);
      const isInsideForeground = foregrounds.some((fg) => strokeIntersectsRect(fg, currentHitbox));
      p.underForeground = isInsideForeground;
      setInForeground(isInsideForeground);

      // 4. Update Sprite Animation
      if (p.isMoving) {
        p.ticks++;
        if (p.ticks > p.ticksPerFrame) {
          p.ticks = 0;
          p.frameIndex = (p.frameIndex + 1) % SPRITE_SHEET.columns;
        }
      } else {
        p.frameIndex = 0; // Idle frame
      }

      // --- 4. RENDER PASS ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Ground/map layer
      const mapImage = mapImageRef.current;
      if (mapImage && mapImage.complete && mapImage.naturalWidth !== 0) {
        ctx.drawImage(mapImage, 0, 0, MAP_WIDTH, MAP_HEIGHT);
      } else {
        ctx.fillStyle = "#e0d9b4";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Render Player (Handles Z-index / Opacity under foreground elements)
      ctx.save();
      if (p.underForeground) {
        // Option A: Partial transparency when occluded
        ctx.globalAlpha = 0.45;
      }

      const img = spriteSheetRef.current;
      if (img && img.complete && img.naturalWidth !== 0) {
        const directionRows = [
          SPRITE_SHEET.directionRows.down,
          SPRITE_SHEET.directionRows.left,
          SPRITE_SHEET.directionRows.right,
          SPRITE_SHEET.directionRows.up,
        ];

        // Select one cell by column (animation frame) and row (direction).
        ctx.drawImage(
          img,
          p.frameIndex * SPRITE_SHEET.sourceWidth,
          directionRows[p.direction] * SPRITE_SHEET.sourceHeight,
          SPRITE_SHEET.sourceWidth,
          SPRITE_SHEET.sourceHeight,
          p.x,
          p.y,
          p.spriteWidth,
          p.spriteHeight
        );
      } else {
        // Fallback visual avatar if no sprite image is loaded
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(p.x + p.spriteWidth / 2, p.y + p.spriteHeight / 2, 16, 0, Math.PI * 2);
        ctx.fill();

        // Direction indicator
        ctx.fillStyle = "#1e3a8a";
        const centerX = p.x + p.spriteWidth / 2;
        const centerY = p.y + p.spriteHeight / 2;
        const dirOffsets = [
          [0, 10],  // Down
          [-10, 0], // Left
          [10, 0],  // Right
          [0, -10], // Up
        ];
        const [ox, oy] = dirOffsets[p.direction];
        ctx.beginPath();
        ctx.arc(centerX + ox, centerY + oy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 5. Render Debug Overlay (Toggled with 'H')
      if (debugMode) {
        ctx.lineWidth = MAP_STROKE_WIDTH;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.strokeStyle = "#ef4444";
        zones.current
          .filter((z) => z.type === "boundary")
          .forEach((wall) => drawStroke(ctx, wall));

        ctx.strokeStyle = "#22c55e";
        zones.current
          .filter((z) => z.type === "foreground")
          .forEach((fg) => drawStroke(ctx, fg));

        // Draw Player Hitbox (Cyan)
        const activeHitbox = getHitbox(p.x, p.y);
        ctx.strokeStyle = "#06b6d4";
        ctx.strokeRect(activeHitbox.x, activeHitbox.y, activeHitbox.w, activeHitbox.h);
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [debugMode]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "8px", fontSize: "14px", color: "#444" }}>
        Move with <b>WASD / Arrow Keys</b> | Press <b>H</b> to toggle Hitbox Debugging (
        <span style={{ color: debugMode ? "green" : "gray" }}>{debugMode ? "ON" : "OFF"}</span>) | In Foreground:{" "}
        <b>{inForeground ? "YES (Faded/Behind)" : "NO"}</b>
      </div>
      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        style={{
          border: "2px solid #333",
          borderRadius: "8px",
          backgroundColor: "#fff",
          maxWidth: "100%",
          height: "auto",
        }}
      />
    </div>
  );
}