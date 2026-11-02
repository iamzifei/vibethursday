import type { Copy, Lang } from "@/lib/content";
import { langHref } from "@/lib/nav";

type Props = {
  lang: Lang;
  copy: Copy["daySwitch"];
  /** Which form this switch sits above. */
  current: "thursday" | "tuesday";
};

/**
 * Two tabs above each sign-up form: Thursday on the home page, Tuesday on
 * /tuesday (2026-11-02). A newcomer who scanned a code landed on Thursday's
 * form and had to go through the menu to find Tuesday's; now the other day is
 * one tap from either form. Plain links, so it works in WeChat's browser
 * without any script.
 */
export function DaySwitch({ lang, copy, current }: Props) {
  const tabs = [
    { id: "thursday", href: "/#signup", label: copy.thursday },
    { id: "tuesday", href: "/tuesday#signup", label: copy.tuesday },
  ] as const;
  return (
    <nav className="day-switch" aria-label={copy.label}>
      {tabs.map((tab) => (
        <a
          key={tab.id}
          className={tab.id === current ? "day-switch__tab day-switch__tab--on" : "day-switch__tab"}
          href={langHref(tab.href, lang)}
          aria-current={tab.id === current ? "page" : undefined}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
