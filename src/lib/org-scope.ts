export function whereOrg<T extends Record<string, unknown>>(orgId: string, where: T = {} as T): T & { orgId: string } {
  return {
    orgId,
    ...where,
  };
}
