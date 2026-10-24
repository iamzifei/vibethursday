import type { Metadata } from "next";
import { ClassKitForm } from "@/components/ClassKitForm";
import { ClassKitShell } from "@/components/ClassKitShell";

export const metadata: Metadata = {
  title: "业务档案 13 格 · 老板的 AI 第一课",
  robots: { index: false, follow: false },
};

export default function ClassProfilePage() {
  return (
    <ClassKitShell
      step="2 · 业务档案"
      title="业务档案 13 格"
      lede="这 13 格就是你给 AI 的第一份资料。填不满没关系，空着的格子不会写进文件。这一页的内容只存在你的浏览器里，不会传到我们这里。"
    >
      <ClassKitForm kind="profile" />
    </ClassKitShell>
  );
}
