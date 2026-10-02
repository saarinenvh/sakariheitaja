import pino, { Logger } from "pino";
import { readConfig } from "../config";

export type { Logger };

// The same pino-pretty output as sakke-gateway, with the module name in front of the message.
const PRETTY_OPTIONS = {
  colorize: true,
  translateTime: "HH:MM:ss",
  ignore: "pid,hostname,module",
  messageFormat: "[{module}] {msg}",
};

const rootLogger = createRootLogger();

/** The logger for one module; every line it writes names that module. */
export function moduleLogger(module: string): Logger {
  return rootLogger.child({ module });
}

function createRootLogger(): Logger {
  const { pretty, level } = readConfig().logging;
  if (!pretty) return pino({ level });
  return pino({ level, transport: { target: "pino-pretty", options: PRETTY_OPTIONS } });
}
