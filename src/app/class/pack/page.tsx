import type { Metadata } from "next";
import { ClassKitForm } from "@/components/ClassKitForm";
import { ClassKitShell } from "@/components/ClassKitShell";

export const metadata: Metadata = {
  title: "行业知识包 · 老板的 AI 第一课",
  robots: { index: false, follow: false },
};

export default function ClassPackPage() {
  return (
    <ClassKitShell
      step="3 · 行业知识包"
      title="你这一行的知识包"
      lede="老经验在你脑子里，写下来就行；规定从官方网站拷原文，写上日期。网上随手能查到的常识不用写。这一页的内容只存在你的浏览器里，不会传到我们这里。"
    >
      <ClassKitForm kind="pack" />
    </ClassKitShell>
  );
}
