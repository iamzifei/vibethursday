"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ADMIN_TABS, FRAMELESS, navFor, type AdminGroup } from "@/lib/admin-nav";
import { can, STAFF_ROLE_LABEL, type StaffRole } from "@/lib/permissions";

/**
 * The team's frame (2026-11-02), the same for the admin and an assistant:
 *
 * - Phone: a slim top bar saying where you are, and a bottom tab bar with the
 *   four things a session morning runs on (今天 · 签到 · 候补 · 更多). "更多"
 *   opens the full menu. Thumbs reach the bottom of the screen, not the top.
 * - Wide screen: a sidebar with the full menu; no tab bar.
 *
 * The menu is filtered by role (`navFor`), so each person only sees pages
 * they are allowed to open. A client component only for the current path and
 * the open/closed menu.
 */
export function AdminFrame({ children, role }: { children: ReactNode; role: StaffRole }) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shownFor, setShownFor] = useState(path);

  // Close the menu on navigation (including the back button), during render
  // so it is never painted open on the new page.
  if (path !== shownFor) {
    setShownFor(path);
    setMenuOpen(false);
  }

  if (FRAMELESS.includes(path)) return <>{children}</>;

  const nav = navFor(role);
  const current = nav.flatMap((group) => group.links).find((link) => link.href.split("?")[0] === path);
  const brand = role === "admin" ? "VT 后台" : "VT 团队";
  const home = "/admin/today";

  return (
    <div className="admin-frame">
      <header className="admin-topbar">
        <a className="admin-topbar__brand" href={home}>{brand}</a>
        <span className="admin-topbar__here">{current?.label ?? ""}</span>
        <span className="admin-topbar__role">{STAFF_ROLE_LABEL[role]}</span>
      </header>

      {menuOpen && (
        <div className="admin-sheet" id="admin-menu">
          <nav className="admin-nav" aria-label="后台导航（手机）">
            <AdminLinks path={path} nav={nav} />
          </nav>
        </div>
      )}

      <aside className="admin-side">
        <a className="admin-side__brand" href={home}>{brand}</a>
        <span className="admin-side__role">{STAFF_ROLE_LABEL[role]}</span>
        <nav className="admin-nav" aria-label="后台导航">
          <AdminLinks path={path} nav={nav} />
        </nav>
      </aside>

      <div className="admin-main">{children}</div>

      <nav className="admin-tabs" aria-label="常用">
        {ADMIN_TABS.filter((tab) => !tab.href || can(role, tab.perm ?? "admin")).map((tab) =>
          tab.href ? (
            <a
              key={tab.label}
              className="admin-tab"
              href={tab.href}
              aria-current={tab.match.some((prefix) => path.startsWith(prefix)) && !menuOpen ? "page" : undefined}
            >
              {tab.label}
            </a>
          ) : (
            <button
              key={tab.label}
              type="button"
              className="admin-tab"
              aria-expanded={menuOpen}
              aria-controls="admin-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? "收起" : tab.label}
            </button>
          ),
        )}
      </nav>
    </div>
  );
}

/** The grouped links, shared by the phone sheet and the sidebar. */
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
