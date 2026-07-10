import { Request, Response, NextFunction } from "express";
import { createLogger } from "../logger";

const log = createLogger("http");

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "debug";
    log[level](`${req.method} ${req.originalUrl} ${res.statusCode}`, {
      durationMs: Math.round(durationMs),
    });
  });

  next();
}
