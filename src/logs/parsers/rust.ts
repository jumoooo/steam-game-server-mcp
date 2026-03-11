/**
 * Rust 서버 로그 파서
 * 예: "Player connected: PlayerName (steamid)", "Player disconnected: PlayerName"
 */

import type { LogEvent } from "../types.js";

export function parseRustLine(line: string): LogEvent | null {
  // Player connected: PlayerName (7656119...)
  const connectMatch = line.match(/Player connected:\s*(.+?)\s*\([\d]+\)/i);
  if (connectMatch) {
    return {
      type: "player_join",
      playerName: connectMatch[1].trim(),
      message: line,
      raw: line,
    };
  }

  // Player disconnected: PlayerName
  const disconnectMatch = line.match(/Player disconnected:\s*(.+?)(?:\s|$)/i);
  if (disconnectMatch) {
    return {
      type: "player_leave",
      playerName: disconnectMatch[1].trim(),
      message: line,
      raw: line,
    };
  }

  // Error, Exception, Fatal
  if (/error|exception|fatal/i.test(line)) {
    return { type: "error", message: line, raw: line };
  }

  return null;
}
