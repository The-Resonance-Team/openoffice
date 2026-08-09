import slugify from 'slugify';
import type { PrismaService } from '@/prisma/prisma.service';

/** A free Org slug for `name`; appends -2, -3... while taken (ADR: slug unique). */
export async function uniqueOrgSlug(prisma: PrismaService, name: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true }).slice(0, 40);
  let slug = base || 'org';
  for (let i = 2; i <= 10; i++) {
    if (!(await prisma.org.findUnique({ where: { slug } }))) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}
