/**
 * Minecraft 서버 로그 파서
 * 예: [12:00:00] [Server thread/INFO]: PlayerName joined the game
 */

import type { LogEvent } from "../types.js";

export function parseMinecraftLine(line: string): LogEvent | null {
  // [12:00:00] [Server thread/INFO]: PlayerName joined the game
  const joinMatch = line.match(/\[[\d:]+\]\s+\[[^\]]+\]:\s*(.+?)\s+joined the game/i);
  if (joinMatch) {
    return {
      type: "player_join",
      playerName: joinMatch[1].trim(),
      message: line,
      raw: line,
    };
  }

  // PlayerName left the game
  const leaveMatch = line.match(/\[[\d:]+\]\s+\[[^\]]+\]:\s*(.+?)\s+left the game/i);
  if (leaveMatch) {
    return {
      type: "player_leave",
      playerName: leaveMatch[1].trim(),
      message: line,
      raw: line,
    };
  }

  // WARN, ERROR
  if (/\[[\d:]+\]\s+\[[^\]]*\/?(WARN|ERROR)/i.test(line)) {
    return { type: "error", message: line, raw: line };
  }

  return null;
}
