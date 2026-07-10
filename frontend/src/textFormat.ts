const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

/** ISO 3166-1 alpha-2 code (e.g. "CN") -> display name (e.g. "China"). Falls back to the raw code. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  const normalized = code.toUpperCase() === "UK" ? "GB" : code.toUpperCase();
  try {
    return regionNames?.of(normalized) || code;
  } catch {
    return code;
  }
}

/** ISO 3166-1 alpha-2 code -> flag emoji, via the standard regional-indicator-symbol trick. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  // "UK" is colloquially used but "GB" is the ISO 3166-1 alpha-2 code for the flag emoji
  const normalized = code.toUpperCase() === "UK" ? "GB" : code.toUpperCase();
  try {
    const points = [...normalized].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
    return String.fromCodePoint(...points);
  } catch {
    return "";
  }
}

/** "news" -> "News", "kids-shows" -> "Kids Shows". Handles hyphens/underscores/spaces. */
export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase() === "xxx" ? "XXX" : word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
