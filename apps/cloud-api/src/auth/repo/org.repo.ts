import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import slugify from 'slugify';

@Injectable()
export class OrgRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.org.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return this.prisma.org.findUnique({ where: { slug } });
  }

  async create(data: { slug: string; name: string }) {
    return this.prisma.org.create({ data });
  }

  async update(id: string, data: { name?: string; slug?: string }) {
    return this.prisma.org.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.org.delete({ where: { id } });
  }

  /** A free Org slug for `name`; appends -2, -3... while taken (ADR: slug unique). */
  async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true }).slice(0, 40);
    let slug = base || 'org';
    for (let i = 2; i <= 10; i++) {
      if (!(await this.findBySlug(slug))) return slug;
      slug = `${base}-${i}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
