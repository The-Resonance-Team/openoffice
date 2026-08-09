import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@/generated/client";
import { RolesGuard } from "./roles.guard";

function ctxWith(role: Role | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  const guardFor = (roles: Role[]) =>
    new RolesGuard({
      getAllAndOverride: () => roles,
    } as unknown as Reflector);

  it("passes roles at or above the required weight", () => {
    const guard = guardFor([Role.ADMIN]);
    expect(guard.canActivate(ctxWith(Role.OWNER))).toBe(true);
    expect(guard.canActivate(ctxWith(Role.ADMIN))).toBe(true);
    expect(() => guard.canActivate(ctxWith(Role.TEAM_LEADER))).toThrow(
      ForbiddenException
    );
    expect(() => guard.canActivate(ctxWith(Role.MEMBER))).toThrow(
      ForbiddenException
    );
  });

  it("passes unauthenticated requests when no roles are required", () => {
    const guard = guardFor([]);
    expect(guard.canActivate(ctxWith(undefined))).toBe(true);
  });

  it("passes the lowest gate of multiple required roles", () => {
    const guard = guardFor([Role.ADMIN, Role.TEAM_LEADER]);
    expect(guard.canActivate(ctxWith(Role.ADMIN))).toBe(true);
    expect(guard.canActivate(ctxWith(Role.TEAM_LEADER))).toBe(true);
    expect(() => guard.canActivate(ctxWith(Role.MEMBER))).toThrow(
      ForbiddenException
    );
  });

  it("rejects missing principals", () => {
    const guard = guardFor([Role.MEMBER]);
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(
      ForbiddenException
    );
  });
});
