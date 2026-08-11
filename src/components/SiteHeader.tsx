import Link from "next/link";
import { VibeThursdayMark } from "@/components/VibeThursdayMark";
import type { Copy, Lang } from "@/lib/content";

type Props = {
  lang: Lang;
  copy: Copy;
  /** Where the language toggle goes — the current path in the other language. */
  switchHref: string;
};

/**
 * The bar every page opens with.
 *
 * The language toggle's destination is passed in rather than read from the
 * copy: on the home page it is "/", but on a member's page it has to be that
 * same member's page, or switching language would throw away where you were.
 */
export function SiteHeader({ lang, copy, switchHref }: Props) {
  return (
    <header className="shell" style={{ paddingTop: "var(--space-6)" }}>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
        }}
      >
        <Link
          className="mono"
          href={lang === "en" ? "/?lang=en" : "/"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--fg1)",
          }}
        >
          {/* Accent-coloured while the wordmark stays foreground: the bridge is
              the logo, the name is the label, and colouring both flattens them
              into one shape. Decorative — the link text already says the name. */}
          <span style={{ color: "var(--accent)", display: "flex" }}>
            <VibeThursdayMark size={26} />
          </span>
          {copy.nav.brand}
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Link className="pill" href={lang === "en" ? "/members?lang=en" : "/members"}>
            {copy.nav.members}
          </Link>
          <Link className="pill" href={switchHref} hrefLang={lang === "zh" ? "en" : "zh"}>
            {copy.langSwitchLabel}
          </Link>
        </div>
      </nav>
    </header>
  );
}
