import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "*.email",
      "*.mobile",
      "*.pin",
      "*.pinHash",
      "*.name",
    ],
    censor: "[redacted]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});
