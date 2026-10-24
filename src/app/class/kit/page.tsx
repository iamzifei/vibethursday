import type { Metadata } from "next";
import Link from "next/link";
import { ClassKitShell } from "@/components/ClassKitShell";

export const metadata: Metadata = {
  title: "课堂工作本 · 老板的 AI 第一课",
  // Used in the room on the day; nothing here for a search result (also in robots.ts).
  robots: { index: false, follow: false },
};

const STEPS = [
  { href: "/class/card", n: "1", title: "三行卡片", when: "开场", what: "你做什么生意、最头疼的一件事。交给 James，现场挑几张念。" },
  { href: "/class/profile", n: "2", title: "业务档案 13 格", when: "动手环节", what: "填完生成一个文件，拖进 AI 平台。不会传到我们这里。" },
  { href: "/class/pack", n: "3", title: "行业知识包", when: "动手环节", what: "五条老经验 + 一条最新规定。生成文件，拖进平台。不会传到我们这里。" },
  { href: "/class/spec", n: "4", title: "交需求说明书", when: "第五段", what: "把平台帮你梳理的说明书贴进来，交给 James。" },
];

/** The list of workbook steps; the one address shown on the slides. */
export default function ClassKitPage() {
  return (
    <ClassKitShell
      step="课堂工作本"
      title="今天不用纸笔，全在这里填"
      lede="手机、电脑都能打开。填的内容会自动存在你这台设备的浏览器里。生成文件的两步，建议在电脑上做，下载后直接拖进平台。"
    >
      <ol className="stack-4" style={{ listStyle: "none", padding: 0 }}>
        {STEPS.map((step) => (
          <li key={step.href}>
            <Link href={step.href} className="btn btn--secondary btn--block" style={{ justifyContent: "flex-start", textAlign: "left", height: "auto", padding: "var(--space-4)" }}>
              <span className="stack-1">
                <strong>
                  {step.n} · {step.title}
                </strong>
                <span className="field-hint" style={{ display: "block" }}>
                  {step.when} · {step.what}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </ClassKitShell>
  );
}
