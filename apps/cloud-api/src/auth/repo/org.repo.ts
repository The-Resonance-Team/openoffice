import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import slugify from 'slugify';
import { Role } from '@/generated/client';

export interface CreatePersonalOrgData {
  userId: string;
  slug: string;
  name: string;
}

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

  async rename(id: string, name: string) {
    return this.prisma.org.update({ where: { id }, data: { name } });
  }

  async changeSlug(id: string, slug: string) {
    return this.prisma.org.update({ where: { id }, data: { slug } });
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

  /**
   * OAuth counterpart of self-serve signup in one transaction: personal Org
   * + OWNER membership, then the Org becomes the User's last-used Org. The
   * repo owns the transaction — the service never touches a raw tx handle.
   */
  async createPersonalOrgForUser(data: CreatePersonalOrgData) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.org.create({ data: { slug: data.slug, name: data.name } });
      await tx.member.create({ data: { orgId: org.id, userId: data.userId, role: Role.OWNER } });
      await tx.user.update({
        where: { id: data.userId },
        data: { lastOrgId: org.id },
      });
      return org.id;
    });
  }
}
