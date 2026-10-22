import React, { useEffect, useRef, useState } from "react";

// --- 1. ASSET IMPORTS ---
import mapData from "../assets/mapData.json";
import playerSpriteUrl from "../assets/player.png";
import mapImageUrl from "../assets/map.png";

import forestAudio from "../assets/forest.mp3";
import beachAudio from "../assets/beach.mp3";
import leftShackAudio from "../assets/brown_noise.mp3";
import houseAudio from "../assets/house.mp3";
import cityAudio from "../assets/city.mp3";
import connectIcon from "../assets/connect.png";
import muteIcon from "../assets/mute.png";
import onIcon from "../assets/on.png";

const audioAssets = {
  "forest": forestAudio,
  "beach": beachAudio,
  "left shack": leftShackAudio,
  "house": houseAudio,
  "city": cityAudio
};

// --- 2. HARDCODED AUDIO ZONES ---
const INITIAL_AUDIO_ZONES = [
  { id: "audio_zone_1792558392578", points: [{ x: 1.988, y: 373.331 }, { x: 192.840, y: 312.845 }, { x: 342.938, y: 177.989 }, { x: 342.938, y: 0.495 }, { x: 5.964, y: 2.478 }, { x: 1.988, y: 372.340 }], name: "forest", fadeDistance: 150 },
  { id: "audio_zone_1792558427428", points: [{ x: 356.854, y: 704.025 }, { x: 537.766, y: 533.472 }, { x: 671.960, y: 446.213 }, { x: 816.093, y: 402.583 }, { x: 992.035, y: 374.819 }, { x: 993.029, y: 701.050 }, { x: 355.860, y: 701.050 }], name: "beach", fadeDistance: 75 },
  { id: "audio_zone_1792558477228", points: [{ x: 123.258, y: 603.875 }, { x: 246.517, y: 612.799 }, { x: 253.476, y: 556.279 }, { x: 285.284, y: 556.279 }, { x: 285.284, y: 508.683 }, { x: 166.001, y: 495.792 }, { x: 160.037, y: 522.565 }, { x: 116.300, y: 535.455 }, { x: 122.264, y: 600.900 }], name: "left shack", fadeDistance: 0 },
  { id: "audio_zone_1792558494660", points: [{ x: 635.181, y: 285.576 }, { x: 724.643, y: 284.584 }, { x: 729.613, y: 212.199 }, { x: 631.205, y: 216.165 }, { x: 631.205, y: 285.576 }], name: "house", fadeDistance: 0 },
  { id: "audio_zone_1792558526220", points: [{ x: 524.844, y: 0 }, { x: 529.814, y: 218.148 }, { x: 735.577, y: 208.232 }, { x: 737.565, y: 333.172 }, { x: 995.017, y: 306.399 }, { x: 994.023, y: 1.983 }, { x: 525.838, y: 0.991 }], name: "city", fadeDistance: 10 }
];

const MAP_WIDTH = 998;
const MAP_HEIGHT = 707;
const MAP_STROKE_WIDTH = 8;

const SPRITE_SHEET = { columns: 5, rows: 6, sourceWidth: 852 / 5, sourceHeight: 1117 / 6, drawWidth: 48, drawHeight: 63, directionRows: { down: 0, left: 3, right: 2, up: 1 } };

// --- 3. MATH UTILITIES ---
const isPointInRect = (point, rect) => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
const orientation = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const onSegment = (a, b, c) => Math.min(a.x, c.x) <= b.x && b.x <= Math.max(a.x, c.x) && Math.min(a.y, c.y) <= b.y && b.y <= Math.max(a.y, c.y);
const segmentsIntersect = (firstStart, firstEnd, secondStart, secondEnd) => {
  const o1 = orientation(firstStart, firstEnd, secondStart); const o2 = orientation(firstStart, firstEnd, secondEnd);
  const o3 = orientation(secondStart, secondEnd, firstStart); const o4 = orientation(secondStart, secondEnd, firstEnd);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  return (o1 === 0 && onSegment(firstStart, secondStart, firstEnd)) || (o2 === 0 && onSegment(firstStart, secondEnd, firstEnd)) || (o3 === 0 && onSegment(secondStart, firstStart, secondEnd)) || (o4 === 0 && onSegment(secondStart, firstEnd, secondEnd));
};
const expandRect = (rect, padding) => ({ x: rect.x - padding, y: rect.y - padding, w: rect.w + padding * 2, h: rect.h + padding * 2 });
const lineIntersectsRect = (start, end, rect) => {
  if (isPointInRect(start, rect) || isPointInRect(end, rect)) return true;
  const tl = { x: rect.x, y: rect.y }, tr = { x: rect.x + rect.w, y: rect.y };
  const br = { x: rect.x + rect.w, y: rect.y + rect.h }, bl = { x: rect.x, y: rect.y + rect.h };
  return segmentsIntersect(start, end, tl, tr) || segmentsIntersect(start, end, tr, br) || segmentsIntersect(start, end, br, bl) || segmentsIntersect(start, end, bl, tl);
};
const strokeIntersectsRect = (stroke, rect) => {
  if (!stroke.points || stroke.points.length === 0) return false;
  const paddedRect = expandRect(rect, MAP_STROKE_WIDTH / 2);
  return stroke.points.some((point, index) => index > 0 && lineIntersectsRect(stroke.points[index - 1], point, paddedRect));
};
const drawStroke = (ctx, stroke) => {
  if (!stroke.points || stroke.points.length < 2) return;
  ctx.beginPath(); ctx.moveTo(stroke.points[0].x, stroke.points[0].y); stroke.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y)); ctx.stroke();
};
const checkStrokeCollision = (rect, stroke) => stroke.type === "boundary" && strokeIntersectsRect(stroke, rect);

