import { LangSwitch } from "@/components/LangSwitch";
import { SiteNav, type NavItem } from "@/components/SiteNav";
import type { Copy, Lang } from "@/lib/content";
import { langHref, NAV_CTA, NAV_LINKS } from "@/lib/nav";

type Props = {
  lang: Lang;
  copy: Copy;
  /**
   * The current page with no `lang` parameter on it, e.g. "/members" or
   * "/members/jane". The language switch builds one URL per language from it,
   * so switching language keeps you on the page you were reading — which is
   * why this is passed in rather than derived: only the page knows its own
   * address once there is a slug in it.
   */
  path: string;
};

/**
 * The bar every page opens with.
 *
 * A server component that does nothing but turn `NAV_LINKS` into labelled,
 * language-aware hrefs and render the language switch; the bar itself is
 * `SiteNav`, which needs state for the phone menu.
 */
export function SiteHeader({ lang, copy, path }: Props) {
  // The section anchors are written against the home page, so they work from
  // /members and /support as well as from the page they point into.
  const items: NavItem[] = NAV_LINKS.map((link) => ({
    href: langHref(link.href, lang),
    label: copy.nav[link.label],
  }));

  return (
    <SiteNav
      brand={copy.nav.brand}
      brandHref={langHref("/", lang)}
      items={items}
      cta={{ href: langHref(NAV_CTA.href, lang), label: copy.nav[NAV_CTA.label] }}
      langSwitch={<LangSwitch current={lang} path={path} label={copy.nav.language} />}
      menuLabel={copy.nav.menu}
      skipLabel={copy.nav.skip}
    />
  );
}
