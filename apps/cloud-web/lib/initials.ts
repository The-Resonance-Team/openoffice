export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
