import type { AppRole } from "./types";

export interface UserPermissions {
  dashboard: { canView: boolean };
  newDeviation: { canView: boolean; canSubmit: boolean };
  myRequests: { canView: boolean };
  floorReview: { canView: boolean; canApproveL1: boolean };
  ppcReview: { canView: boolean; canApproveL2: boolean };
  oracleSync: { canView: boolean; canSync: boolean };
  masterData: { canView: boolean; canEdit: boolean };
  formBuilder: { canView: boolean; canEdit: boolean };
  userAccounts: { canView: boolean; canManage: boolean };
  auditLog: { canView: boolean };
  settings: { canView: boolean };
}

export type PermissionPage = keyof UserPermissions;

const noAccess: UserPermissions = {
  dashboard: { canView: false },
  newDeviation: { canView: false, canSubmit: false },
  myRequests: { canView: false },
  floorReview: { canView: false, canApproveL1: false },
  ppcReview: { canView: false, canApproveL2: false },
  oracleSync: { canView: false, canSync: false },
  masterData: { canView: false, canEdit: false },
  formBuilder: { canView: false, canEdit: false },
  userAccounts: { canView: false, canManage: false },
  auditLog: { canView: false },
  settings: { canView: false },
};

export const ROLE_PERMISSION_PRESETS: Record<AppRole, UserPermissions> = {
  ADMIN: {
    dashboard: { canView: true },
    newDeviation: { canView: true, canSubmit: true },
    myRequests: { canView: true },
    floorReview: { canView: true, canApproveL1: true },
    ppcReview: { canView: true, canApproveL2: true },
    oracleSync: { canView: true, canSync: true },
    masterData: { canView: true, canEdit: true },
    formBuilder: { canView: true, canEdit: true },
    userAccounts: { canView: true, canManage: true },
    auditLog: { canView: true },
    settings: { canView: true },
  },
  REQUESTER: {
    ...noAccess,
    dashboard: { canView: true },
    newDeviation: { canView: true, canSubmit: true },
    myRequests: { canView: true },
    settings: { canView: true },
  },
  FLOOR_MANAGER: {
    ...noAccess,
    dashboard: { canView: true },
    floorReview: { canView: true, canApproveL1: true },
    auditLog: { canView: true },
    settings: { canView: true },
  },
  PPC_REVIEWER: {
    ...noAccess,
    dashboard: { canView: true },
    ppcReview: { canView: true, canApproveL2: true },
    oracleSync: { canView: true, canSync: true },
    auditLog: { canView: true },
    settings: { canView: true },
  },
  VIEWER: {
    ...noAccess,
    dashboard: { canView: true },
    oracleSync: { canView: true, canSync: false },
    auditLog: { canView: true },
    settings: { canView: true },
  },
};

export function permissionsForRole(role: AppRole | null): UserPermissions {
  if (!role) return noAccess;
  return ROLE_PERMISSION_PRESETS[role];
}

export function mergePermissions(
  role: AppRole | null,
  overrides: Partial<UserPermissions> | null | undefined,
): UserPermissions {
  const base = permissionsForRole(role);
  if (!overrides) return base;
  return Object.fromEntries(
    Object.keys(base).map((page) => [
      page,
      { ...base[page as PermissionPage], ...(overrides[page as PermissionPage] ?? {}) },
    ]),
  ) as UserPermissions;
}
