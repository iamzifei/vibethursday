"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, FRAMELESS, HELPER_NAV, type AdminGroup } from "@/lib/admin-nav";

/**
 * The organiser's frame (2026-11-02): a sidebar on a wide screen, a top bar
 * with a menu on a phone. The menu is a <details>, so it opens without any
 * script; this component is a client one only to know the current path, for
 * highlighting and for leaving the door page full screen.
 */
export function AdminFrame({ children, helper = false }: { children: ReactNode; helper?: boolean }) {
  const path = usePathname();
  if (FRAMELESS.includes(path)) return <>{children}</>;

  const nav = helper ? HELPER_NAV : ADMIN_NAV;
  const current = nav.flatMap((group) => group.links).find((link) => link.href === path);

  return (
    <div className="admin-frame">
      <details className="admin-topbar">
        <summary>
          <span className="admin-topbar__brand">{helper ? "VT 签到" : "VT 后台"}</span>
          <span className="admin-topbar__here">{current?.label ?? ""}</span>
          <span className="admin-topbar__menu">菜单</span>
        </summary>
        <nav className="admin-nav" aria-label="后台导航（手机）">
          <AdminLinks path={path} nav={nav} />
        </nav>
      </details>
      <aside className="admin-side">
        <a className="admin-side__brand" href={helper ? "/admin/desk" : "/admin"}>{helper ? "VT 签到" : "VT 后台"}</a>
        <nav className="admin-nav" aria-label="后台导航">
          <AdminLinks path={path} nav={nav} />
        </nav>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}

/** The grouped links, shared by the phone menu and the sidebar. */
function AdminLinks({ path, nav }: { path: string; nav: AdminGroup[] }) {
  return (
    <>
      {nav.map((group) => (
        <div className="admin-nav__group" key={group.title}>
          <p className="admin-nav__title">{group.title}</p>
          <ul>
            {group.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} aria-current={link.href === path ? "page" : undefined}>
                  {link.label}
                  {link.hint && <span className="admin-nav__hint">{link.hint}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
