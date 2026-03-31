/**
 * Scoped Prisma client wrapper.
 * Enforces org-scoping for tenant-owned models so cross-org leaks are mechanically impossible.
 */

import { prisma } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";
import { InvariantError } from "@/lib/invariant";
import { isTenantModel } from "./tenant-models";

export interface ScopedContext {
  orgId: string;
}

const READ_OPS = ["findMany", "findFirst", "findUnique", "count", "aggregate", "groupBy"] as const;
const WRITE_OPS = ["create", "update", "delete", "upsert", "createMany", "updateMany", "deleteMany"] as const;

function ensureOrgId(ctx: ScopedContext | null | undefined): string {
  if (!ctx?.orgId) {
    throw new InvariantError(
      403,
      "Organization context required for database access",
      { entityType: "scopedDb" }
    );
  }
  return ctx.orgId;
}

function mergeOrgIntoWhere(where: unknown, orgId: string): Record<string, unknown> {
  const base = (where && typeof where === "object" ? { ...where } : {}) as Record<string, unknown>;
  if (base.orgId !== undefined && base.orgId !== orgId) {
    throw new InvariantError(
      403,
      "orgId in where clause must match request context",
      { provided: base.orgId, expected: orgId }
    );
  }
  return { ...base, orgId };
}

function mergeOrgIntoCreateData(data: unknown, orgId: string): Record<string, unknown> {
  const base = (data && typeof data === "object" ? { ...data } : {}) as Record<string, unknown>;
  if (base.orgId !== undefined && base.orgId !== orgId) {
    throw new InvariantError(
      403,
      "orgId in create data must match request context or be omitted",
      { provided: base.orgId, expected: orgId }
    );
  }
  return { ...base, orgId };
}

function createScopedDelegate<T extends Record<string, unknown>>(
  delegate: T,
  modelName: string,
  orgId: string
): T {
  if (!isTenantModel(modelName)) {
    return delegate;
  }

  const wrap = <A extends unknown[], R>(fn: (...args: A) => R, op: string) => {
    return (...args: A): R => {
      const arg = args[0] as Record<string, unknown> | undefined;
      const base = (arg && typeof arg === "object" ? arg : {}) as Record<string, unknown>;
      if (op === "findUnique") {
        const where = (base.where ?? {}) as Record<string, unknown>;
        // Flatten compound unique keys (e.g., { orgId_sitterId: { orgId, sitterId } })
        // into flat fields for findFirst compatibility
        const flatWhere: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(where)) {
          if (key.includes("_") && val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
            // Compound key — spread its fields into the flat where
            Object.assign(flatWhere, val as Record<string, unknown>);
          } else {
            flatWhere[key] = val;
          }
        }
        const merged = mergeOrgIntoWhere(flatWhere, orgId);
        return (delegate.findFirst as (...a: unknown[]) => R)({ ...base, where: merged });
      }
      if (READ_OPS.includes(op as (typeof READ_OPS)[number])) {
        const where = base.where;
        const merged = mergeOrgIntoWhere(where ?? {}, orgId);
        return (delegate[op as keyof T] as (...a: unknown[]) => R)({ ...base, where: merged });
      }
      if (op === "create") {
        const data = base.data;
        const merged = mergeOrgIntoCreateData(data ?? {}, orgId);
        return (delegate.create as (...a: unknown[]) => R)({ ...base, data: merged });
      }
      if (op === "createMany") {
        const data = base.data;
        const arr = Array.isArray(data) ? data : data ? [data] : [];
        const withOrg = arr.map((d) => mergeOrgIntoCreateData(d, orgId));
        return (delegate.createMany as (...a: unknown[]) => R)({ ...base, data: withOrg });
      }
      if (["update", "delete", "updateMany", "deleteMany"].includes(op)) {
        const where = base.where;
        const merged = mergeOrgIntoWhere(where ?? {}, orgId);
        return (delegate[op as keyof T] as (...a: unknown[]) => R)({ ...base, where: merged });
      }
      if (op === "upsert") {
        const where = base.where;
        const create = base.create;
        const update = base.update;
        const mergedWhere = mergeOrgIntoWhere(where ?? {}, orgId);
        const mergedCreate = mergeOrgIntoCreateData(create ?? {}, orgId);
        return (delegate.upsert as (...a: unknown[]) => R)({
          ...base,
          where: mergedWhere,
          create: mergedCreate,
          update: update ?? {},
        });
      }
      return (delegate[op as keyof T] as (...a: unknown[]) => R)(...args);
    };
  };

  const result = { ...delegate };
  for (const op of [...READ_OPS, ...WRITE_OPS]) {
    if (typeof delegate[op] === "function") {
      (result as Record<string, unknown>)[op] = wrap(delegate[op] as (...a: unknown[]) => unknown, op);
    }
  }
  return result as T;
}

function createScopedProxy(base: PrismaClient, orgId: string): PrismaClient {
  return new Proxy(base, {
    get(target, prop: string) {
      const value = (target as unknown as Record<string, unknown>)[prop];
      if (prop.startsWith("$")) {
        // $transaction, $connect, $disconnect - pass through but wrap $transaction's tx
        if (prop === "$transaction" && typeof value === "function") {
          return async (arg: unknown) => {
            if (typeof arg === "function") {
              return (value as (fn: (tx: PrismaClient) => Promise<unknown>) => Promise<unknown>)(async (tx) => {
                return arg(createScopedProxy(tx as PrismaClient, orgId));
              });
            }
            throw new InvariantError(500, "Scoped $transaction with array not supported; use callback form", {
              meta: { entityType: "scopedDb" },
            });
          };
        }
        return value;
      }
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return createScopedDelegate(value as Record<string, unknown>, prop, orgId);
      }
      return value;
    },
  }) as PrismaClient;
}

/**
 * Returns a Prisma client proxy that enforces org-scoping for tenant models.
 * - findMany/findFirst/findUnique: orgId is merged into where
 * - create/createMany: orgId is set in data (rejects conflicting orgId)
 * - update/delete/upsert/updateMany/deleteMany: orgId is merged into where
 *
 * If ctx.orgId is missing, throws InvariantError 403.
 */
export function getScopedDb(ctx: ScopedContext | null | undefined): PrismaClient {
  const orgId = ensureOrgId(ctx);
  return createScopedProxy(prisma, orgId);
}
