import type { PixelCharacter, PixelOfficeState } from "./types";
import { loadSprite, ROLE_CHAR_SPRITE } from "./sprites";

export const SCALE = 2;            // display scale
export const TILE = 16;            // native tile size
export const DTILE = TILE * SCALE; // 32px displayed per tile

export const MAP_W = 640;
export const MAP_H = 640;
const ROOM_W = MAP_W / 2; // 320
const ROOM_H = MAP_H / 2; // 320

// Character sprite sheet: 7 frames × 3 rows (down, up, right), 16×32 per frame
const CHAR_FRAME_W = 16;
const CHAR_FRAME_H = 32;
const CHAR_FRAMES = 7;

// Seat positions (absolute display pixels)
export const SEATS: Array<{ x: number; y: number; room: number }> = [
  // Room 1 — Mage Tower (up to 4 agents)
  { x: 64,  y: 96,  room: 1 },
  { x: 224, y: 96,  room: 1 },
  { x: 64,  y: 224, room: 1 },
  { x: 224, y: 224, room: 1 },
  // Room 2 — Enchanted Garden (up to 3)
  { x: 384, y: 150, room: 2 },
  { x: 512, y: 200, room: 2 },
  { x: 440, y: 260, room: 2 },
  // Room 3 — Dungeon Forge (up to 2)
  { x: 128, y: 420, room: 3 },
  { x: 220, y: 480, room: 3 },
  // Room 4 — Alchemist Lab (up to 2)
  { x: 400, y: 450, room: 4 },
  { x: 520, y: 520, room: 4 },
];

// ─── Fantasy environment helpers ───

