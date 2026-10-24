import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy } from "@/lib/content";
import { COURSE } from "@/lib/course";

/**
 * The frame around every class workbook page (class-kit.ts): the site header,
 * a narrow column, and a way back to the list of steps. Chinese only, like
 * /class: the class is taught in Chinese.
 */
export function ClassKitShell({ step, title, lede, children }: { step: string; title: string; lede: ReactNode; children: ReactNode }) {
  const c = getCopy("zh");
  return (
    <div lang="zh-Hans">
      <SiteHeader lang="zh" copy={c} path="/class" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "680px", fontSize: "1.05rem" }}>
            <div className="stack-3">
              <span className="eyebrow">
                {COURSE.title} · {step}
              </span>
              <h1>{title}</h1>
              <div className="body-lg">{lede}</div>
            </div>
            {children}
            {/* A full-width button, not a text link: on a phone it is the way back
                between steps, and a 15px-tall link is hard to hit. Not on the list itself. */}
            {step !== "课堂工作本" && (
              <Link href="/class/kit" className="btn btn--secondary btn--block">
                ← 回到课堂工作本
              </Link>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
