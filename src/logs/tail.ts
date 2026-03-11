/**
 * 로그 파일 마지막 N줄 읽기
 */

import { readFileSync, existsSync } from "node:fs";

const DEFAULT_LINES = 100;

/**
 * 파일의 마지막 N줄 반환 (메모리 효율: 전체 읽고 뒤에서 잘라냄)
 */
export function tailFile(filePath: string, lines = DEFAULT_LINES): string[] {
  if (!existsSync(filePath)) {
    throw new Error(`로그 파일을 찾을 수 없습니다: ${filePath}`);
  }
  const content = readFileSync(filePath, "utf-8");
  const allLines = content.split(/\r?\n/).filter((l) => l.length > 0);
  return allLines.slice(-lines);
}
