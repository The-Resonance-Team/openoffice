import type { PrismaService } from '@/prisma/prisma.service'

/** A free Org slug for `name`; appends -2, -3... while taken (ADR: slug unique). */
export async function uniqueOrgSlug(prisma: PrismaService, name: string): Promise<string> {
  const base = slugify(name)
  let slug = base
  for (let i = 2; i <= 10; i++) {
    if (!(await prisma.org.findUnique({ where: { slug } }))) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now().toString(36)}`
}

/** Lowercase alphanumerics joined by dashes; empty names become "org". */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'org'
}
