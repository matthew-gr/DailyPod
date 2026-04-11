type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  runId: string;
  stage?: string;
  message: string;
  data?: unknown;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  child(stage: string): Logger;
  getEntries(): LogEntry[];
}

export function createLogger(runId: string, minLevel: LogLevel = "info"): Logger {
  const entries: LogEntry[] = [];

  function makeLogger(stage?: string): Logger {
    function log(level: LogLevel, message: string, data?: unknown): void {
      if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

      const entry: LogEntry = {
        level,
        timestamp: new Date().toISOString(),
        runId,
        stage,
        message,
        data,
      };
      entries.push(entry);

      const color = LEVEL_COLORS[level];
      const prefix = stage ? `[${runId}][${stage}]` : `[${runId}]`;
      const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : "";
      console.log(`${color}${level.toUpperCase().padEnd(5)}${RESET} ${prefix} ${message}${dataStr}`);
    }

    return {
      debug: (msg, data) => log("debug", msg, data),
      info: (msg, data) => log("info", msg, data),
      warn: (msg, data) => log("warn", msg, data),
      error: (msg, data) => log("error", msg, data),
      child: (childStage: string) => makeLogger(childStage),
      getEntries: () => entries,
    };
  }

  return makeLogger();
}
