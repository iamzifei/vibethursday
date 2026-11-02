import type { ReactNode } from "react";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { staffRole } from "@/lib/staff";

/**
 * Every /admin page sits in the organiser's frame (sidebar or phone menu),
 * but only once signed in: a stranger sees each page's own "not authorised"
 * card and nothing of the menu. The helper at the door (2026-11-02) gets the
 * same frame with only the pages open to them.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const role = await staffRole();
  if (!role) return children;
  return <AdminFrame role={role}>{children}</AdminFrame>;
}
