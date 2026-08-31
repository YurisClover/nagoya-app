export const USER_ROLES = ["general", "executive", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "inactive"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  general: "一般会員",
  executive: "執行部",
  admin: "管理者",
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: "有効",
  inactive: "無効",
};
