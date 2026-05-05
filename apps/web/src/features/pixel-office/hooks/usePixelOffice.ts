import type { Agent } from "@atellier/shared";
import type { PixelCharacter, PixelCharacterState } from "../engine/types";
import { SEATS } from "../engine/renderer";

const ROLE_SEAT_PRIORITY: Record<string, number[]> = {
  builder:        [0, 1, 2, 3, 9, 10],
  pm:             [0, 1, 2, 3, 9, 10],
  designer:       [4, 5, 6],
  intake:         [7, 8],
  "wiki-curator": [7, 8, 9],
  qa:             [9, 10, 0, 1],
};

const EXECUTION_ZONES = [
  { x: 320, y: 164 },
  { x: 476, y: 320 },
  { x: 320, y: 476 },
  { x: 164, y: 320 },
];

function hashToIndex(value: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function toState(status: Agent["status"]): PixelCharacterState {
  if (status === "idle") return "idle";
  if (status === "done") return "done";
  if (status === "blocked" || status === "needs-human") return "blocked";
  return "working";
}

export function agentsToPixelCharacters(agents: Agent[], prev?: PixelCharacter[]): PixelCharacter[] {
  const usedSeats = new Set<number>();

  return agents.map((agent) => {
    const preferred = ROLE_SEAT_PRIORITY[agent.role] ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let seatIdx = preferred.find((i) => !usedSeats.has(i));
    if (seatIdx === undefined) {
      seatIdx = Array.from({ length: SEATS.length }, (_, i) => i).find((i) => !usedSeats.has(i)) ?? 0;
    }
    usedSeats.add(seatIdx);

    const seat = SEATS[seatIdx] ?? SEATS[0];
    const executionSeed = `${agent.id}:${agent.lastRunId ?? "none"}`;
    const executionZone = EXECUTION_ZONES[hashToIndex(executionSeed, EXECUTION_ZONES.length)] ?? EXECUTION_ZONES[0];

    // Preserve current position from previous state for smooth movement
    const existing = prev?.find(c => c.id === agent.id);

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      lastRunId: agent.lastRunId,
      currentStep: agent.currentStep
        ? { label: agent.currentStep.label, phase: agent.currentStep.phase, nextAgentName: agent.currentStep.nextAgentName }
        : undefined,
      state: toState(agent.status),
      deskX: seat.x,
      deskY: seat.y,
      workX: executionZone.x,
      workY: executionZone.y,
      currentX: existing?.currentX ?? seat.x,
      currentY: existing?.currentY ?? seat.y,
      targetX: existing?.targetX ?? seat.x,
      targetY: existing?.targetY ?? seat.y,
      direction: existing?.direction ?? "down",
      isMoving: existing?.isMoving ?? false,
      frame: existing?.frame ?? 0,
    };
  });
}
