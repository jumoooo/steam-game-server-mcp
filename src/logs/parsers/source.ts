/**
 * Source 엔진 로그 파서 (CS, TF2, L4D 등)
 * 예: L 01/15/2024 - 12:00:00: "PlayerName<STEAMID>" connected
 */

import type { LogEvent } from "../types.js";

export function parseSourceLine(line: string): LogEvent | null {
  // L 01/15/2024 - 12:00:00: "PlayerName<STEAM_0:0:123>" connected
  const connectMatch = line.match(/"([^"]+)"\s+connected/i);
  if (connectMatch) {
    const playerName = connectMatch[1].replace(/<[^>]+>$/, "").trim();
    return {
      type: "player_join",
      playerName,
      message: line,
      raw: line,
    };
  }

  // "PlayerName<STEAM_0:0:123>" disconnected
  const disconnectMatch = line.match(/"([^"]+)"\s+disconnected/i);
  if (disconnectMatch) {
    const playerName = disconnectMatch[1].replace(/<[^>]+>$/, "").trim();
    return {
      type: "player_leave",
      playerName,
      message: line,
      raw: line,
    };
  }

  // Error, Warning
  if (/error|warning|fatal/i.test(line)) {
    return { type: "error", message: line, raw: line };
  }

  return null;
}
