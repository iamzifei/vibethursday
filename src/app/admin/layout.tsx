import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";

/**
 * Every /admin page sits in the organiser's frame (sidebar or phone menu),
 * but only once signed in: a stranger sees each page's own "not authorised"
 * card and nothing of the menu.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) return children;
  return <AdminFrame>{children}</AdminFrame>;
}
