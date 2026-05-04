import type { AgentRole, AgentStatus } from "@atellier/shared";

export type PixelCharacterState = "idle" | "working" | "blocked" | "done";

export type PixelCharacterDirection = "down" | "up" | "right" | "left";

export type PixelCharacter = {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  state: PixelCharacterState;
  deskX: number;    // home seat X
  deskY: number;    // home seat Y
  currentX: number; // animated position X
  currentY: number; // animated position Y
  targetX: number;  // movement target X
  targetY: number;  // movement target Y
  direction: PixelCharacterDirection;
  isMoving: boolean;
  frame: number;
};

export type PixelOfficeState = {
  characters: PixelCharacter[];
  tick: number;
};
