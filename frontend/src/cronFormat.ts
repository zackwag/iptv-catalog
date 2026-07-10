import cronstrue from "cronstrue";

/**
 * Converts a cron expression into a human-readable description, e.g.
 * "0 4 * * *" -> "At 04:00 AM". Falls back to the raw expression if it
 * can't be parsed (shouldn't normally happen since the backend validates
 * cron expressions before storing them).
 *
 * Note: this describes the expression's fields as written — it reflects
 * whatever timezone the server container is actually running in (its TZ
 * env var), not the browser's timezone. See the README for setting TZ.
 */
export function describeCron(expression: string): string {
  try {
    return cronstrue.toString(expression);
  } catch {
    return expression;
  }
}
