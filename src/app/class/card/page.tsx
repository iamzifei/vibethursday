import type { Metadata } from "next";
import { ClassKitForm } from "@/components/ClassKitForm";
import { ClassKitShell } from "@/components/ClassKitShell";

export const metadata: Metadata = {
  title: "三行卡片 · 老板的 AI 第一课",
  robots: { index: false, follow: false },
};

export default function ClassCardPage() {
  return (
    <ClassKitShell step="1 · 三行卡片" title="三行字，三分钟" lede="写完跟旁边的人互相念一遍。待会儿你搭好的智能体，第一个要回答的就是它。">
      <ClassKitForm kind="card" submit />
    </ClassKitShell>
  );
}
