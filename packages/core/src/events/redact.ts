export function redact<T>(value: T, secrets: Set<string>): T {
  if (secrets.size === 0) return value;

  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      for (const s of secrets) {
        if (v.includes(s)) return "[redacted]";
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v).map(([k, val]) => [k, walk(val)])
      );
    }
    return v;
  };

  return walk(value) as T;
}
