import { useEffect, useRef } from "react";
import { getOfficeHeight, getOfficeWidth, renderOffice, SCALE, TILE } from "./engine/renderer";
import { preloadOfficeSprites } from "./engine/sprites";
import type { PixelCharacter } from "./engine/types";

const MOVE_SPEED = 1.2; // pixels per frame

type Props = {
  characters: PixelCharacter[];
  onCharacterClick?: (characterId: string) => void;
};

export function PixelOfficeCanvas({ characters, onCharacterClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tickRef = useRef(0);
  const rafRef = useRef<number>(0);
  // Mutable character state for smooth movement (avoid re-renders)
  const charsRef = useRef<PixelCharacter[]>([]);

  const w = getOfficeWidth(characters.length);
  const h = getOfficeHeight();

  // Sync incoming characters → charsRef (preserve currentX/Y between renders)
  useEffect(() => {
    charsRef.current = characters.map(incoming => {
      const existing = charsRef.current.find(c => c.id === incoming.id);
      if (!existing) return { ...incoming };
      return {
        ...incoming,
        currentX: existing.currentX,
        currentY: existing.currentY,
        targetX: existing.targetX,
        targetY: existing.targetY,
        direction: existing.direction,
        isMoving: existing.isMoving,
      };
    });
  }, [characters]);

  useEffect(() => {
    preloadOfficeSprites();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;

    const loop = () => {
      tickRef.current += 1;
      const tick = tickRef.current;

      // Update movement for each character
      for (const char of charsRef.current) {
        const isExecuting = char.status === "executing";
        const isWorking  = char.state === "working";
        const isWaiting  = char.state === "waiting"; // needs-human: stays at work zone
        const targetX = isExecuting || isWorking || isWaiting ? char.workX : char.deskX;
        const targetY = isExecuting || isWorking || isWaiting ? char.workY : char.deskY;

        // Work jitter only — no wander for idle (wander kept isMoving=true forever,
        // causing perpetual walk-in-place animation).
        const workJitterX = isExecuting ? Math.sin(tick * 0.02 + char.workX) * 6 : 0;
        const workJitterY = isExecuting ? Math.cos(tick * 0.02 + char.workY) * 3 : 0;

        char.targetX = targetX + workJitterX;
        char.targetY = targetY + workJitterY;

        // Move towards target
        const dx = char.targetX - char.currentX;
        const dy = char.targetY - char.currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > MOVE_SPEED) {
          char.currentX += (dx / dist) * MOVE_SPEED;
          char.currentY += (dy / dist) * MOVE_SPEED;
          char.isMoving = true;

          // Update direction
          if (Math.abs(dx) > Math.abs(dy)) {
            char.direction = dx > 0 ? "right" : "left";
          } else {
            char.direction = dy > 0 ? "down" : "up";
          }
        } else {
          char.currentX = char.targetX;
          char.currentY = char.targetY;
          char.isMoving = false;
          char.direction = "down";
        }
      }

      renderOffice(ctx!, { characters: charsRef.current, tick }, w, h);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [w, h]); // only depend on dimensions; use ref for characters

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onCharacterClick || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const wrapper = canvasRef.current.parentElement;
    const scrollX = wrapper?.scrollLeft ?? 0;
    const scrollY = wrapper?.scrollTop ?? 0;
    const clickX = (e.clientX - rect.left) + scrollX;
    const clickY = (e.clientY - rect.top) + scrollY;

    for (const char of charsRef.current) {
      if (
        clickX >= char.currentX - 30 && clickX <= char.currentX + 30 &&
        clickY >= char.currentY - TILE * SCALE * 2 - 8 && clickY <= char.currentY + 36
      ) {
        onCharacterClick(char.id);
        return;
      }
    }
  };

  return (
    <div className="pixel-office-scroll">
      <canvas
        ref={canvasRef}
        width={w}
        height={h}
        className="pixel-office-canvas"
        onClick={handleClick}
        style={{ cursor: onCharacterClick ? "pointer" : "default" }}
        aria-label="Pixel office visualization"
      />
    </div>
  );
}
