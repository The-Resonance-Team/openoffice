import { SetMetadata } from '@nestjs/common';
import type { Role } from '@/generated/client';

export const ROLES_KEY = 'roles';

/** Restricts a route to roles (or higher in the hierarchy, ADR 0001). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
