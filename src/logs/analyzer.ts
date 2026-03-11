/**
 * 로그 분석기 - tail + 게임별 파서 → Event[]
 */

import { tailFile } from "./tail.js";
import { parseRustLine } from "./parsers/rust.js";
import { parseSourceLine } from "./parsers/source.js";
import { parseMinecraftLine } from "./parsers/minecraft.js";
import type { LogEvent } from "./types.js";

type GameType = "rust" | "source" | "minecraft" | string;

function getParser(gameType: string): (line: string) => LogEvent | null {
  switch (gameType.toLowerCase()) {
    case "rust":
      return parseRustLine;
    case "counterstrike2":
    case "cs2":
    case "csgo":
    case "tf2":
    case "left4dead2":
    case "left4dead":
      return parseSourceLine;
    case "minecraft":
      return parseMinecraftLine;
    default:
      // 기본: source 형식 시도 후 rust, minecraft 순
      return (line: string) =>
        parseSourceLine(line) ?? parseRustLine(line) ?? parseMinecraftLine(line);
  }
}

/**
 * 로그 파일에서 최근 이벤트 추출
 */
export function analyzeLogEvents(
  logPath: string,
  gameType: GameType,
  lines = 100
): LogEvent[] {
  const rawLines = tailFile(logPath, lines);
  const parse = getParser(gameType);
  const events: LogEvent[] = [];
  for (const line of rawLines) {
    const ev = parse(line);
    if (ev) events.push(ev);
  }
  return events;
}
