/**
 * 로그 이벤트 타입 (명세 §7.6)
 */

export type LogEventType = "player_join" | "player_leave" | "error";

export interface LogEvent {
  type: LogEventType;
  playerName?: string;
  message: string;
  timestamp?: string;
  raw?: string;
}