function drawCrystal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  color: string,
  tick: number,
): void {
  const glow = 0.5 + 0.2 * Math.sin(tick * 0.04 + x);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + h, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main crystal shard (tall diamond)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + 7, y);
  ctx.lineTo(x, y + h * 0.3);
  ctx.lineTo(x - 7, y);
  ctx.closePath();
  ctx.fill();
  // Smaller side shards
  ctx.fillStyle = color + '99';
  ctx.beginPath();
  ctx.moveTo(x + 8, y - h * 0.6);
  ctx.lineTo(x + 14, y + 2);
  ctx.lineTo(x + 8, y + h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 8, y - h * 0.5);
  ctx.lineTo(x - 13, y + 2);
  ctx.lineTo(x - 8, y + h * 0.2);
  ctx.closePath();
  ctx.fill();
  // Inner highlight
  ctx.fillStyle = `rgba(255,255,255,${glow * 0.4})`;
  ctx.beginPath();
  ctx.moveTo(x - 2, y - h * 0.9);
  ctx.lineTo(x + 2, y - h * 0.5);
  ctx.lineTo(x - 2, y - h * 0.3);
  ctx.closePath();
  ctx.fill();
  // Glow halo
  const grad = ctx.createRadialGradient(x, y - h * 0.3, 2, x, y - h * 0.3, 24);
  grad.addColorStop(0, color + '55');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.3, 24, 24, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMushroom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  tick: number,
): void {
  const glow = 0.6 + 0.2 * Math.sin(tick * 0.05 + y);
  // Stem
  ctx.fillStyle = '#d4c4a8';
  ctx.beginPath();
  ctx.roundRect(x - 4 * scale, y, 8 * scale, 14 * scale, 2);
  ctx.fill();
  // Glow under cap
  const capGlow = ctx.createRadialGradient(x, y, 0, x, y, 20 * scale);
  capGlow.addColorStop(0, `rgba(180,255,120,${glow * 0.4})`);
  capGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = capGlow;
  ctx.beginPath();
  ctx.ellipse(x, y, 22 * scale, 14 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cap
  ctx.fillStyle = '#7c3f8c';
  ctx.beginPath();
  ctx.arc(x, y, 14 * scale, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Spots
  ctx.fillStyle = `rgba(255,255,255,${glow * 0.8})`;
  ctx.beginPath();
  ctx.arc(x - 4 * scale, y - 4 * scale, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 5 * scale, y - 6 * scale, 1.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 9 * scale, 1.5 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawTorch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
): void {
  // Mount bracket
  ctx.fillStyle = '#5a3e1b';
  ctx.fillRect(x - 4, y, 8, 14);
  ctx.fillStyle = '#7a5a2b';
  ctx.fillRect(x - 3, y - 2, 6, 4);
  // Animated flame
  const flicker = Math.sin(tick * 0.2 + x) * 3;
  const flicker2 = Math.cos(tick * 0.15 + x) * 2;
  // Outer flame (orange)
  ctx.fillStyle = 'rgba(255,140,0,0.85)';
  ctx.beginPath();
  ctx.moveTo(x, y - 20 + flicker2);
  ctx.bezierCurveTo(x + 7 + flicker, y - 8, x + 5, y - 2, x, y - 1);
  ctx.bezierCurveTo(x - 5, y - 2, x - 7 + flicker, y - 8, x, y - 20 + flicker2);
  ctx.fill();
  // Inner flame (yellow)
  ctx.fillStyle = 'rgba(255,220,0,0.9)';
  ctx.beginPath();
  ctx.moveTo(x, y - 15 + flicker2 * 0.5);
  ctx.bezierCurveTo(x + 4, y - 7, x + 3, y - 2, x, y - 2);
  ctx.bezierCurveTo(x - 3, y - 2, x - 4, y - 7, x, y - 15 + flicker2 * 0.5);
  ctx.fill();
  // White core
  ctx.fillStyle = 'rgba(255,255,200,0.7)';
  ctx.beginPath();
  ctx.arc(x, y - 8, 3, 0, Math.PI * 2);
  ctx.fill();
  // Glow on surrounding area
  const torchGlow = ctx.createRadialGradient(x, y - 10, 0, x, y - 10, 40);
  torchGlow.addColorStop(0, 'rgba(255,160,30,0.18)');
  torchGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = torchGlow;
  ctx.beginPath();
  ctx.ellipse(x, y - 10, 40, 40, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRuneCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  tick: number,
): void {
  const alpha = 0.3 + 0.1 * Math.sin(tick * 0.03);
  // Outer ring
  ctx.strokeStyle = `rgba(160,100,255,${alpha + 0.1})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Inner ring
  ctx.strokeStyle = `rgba(100,200,255,${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
  ctx.stroke();
  // Rune marks (6 points)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + tick * 0.01;
    const mx = cx + Math.cos(angle) * r;
    const my = cy + Math.sin(angle) * r;
    ctx.strokeStyle = `rgba(180,120,255,${alpha + 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(cx + Math.cos(angle) * r * 0.4, cy + Math.sin(angle) * r * 0.4);
    ctx.stroke();
    // Rune node
    ctx.fillStyle = `rgba(200,150,255,${alpha + 0.2})`;
    ctx.beginPath();
    ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hexagon inscribed
  ctx.strokeStyle = `rgba(120,80,200,${alpha * 0.6})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const hx = cx + Math.cos(angle) * r * 0.65;
    const hy = cy + Math.sin(angle) * r * 0.65;
    i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
  }
  ctx.stroke();
}

function drawPotion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  tick: number,
): void {
  const bubble = Math.sin(tick * 0.08 + x) > 0.7;
  // Flask body
  ctx.fillStyle = color + 'cc';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Flask neck
  ctx.fillStyle = '#c8b89a';
  ctx.fillRect(x - 3, y - 8, 6, 10);
  // Cork
  ctx.fillStyle = '#8b6340';
  ctx.fillRect(x - 4, y - 12, 8, 5);
  // Liquid highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(x - 3, y + 4, 3, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Bubble
  if (bubble) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x + 2, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Glow
  const glow = ctx.createRadialGradient(x, y + 4, 0, x, y + 4, 18);
  glow.addColorStop(0, color + '44');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 18, 18, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMagicParticles(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  color: string,
  count: number,
  tick: number,
): void {
  for (let i = 0; i < count; i++) {
    // Deterministic pseudo-random position based on i
    const seed = i * 137.508;
    const px = rx + ((seed * 7 + tick * (0.2 + i * 0.05)) % rw);
    const py = ry + (seed * 13 + (rh - (tick * (0.4 + i * 0.03)) % rh));
    const alpha = 0.4 + 0.4 * Math.sin(tick * 0.08 + i);
    const size = 1 + Math.sin(tick * 0.1 + i * 2) * 0.5;
    ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
    ctx.beginPath();
    ctx.arc(px % (rx + rw), ry + (py - ry) % rh, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVines(
  ctx: CanvasRenderingContext2D,
  x: number,
  yStart: number,
  length: number,
  tick: number,
): void {
  ctx.strokeStyle = '#2d5a1e';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const ox = x + i * 10 - 10;
    const wave = Math.sin(tick * 0.02 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(ox + wave, yStart);
    for (let y = yStart; y < yStart + length; y += 8) {
      const wx = ox + Math.sin((y + tick * 0.5 + i * 20) * 0.15) * 6;
      ctx.lineTo(wx, y);
    }
    ctx.stroke();
    // Leaves at intervals
    for (let y = yStart + 12; y < yStart + length; y += 20 + i * 5) {
      const lx = ox + Math.sin((y + i * 20) * 0.15) * 6;
      ctx.fillStyle = i === 1 ? '#3d7a2e' : '#2d6020';
      ctx.beginPath();
      ctx.ellipse(lx + 6, y, 7, 4, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Character accessories ───

function drawCharacterAccessory(
  ctx: CanvasRenderingContext2D,
  char: PixelCharacter,
  tick: number,
): void {
  const headX = char.currentX;
  const headY = char.currentY - CHAR_FRAME_H * 2;

  switch (char.role) {
    case 'pm': {
      // Tall wizard hat (pointed, dark purple with gold band)
      ctx.fillStyle = '#2a0a4a';
      ctx.beginPath();
      ctx.moveTo(headX, headY - 22);       // tip
      ctx.lineTo(headX - 10, headY - 2);   // left base
      ctx.lineTo(headX + 10, headY - 2);   // right base
      ctx.closePath();
      ctx.fill();
      // Gold band
      ctx.fillStyle = '#d4a800';
      ctx.fillRect(headX - 10, headY - 7, 20, 4);
      // Star at tip
      ctx.fillStyle = `rgba(255,220,50,${0.7 + 0.3 * Math.sin(tick * 0.08)})`;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const sx = headX + Math.cos(a) * 3;
        const sy = headY - 22 + Math.sin(a) * 3;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'builder': {
      // Iron helmet
      ctx.fillStyle = '#5a6472';
      ctx.beginPath();
      ctx.arc(headX, headY + 2, 10, Math.PI, 0);
      ctx.fill();
      // Visor
      ctx.fillStyle = '#2a3040';
      ctx.fillRect(headX - 8, headY + 1, 16, 4);
      // Metal shine
      ctx.fillStyle = 'rgba(200,220,240,0.4)';
      ctx.fillRect(headX - 6, headY - 5, 4, 3);
      break;
    }
    case 'designer': {
      // Flower crown
      const flowers = ['#ff6b8a', '#ff9f45', '#7bc8ff', '#a78bfa', '#4ade80'];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const fx = headX + Math.cos(a) * 9;
        const fy = headY - 1 + Math.sin(a) * 4;
        ctx.fillStyle = flowers[i];
        ctx.beginPath();
        ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffff88';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'wiki-curator': {
      // Floating open tome / scroll
      const bobY = Math.sin(tick * 0.06) * 2;
      ctx.fillStyle = '#8b6840';
      ctx.beginPath();
      ctx.roundRect(headX - 10, headY - 20 + bobY, 20, 14, 2);
      ctx.fill();
      // Pages
      ctx.fillStyle = '#f5edd8';
      ctx.fillRect(headX - 8, headY - 18 + bobY, 16, 10);
      // Text lines on page
      ctx.fillStyle = '#8b7050';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(headX - 6, headY - 16 + bobY + i * 3, 12, 1);
      }
      // Tome glow
      ctx.fillStyle = `rgba(200,180,120,${0.15 + 0.1 * Math.sin(tick * 0.05)})`;
      ctx.beginPath();
      ctx.ellipse(headX, headY - 13 + bobY, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'intake': {
      // Magic wand with star
      ctx.strokeStyle = '#6b4226';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(headX + 8, headY - 2);
      ctx.lineTo(headX + 14, headY - 14);
      ctx.stroke();
      // Star tip
      const sparkle = 0.7 + 0.3 * Math.sin(tick * 0.12);
      ctx.fillStyle = `rgba(255,220,50,${sparkle})`;
      ctx.beginPath();
      ctx.arc(headX + 14, headY - 14, 3, 0, Math.PI * 2);
      ctx.fill();
      // Sparkles emanating
      if (Math.sin(tick * 0.1) > 0.5) {
        for (let i = 0; i < 3; i++) {
          const sa = (tick * 0.1 + i * 2) % (Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,100,0.6)`;
          ctx.beginPath();
          ctx.arc(headX + 14 + Math.cos(sa) * 6, headY - 14 + Math.sin(sa) * 6, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'qa': {
      // Monocle (glass circle with chain)
      ctx.strokeStyle = '#c8a040';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(headX + 5, headY + 4, 5, 0, Math.PI * 2);
      ctx.stroke();
      // Chain
      ctx.strokeStyle = '#a08030';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(headX + 5, headY + 9);
      ctx.lineTo(headX + 2, headY + 14);
      ctx.stroke();
      ctx.setLineDash([]);
      // Lens glint
      ctx.fillStyle = 'rgba(200,230,255,0.5)';
      ctx.beginPath();
      ctx.arc(headX + 3, headY + 2, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      break;
  }
}

// ─── Fantasy room drawing functions ───

function drawMageTowerRoom(ctx: CanvasRenderingContext2D, tick: number): void {
  // Floor: dark stone tiles
  const floorImg = loadSprite('/sprites/floors/floor_5.png');
  if (floorImg.complete && floorImg.naturalWidth > 0) {
    for (let ty = 0; ty < ROOM_H; ty += DTILE) {
      for (let tx = 0; tx < ROOM_W; tx += DTILE) {
        ctx.drawImage(floorImg, 0, 0, TILE, TILE, tx, ty, DTILE, DTILE);
      }
    }
  } else {
    ctx.fillStyle = '#1a1428';
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  }
  // Purple atmospheric overlay
  ctx.fillStyle = 'rgba(80,20,160,0.08)';
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);

  // Back wall (top strip)
  ctx.fillStyle = '#0e0818';
  ctx.fillRect(0, 0, ROOM_W, 30);
  // Wall runes
  ctx.font = '12px serif';
  for (let wx = 20; wx < ROOM_W - 20; wx += 60) {
    ctx.fillStyle = `rgba(160,80,255,${0.4 + 0.2 * Math.sin(tick * 0.04 + wx)})`;
    ctx.fillText('✦', wx, 22);
  }

  // Arcane circles on floor (2 circles)
  drawRuneCircle(ctx, 80, 160, 36, tick);
  drawRuneCircle(ctx, 240, 270, 28, tick);

  // Crystals in corners
  drawCrystal(ctx, 14, 280, 30, '#9b59b6', tick);
  drawCrystal(ctx, 305, 60, 22, '#8e44ad', tick);

  // Desks and PCs
  const deskImg = loadSprite('/sprites/furniture/DESK_FRONT.png');
  const pcImg = loadSprite('/sprites/furniture/PC_FRONT_ON_1.png');
  // Top row desks
  if (deskImg.complete && deskImg.naturalWidth > 0) ctx.drawImage(deskImg, 0, 0, 48, 32, 16, 64, 96, 64);
  if (pcImg.complete && pcImg.naturalWidth > 0) ctx.drawImage(pcImg, 0, 0, 16, 32, 48, 0, 32, 64);
  if (deskImg.complete && deskImg.naturalWidth > 0) ctx.drawImage(deskImg, 0, 0, 48, 32, 176, 64, 96, 64);
  if (pcImg.complete && pcImg.naturalWidth > 0) ctx.drawImage(pcImg, 0, 0, 16, 32, 208, 0, 32, 64);
  // Bottom row desks
  if (deskImg.complete && deskImg.naturalWidth > 0) ctx.drawImage(deskImg, 0, 0, 48, 32, 16, 192, 96, 64);
  if (pcImg.complete && pcImg.naturalWidth > 0) ctx.drawImage(pcImg, 0, 0, 16, 32, 48, 128, 32, 64);
  if (deskImg.complete && deskImg.naturalWidth > 0) ctx.drawImage(deskImg, 0, 0, 48, 32, 176, 192, 96, 64);
  if (pcImg.complete && pcImg.naturalWidth > 0) ctx.drawImage(pcImg, 0, 0, 16, 32, 208, 128, 32, 64);

  // Monitor purple glow
  ctx.fillStyle = `rgba(180,100,255,${0.15 + 0.05 * Math.sin(tick * 0.06)})`;
  ctx.beginPath(); ctx.ellipse(64, 32, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(224, 32, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(64, 160, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(224, 160, 20, 14, 0, 0, Math.PI * 2); ctx.fill();

  // Floating particles
  drawMagicParticles(ctx, 0, 0, ROOM_W, ROOM_H, '#a78bfa', 12, tick);
}

function drawEnchantedGardenRoom(ctx: CanvasRenderingContext2D, tick: number): void {
  const ox = ROOM_W; // offset x
  // Floor: grass tiles
  const floorImg = loadSprite('/sprites/floors/floor_3.png');
  if (floorImg.complete && floorImg.naturalWidth > 0) {
    for (let ty = 0; ty < ROOM_H; ty += DTILE) {
      for (let tx = 0; tx < ROOM_W; tx += DTILE) {
        ctx.drawImage(floorImg, 0, 0, TILE, TILE, ox + tx, ty, DTILE, DTILE);
      }
    }
  } else {
    ctx.fillStyle = '#1a3010';
    ctx.fillRect(ox, 0, ROOM_W, ROOM_H);
  }
  // Green atmospheric overlay
  ctx.fillStyle = 'rgba(20,80,20,0.1)';
  ctx.fillRect(ox, 0, ROOM_W, ROOM_H);

  // Back wall with vines
  ctx.fillStyle = '#0a1a08';
  ctx.fillRect(ox, 0, ROOM_W, 30);
  drawVines(ctx, ox + 30, 0, 120, tick);
  drawVines(ctx, ox + 100, 0, 80, tick);
  drawVines(ctx, ox + 200, 0, 100, tick);
  drawVines(ctx, ox + 280, 0, 60, tick);

  // Mushrooms of varying sizes
  drawMushroom(ctx, ox + 40, 280, 1.2, tick);
  drawMushroom(ctx, ox + 260, 200, 0.8, tick);
  drawMushroom(ctx, ox + 140, 310, 0.6, tick);

  // Crystals (teal/aqua)
  drawCrystal(ctx, ox + 290, 290, 28, '#1abc9c', tick + 50);
  drawCrystal(ctx, ox + 22, 100, 18, '#16a085', tick + 30);

  // Large plants (sprites)
  const plantImg = loadSprite('/sprites/furniture/LARGE_PLANT.png');
  if (plantImg.complete && plantImg.naturalWidth > 0) {
    ctx.drawImage(plantImg, 0, 0, 32, 48, ox + 200, 200, 64, 96);
    ctx.drawImage(plantImg, 0, 0, 32, 48, ox + 40, 140, 64, 96);
  }

  // Glowing orbs floating
  for (let i = 0; i < 5; i++) {
    const bx = ox + 50 + i * 55 + Math.sin(tick * 0.04 + i * 1.3) * 15;
    const by = 60 + Math.cos(tick * 0.05 + i) * 20;
    ctx.fillStyle = `rgba(${i % 2 === 0 ? '100,255,150' : '150,200,255'},${0.5 + 0.3 * Math.sin(tick * 0.07 + i)})`;
    ctx.beginPath();
    ctx.arc(bx, by, 3 + Math.sin(tick * 0.08 + i) * 1, 0, Math.PI * 2);
    ctx.fill();
    const orbGlow = ctx.createRadialGradient(bx, by, 0, bx, by, 12);
    orbGlow.addColorStop(0, 'rgba(100,255,150,0.2)');
    orbGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = orbGlow;
    ctx.beginPath();
    ctx.arc(bx, by, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMagicParticles(ctx, ox, 0, ROOM_W, ROOM_H, '#4ade80', 14, tick + 20);
}

function drawDungeonForgeRoom(ctx: CanvasRenderingContext2D, tick: number): void {
  const oy = ROOM_H; // offset y
  // Floor: dark stone
  const floorImg = loadSprite('/sprites/floors/floor_0.png');
  if (floorImg.complete && floorImg.naturalWidth > 0) {
    for (let ty = 0; ty < ROOM_H; ty += DTILE) {
      for (let tx = 0; tx < ROOM_W; tx += DTILE) {
        ctx.drawImage(floorImg, 0, 0, TILE, TILE, tx, oy + ty, DTILE, DTILE);
      }
    }
  } else {
    ctx.fillStyle = '#141010';
    ctx.fillRect(0, oy, ROOM_W, ROOM_H);
  }
  // Dark amber atmospheric overlay
  ctx.fillStyle = 'rgba(60,20,5,0.15)';
  ctx.fillRect(0, oy, ROOM_W, ROOM_H);

  // Back wall (stone)
  ctx.fillStyle = '#1a1210';
  ctx.fillRect(0, oy, ROOM_W, 30);
  // Stone texture blocks
  ctx.lineWidth = 1;
  for (let bx = 0; bx < ROOM_W; bx += 40) {
    ctx.strokeStyle = '#2a2018';
    ctx.strokeRect(bx, oy + 2, 40, 14);
    ctx.strokeRect(bx + 20, oy + 16, 40, 14);
  }

  // Wall torches
  drawTorch(ctx, 60, oy + 40, tick);
  drawTorch(ctx, 220, oy + 40, tick + 30);

  // Sofa (ancient throne aesthetic)
  const sofaBackImg = loadSprite('/sprites/furniture/SOFA_BACK.png');
  const sofaFrontImg = loadSprite('/sprites/furniture/SOFA_FRONT.png');
  if (sofaBackImg.complete && sofaBackImg.naturalWidth > 0) ctx.drawImage(sofaBackImg, 0, 0, 32, 16, 40, oy + 40, 64, 32);
  if (sofaFrontImg.complete && sofaFrontImg.naturalWidth > 0) ctx.drawImage(sofaFrontImg, 0, 0, 32, 16, 40, oy + 72, 64, 32);

  // Forge glow effect (orange circle on ground)
  const forgeGlow = ctx.createRadialGradient(140, oy + ROOM_H - 40, 5, 140, oy + ROOM_H - 40, 60);
  forgeGlow.addColorStop(0, `rgba(255,100,20,${0.2 + 0.1 * Math.sin(tick * 0.1)})`);
  forgeGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = forgeGlow;
  ctx.beginPath();
  ctx.ellipse(140, oy + ROOM_H - 40, 60, 40, 0, 0, Math.PI * 2);
  ctx.fill();

  // Large plant (dungeon specimen)
  const plantImg = loadSprite('/sprites/furniture/LARGE_PLANT.png');
  if (plantImg.complete && plantImg.naturalWidth > 0) ctx.drawImage(plantImg, 0, 0, 32, 48, 240, oy + 10, 64, 96);

  // Coffee table with glowing artifact
  const tableImg = loadSprite('/sprites/furniture/COFFEE_TABLE.png');
  if (tableImg.complete && tableImg.naturalWidth > 0) ctx.drawImage(tableImg, 0, 0, 32, 32, 100, oy + 120, 64, 64);
  // Glowing artifact on table
  ctx.fillStyle = `rgba(255,120,30,${0.5 + 0.3 * Math.sin(tick * 0.1)})`;
  ctx.beginPath();
  ctx.arc(132, oy + 130, 8, 0, Math.PI * 2);
  ctx.fill();

  // Sparse orange embers floating
  drawMagicParticles(ctx, 0, oy, ROOM_W, ROOM_H, '#f97316', 8, tick + 40);
}

function drawAlchemistLabRoom(ctx: CanvasRenderingContext2D, tick: number): void {
  const ox = ROOM_W;
  const oy = ROOM_H;
  // Floor: warm earth
  const floorImg = loadSprite('/sprites/floors/floor_2.png');
  if (floorImg.complete && floorImg.naturalWidth > 0) {
    for (let ty = 0; ty < ROOM_H; ty += DTILE) {
      for (let tx = 0; tx < ROOM_W; tx += DTILE) {
        ctx.drawImage(floorImg, 0, 0, TILE, TILE, ox + tx, oy + ty, DTILE, DTILE);
      }
    }
  } else {
    ctx.fillStyle = '#1a1408';
    ctx.fillRect(ox, oy, ROOM_W, ROOM_H);
  }
  // Cyan/green atmospheric overlay
  ctx.fillStyle = 'rgba(0,40,20,0.12)';
  ctx.fillRect(ox, oy, ROOM_W, ROOM_H);

  // Back wall
  ctx.fillStyle = '#100e08';
  ctx.fillRect(ox, oy, ROOM_W, 30);

  // Clock on wall
  const clockImg = loadSprite('/sprites/furniture/CLOCK.png');
  if (clockImg.complete && clockImg.naturalWidth > 0) ctx.drawImage(clockImg, 0, 0, 16, 32, ox + 140, oy + 2, 32, 64);

  // Potion bottles (3 colors)
  drawPotion(ctx, ox + 50, oy + 80, '#1abc9c', tick);
  drawPotion(ctx, ox + 80, oy + 70, '#9b59b6', tick + 15);
  drawPotion(ctx, ox + 65, oy + 95, '#e74c3c', tick + 30);

  // Large crystal formation (main feature)
  drawCrystal(ctx, ox + 260, oy + 120, 40, '#1de5b5', tick + 70);
  drawCrystal(ctx, ox + 280, oy + 140, 28, '#7c5cfc', tick + 80);
  drawCrystal(ctx, ox + 244, oy + 145, 22, '#00bcd4', tick + 60);

  // Cactus (lab specimen)
  const cactusImg = loadSprite('/sprites/furniture/CACTUS.png');
  if (cactusImg.complete && cactusImg.naturalWidth > 0) ctx.drawImage(cactusImg, 0, 0, 16, 32, ox + 8, oy + 10, 32, 64);

  // Plants (potted specimens)
  const plantImg = loadSprite('/sprites/furniture/PLANT.png');
  if (plantImg.complete && plantImg.naturalWidth > 0) {
    ctx.drawImage(plantImg, 0, 0, 16, 32, ox + 200, oy + 240, 32, 64);
    ctx.drawImage(plantImg, 0, 0, 16, 32, ox + 100, oy + 230, 32, 64);
  }

  // Glowing lab equipment glow
  const labGlow = ctx.createRadialGradient(ox + 260, oy + 100, 5, ox + 260, oy + 100, 50);
  labGlow.addColorStop(0, `rgba(29,229,181,${0.25 + 0.1 * Math.sin(tick * 0.06)})`);
  labGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = labGlow;
  ctx.beginPath();
  ctx.ellipse(ox + 260, oy + 100, 50, 50, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mushroom (specimen)
  drawMushroom(ctx, ox + 170, oy + 240, 0.7, tick);

  // Cyan/teal particles
  drawMagicParticles(ctx, ox, oy, ROOM_W, ROOM_H, '#1de5b5', 10, tick + 60);
}

function drawRoomDividers(ctx: CanvasRenderingContext2D): void {
  // Ancient stone wall dividers
  ctx.fillStyle = '#0a080e';
  ctx.fillRect(ROOM_W - 2, 0, 4, MAP_H);
  ctx.fillRect(0, ROOM_H - 2, MAP_W, 4);
  // Stone texture on dividers
  ctx.fillStyle = '#1a1428';
  for (let y = 10; y < MAP_H; y += 24) {
    ctx.fillRect(ROOM_W - 1, y, 2, 12);
  }
  for (let x = 10; x < MAP_W; x += 24) {
    ctx.fillRect(x, ROOM_H - 1, 12, 2);
  }
}

// ─── Character rendering ───

function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  char: PixelCharacter,
  tick: number,
): void {
  const spritePath = ROLE_CHAR_SPRITE[char.role];
  if (!spritePath) return;
  const img = loadSprite(spritePath);

  // Animation frame
  const isAnimating = char.isMoving || char.state === 'working';
  const frame = isAnimating ? Math.floor(tick / 6) % CHAR_FRAMES : 0;

  // Direction → sprite row
  const dirRow: Record<string, number> = { down: 0, up: 1, right: 2, left: 2 };
  const row = dirRow[char.direction] ?? 0;

  const sx = frame * CHAR_FRAME_W;
  const sy = row * CHAR_FRAME_H;
  const dx = char.currentX - CHAR_FRAME_W; // center character on currentX
  const dy = char.currentY - CHAR_FRAME_H * 2;
  const dw = CHAR_FRAME_W * 2;
  const dh = CHAR_FRAME_H * 2;

  if (img.complete && img.naturalWidth > 0) {
    ctx.save();
    if (char.direction === 'left') {
      // Mirror for left direction
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H, 0, 0, dw, dh);
    } else {
      ctx.drawImage(img, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H, dx, dy, dw, dh);
    }
    ctx.restore();
  } else {
    const ROLE_FALLBACK: Record<string, string> = {
      intake: '#2e6ea8', 'wiki-curator': '#7a3e55', pm: '#e07c1a',
      builder: '#1f6f68', qa: '#9a3412', designer: '#6d28d9',
    };
    ctx.fillStyle = ROLE_FALLBACK[char.role] ?? '#45556c';
    ctx.fillRect(dx, dy, dw, dh);
  }
}

function drawCharacterLabel(
  ctx: CanvasRenderingContext2D,
  char: PixelCharacter,
): void {
  const cx = char.currentX;
  const baseY = char.currentY + 20;

  ctx.textAlign = 'center';
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(char.name, cx, baseY);

  ctx.font = '8px Inter, sans-serif';
  ctx.fillStyle = '#8b8fa8';
  ctx.fillText(char.role, cx, baseY + 12);

  ctx.textAlign = 'start';
}

function drawStepBubble(
  ctx: CanvasRenderingContext2D,
  char: PixelCharacter,
): void {
  if (!char.currentStep) return;

  const label = char.currentStep.label;
  const next = char.currentStep.nextAgentName;
  const cx = char.currentX;
  const by = char.currentY - 92;

  ctx.font = 'bold 8px Inter, sans-serif';
  const labelW = ctx.measureText(label).width;
  const boxW = Math.max(labelW + 12, 60);
  const boxH = next ? 26 : 16;

  // Pill background
  ctx.fillStyle = 'rgba(124, 58, 237, 0.92)';
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, by, boxW, boxH, 4);
  ctx.fill();

  // Step label
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, by + 10);

  // Next agent hint
  if (next) {
    ctx.font = '7px Inter, sans-serif';
    ctx.fillStyle = '#c4b5fd';
    ctx.fillText(`→ ${next}`, cx, by + 22);
  }

  ctx.textAlign = 'start';
}

function drawStatusBubble(
  ctx: CanvasRenderingContext2D,
  char: PixelCharacter,
): void {
  if (char.status !== 'blocked' && char.status !== 'needs-human') return;

  const bx = char.currentX - 16;
  const by = char.currentY - 80;

  // Background circle
  ctx.fillStyle = 'rgba(220, 60, 60, 0.9)';
  ctx.beginPath();
  ctx.arc(bx + 8, by + 8, 9, 0, Math.PI * 2);
  ctx.fill();

  // Exclamation mark
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', bx + 8, by + 13);
  ctx.textAlign = 'start';
}

// ─── Main render function ───

export function renderOffice(
  ctx: CanvasRenderingContext2D,
  state: PixelOfficeState,
  _w: number,
  _h: number,
): void {
  const { characters, tick } = state;

  // Clear
  ctx.clearRect(0, 0, MAP_W, MAP_H);

  // Draw 4 fantasy rooms
  ctx.save(); drawMageTowerRoom(ctx, tick); ctx.restore();
  ctx.save(); drawEnchantedGardenRoom(ctx, tick); ctx.restore();
  ctx.save(); drawDungeonForgeRoom(ctx, tick); ctx.restore();
  ctx.save(); drawAlchemistLabRoom(ctx, tick); ctx.restore();

  // Room dividers
  drawRoomDividers(ctx);

  // Draw characters with accessories
  for (const char of characters) {
    drawCharacterSprite(ctx, char, tick);
    drawCharacterAccessory(ctx, char, tick);
    drawCharacterLabel(ctx, char);
    drawStepBubble(ctx, char);
    drawStatusBubble(ctx, char);
  }
}

export function getOfficeWidth(_count?: number): number {
  return MAP_W;
}

export function getOfficeHeight(): number {
  return MAP_H;
}