// Spatial Audio Math
const isPointInPolygon = (point, vs) => {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y; const xj = vs[j].x, yj = vs[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};
const distToSegmentSquared = (p, v, w) => {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2; t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
};
const distanceToPolygon = (point, polygon) => {
  if (isPointInPolygon(point, polygon)) return 0;
  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const nextNode = i === polygon.length - 1 ? 0 : i + 1;
    const dist = Math.sqrt(distToSegmentSquared(point, polygon[i], polygon[nextNode]));
    if (dist < minDist) minDist = dist;
  }
  return minDist;
};

// --- 4. MAIN COMPONENT ---
export default function TopDownGame() {
  const canvasRef = useRef(null);

  const [debugMode, setDebugMode] = useState(true);
  const [inForeground, setInForeground] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  // Hardware States
  const [serialConnected, setSerialConnected] = useState(false);
  const [isMutedHUD, setIsMutedHUD] = useState(false); // Just for displaying in UI
  const hardwareInput = useRef({ joyX: 2048, joyY: 2048, pot: 2048, button: 1 });
  const [hardwareDisplay, setHardwareDisplay] = useState(hardwareInput.current);
  
  // Audio Controls Refs (Using refs because they update in the 60fps loop)
  const isMutedRef = useRef(false);
  const userMutedRef = useRef(false);

  const [audioZones, setAudioZones] = useState(INITIAL_AUDIO_ZONES);

  const audioPlayersRef = useRef({});
  const zones = useRef(mapData.filter((item) => (item.type === "boundary" || item.type === "foreground") && Array.isArray(item.points) && item.points.length >= 2));

  const player = useRef({
    x: (MAP_WIDTH - SPRITE_SHEET.drawWidth) / 2, y: (MAP_HEIGHT - SPRITE_SHEET.drawHeight) / 2,
    speed: 3.5, spriteWidth: SPRITE_SHEET.drawWidth, spriteHeight: SPRITE_SHEET.drawHeight,
    hitboxOffset: { x: 19, y: 50, w: 8, h: 10 },
    direction: 0, frameIndex: 0, ticks: 0, ticksPerFrame: 2, isMoving: false, underForeground: false, activeVolumes: {} 
  });

  const keys = useRef({ w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false });
  const mapImageRef = useRef(null); const spriteSheetRef = useRef(null);

  // --- SERIAL CONNECTOR ---
  const connectSerial = async () => {
    if (!("serial" in navigator)) return alert("Web Serial is not supported in your browser.");
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 }); 
      setSerialConnected(true);

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop(); 

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            console.log("Serial data:", data);
            const nextHardwareInput = { ...hardwareInput.current, ...data };
            hardwareInput.current = nextHardwareInput;
            setHardwareDisplay(nextHardwareInput);
          } catch (e) { }
        }
      }
    } catch (err) {
      console.error("Serial connection error:", err);
      setSerialConnected(false);
    }
  };

  useEffect(() => {
    const map = new Image(); map.onload = () => { mapImageRef.current = map; }; map.src = mapImageUrl;
    const sprite = new Image(); sprite.onload = () => { spriteSheetRef.current = sprite; }; sprite.src = playerSpriteUrl;

    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === "h") setDebugMode((prev) => !prev);
      if (keys.current.hasOwnProperty(e.key) || ["w", "a", "s", "d"].includes(e.key.toLowerCase())) {
        keys.current[e.key.toLowerCase()] = true; keys.current[e.key] = true;
      }
    };
    const handleKeyUp = (e) => {
      if (keys.current.hasOwnProperty(e.key) || ["w", "a", "s", "d"].includes(e.key.toLowerCase())) {
        keys.current[e.key.toLowerCase()] = false; keys.current[e.key] = false;
      }
    };
    window.addEventListener("keydown", handleKeyDown); window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
  }, []);

  useEffect(() => {
    audioZones.forEach(zone => {
      if (!audioPlayersRef.current[zone.id]) {
        const audioSrc = audioAssets[zone.name]; 
        if (audioSrc) {
          const audio = new Audio(audioSrc);
          audio.loop = true; audio.volume = 0;
          audioPlayersRef.current[zone.id] = audio;
        }
      }
    });
  }, [audioZones]);

  // --- GAME LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const gameLoop = () => {
      const p = player.current;

      {
        let dx = 0, dy = 0;

        if (keys.current.w || keys.current.ArrowUp) dy -= 1;
        if (keys.current.s || keys.current.ArrowDown) dy += 1;
        if (keys.current.a || keys.current.ArrowLeft) dx -= 1;
        if (keys.current.d || keys.current.ArrowRight) dx += 1;
        if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

        const hw = hardwareInput.current;

        // --- BUTTON MUTE ---
        // The button mutes only while it is physically held down.
        const shouldMute = userMutedRef.current || hw.button === 0;
        if (shouldMute !== isMutedRef.current) {
          isMutedRef.current = shouldMute;
          setIsMutedHUD(shouldMute);
        }


        // --- JOYSTICK CALIBRATION ---
        // TODO: Look at the HUD when NOT touching the stick. 
        // Put the exact numbers you see into these two variables:
        const RESTING_X = 1118; 
        const RESTING_Y = 1821;
        
        // Increased the deadzone from 0.15 to 0.25 to ignore drift
        const deadzone = 0.5; 
        
        const analogX = (hw.joyX - RESTING_X) / 2048;
        const analogY = (hw.joyY - RESTING_Y) / 2048;

        if (Math.abs(analogX) > deadzone) dx += analogX;
        if (Math.abs(analogY) > deadzone) dy += analogY;

        const magnitude = Math.sqrt(dx * dx + dy * dy);
        if (magnitude > 1) { dx /= magnitude; dy /= magnitude; }

        p.isMoving = magnitude > deadzone || (keys.current.w || keys.current.s || keys.current.a || keys.current.d);

        if (p.isMoving) {
          if (Math.abs(dx) > Math.abs(dy)) {
            p.direction = dx > 0 ? 2 : 1; 
          } else {
            p.direction = dy > 0 ? 0 : 3; 
          }
        }

        const moveX = dx * p.speed;
        const moveY = dy * p.speed;

        const getHitbox = (posX, posY) => ({ x: posX + p.hitboxOffset.x, y: posY + p.hitboxOffset.y, w: p.hitboxOffset.w, h: p.hitboxOffset.h });
        const boundaries = zones.current.filter((z) => z.type === "boundary");
        
        if (moveX !== 0) {
          const nextX = p.x + moveX;
          if (!boundaries.some((wall) => checkStrokeCollision(getHitbox(nextX, p.y), wall))) p.x = nextX;
        }
        if (moveY !== 0) {
          const nextY = p.y + moveY;
          if (!boundaries.some((wall) => checkStrokeCollision(getHitbox(p.x, nextY), wall))) p.y = nextY;
        }

        const isInsideForeground = zones.current.filter((z) => z.type === "foreground").some((fg) => strokeIntersectsRect(fg, getHitbox(p.x, p.y)));
        p.underForeground = isInsideForeground; setInForeground(isInsideForeground);

        if (p.isMoving) {
          const adjustedTicksPerFrame = Math.max(2, Math.floor(4 / Math.max(0.2, magnitude)));
          p.ticks++; 
          if (p.ticks > adjustedTicksPerFrame) { 
            p.ticks = 0; p.frameIndex = (p.frameIndex + 1) % SPRITE_SHEET.columns; 
          }
        } else p.frameIndex = 0;

        // --- AUDIO ENGINE ---
        const playerCenter = { x: p.x + p.spriteWidth / 2, y: p.y + p.spriteHeight / 2 };
        const currentVolumes = {};

        if (audioEnabled) {
          // Calculate Potentiometer percentage (0.0 to 1.0)
          const potVolume = hw.pot / 4095;

          audioZones.forEach(zone => {
            const audio = audioPlayersRef.current[zone.id];
            const dist = distanceToPolygon(playerCenter, zone.points);
            
            let targetVolume = 0;
            if (dist === 0) targetVolume = 1.0; 
            else if (dist < zone.fadeDistance) targetVolume = 1.0 - (dist / zone.fadeDistance);

            currentVolumes[zone.name] = targetVolume;
            
            if (audio) {
              // Apply Potentiometer and Mute logic
              if (isMutedRef.current) {
                audio.volume = 0;
              } else {
                audio.volume = Math.max(0, Math.min(1, targetVolume * potVolume));
              }

              if (targetVolume > 0 && audio.paused) audio.play().catch(() => {});
              else if (targetVolume === 0 && !audio.paused) audio.pause();
            }
          });
          p.activeVolumes = currentVolumes;
        }
      }

      // --- RENDERING ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mapImage = mapImageRef.current;
      if (mapImage && mapImage.complete && mapImage.naturalWidth !== 0) {
        ctx.drawImage(mapImage, 0, 0, MAP_WIDTH, MAP_HEIGHT);
      } else {
        ctx.fillStyle = "#e0d9b4"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.save();
      if (p.underForeground) ctx.globalAlpha = 0.45;
      const img = spriteSheetRef.current;
      if (img && img.complete && img.naturalWidth !== 0) {
        const dirRows = [SPRITE_SHEET.directionRows.down, SPRITE_SHEET.directionRows.left, SPRITE_SHEET.directionRows.right, SPRITE_SHEET.directionRows.up];
        ctx.drawImage(img, p.frameIndex * SPRITE_SHEET.sourceWidth, dirRows[p.direction] * SPRITE_SHEET.sourceHeight, SPRITE_SHEET.sourceWidth, SPRITE_SHEET.sourceHeight, p.x, p.y, p.spriteWidth, p.spriteHeight);
      } else {
        ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.arc(p.x + p.spriteWidth / 2, p.y + p.spriteHeight / 2, 16, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [debugMode, audioZones, audioEnabled]);

  const handleCanvasClick = () => {
    if (!audioEnabled) setAudioEnabled(true);
  };

  const handleMuteToggle = () => {
    setAudioEnabled(true);
    userMutedRef.current = !userMutedRef.current;
    const physicallyMuted = hardwareInput.current.button === 0;
    setIsMutedHUD(userMutedRef.current || physicallyMuted);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "sans-serif", position: "relative" }}>
      {serialConnected && debugMode && (
         <div style={{ width: "100%", maxWidth: "998px", marginBottom: "8px", fontSize: "13px", display: "flex", gap: "16px", padding: "8px", background: isMutedHUD ? "#fecdd3" : "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
           <strong>Live Controller Data:</strong>
           <span>JoyX: {hardwareDisplay.joyX}</span>
           <span>JoyY: {hardwareDisplay.joyY}</span>
           <span>Pot (Volume): {Math.round((hardwareDisplay.pot / 4095) * 100)}%</span>
           <span>Btn: {hardwareDisplay.button === 0 ? "PRESSED" : "UP"}</span>
           <span style={{ color: isMutedHUD ? "red" : "black", fontWeight: "bold" }}>
             {isMutedHUD ? "🔇 MUTED" : "🔊 UNMUTED"}
           </span>
         </div>
      )}

      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        onClick={handleCanvasClick}
        style={{
          border: "2px solid #333",
          borderRadius: "8px", backgroundColor: "#fff", maxWidth: "100%", height: "auto",
          cursor: "default"
        }}
      />
      <div style={{ position: "absolute", right: "16px", bottom: "16px", display: "flex", gap: "12px", zIndex: 2 }}>
        <button
          type="button"
          onClick={() => {
            setAudioEnabled(true);
            connectSerial();
          }}
          disabled={serialConnected}
          aria-label={serialConnected ? "Serial controller connected" : "Connect serial controller"}
          title={serialConnected ? "Serial controller connected" : "Connect serial controller"}
          style={{ width: "56px", height: "56px", borderRadius: "50%", border: "2px solid white", padding: "10px", background: serialConnected ? "#10b981" : "#3b82f6", cursor: serialConnected ? "default" : "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
        >
          <img src={connectIcon} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </button>
        <button
          type="button"
          onClick={handleMuteToggle}
          aria-label={isMutedHUD ? "Turn sound on" : "Mute sound"}
          title={isMutedHUD ? "Turn sound on" : "Mute sound"}
          style={{ width: "56px", height: "56px", borderRadius: "50%", border: "2px solid white", padding: "10px", background: isMutedHUD ? "#ef4444" : "#10b981", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
        >
          <img src={isMutedHUD ? onIcon : muteIcon} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </button>
      </div>
    </div>
  );
}