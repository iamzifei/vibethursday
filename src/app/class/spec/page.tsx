import type { Metadata } from "next";
import { ClassKitForm } from "@/components/ClassKitForm";
import { ClassKitShell } from "@/components/ClassKitShell";

export const metadata: Metadata = {
  title: "交需求说明书 · 老板的 AI 第一课",
  robots: { index: false, follow: false },
};

export default function ClassSpecPage() {
  return (
    <ClassKitShell
      step="4 · 需求说明书"
      title="交你的需求说明书"
      lede="对平台说「帮我把这件事梳理成需求说明书」，照实回答它的问题，然后把它写好的说明书整段贴进来。写得越清楚，越容易被挑中免费做出来（以实际评估为准）。交上来的内容 James 会看，不想让我们看到的部分（客人名字、具体金额）先删掉再交。"
    >
      <ClassKitForm kind="spec" submit />
    </ClassKitShell>
  );
}
