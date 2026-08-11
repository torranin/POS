export type UserRole = "admin" | "manager" | "warehouse" | "user";

export const roleLabels: Record<UserRole, string> = {
  admin: "ผู้ดูแลระบบ",
  manager: "ผู้จัดการ",
  warehouse: "เจ้าหน้าที่คลัง",
  user: "พนักงานขาย",
};

export function canAccess(role: UserRole, permission: "manage_users" | "manage_settings" | "manage_products" | "reports" | "sales" | "delivery") {
  if (role === "admin") return true;
  if (role === "manager") return permission !== "manage_users";
  if (role === "warehouse") return permission === "manage_products";
  return false;
}
