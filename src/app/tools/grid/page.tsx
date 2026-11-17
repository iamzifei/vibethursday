import type { Metadata } from "next";
import { NineGrid } from "@/components/NineGrid";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy } from "@/lib/content";

export const metadata: Metadata = {
  title: "朋友圈九宫格切图 · Vibe Thursday",
  description: "传一张图，直接切成朋友圈九宫格：九张正方形图，发出去拼成一张大图。图片只在你手机上处理，不上传。",
};

/**
 * A small free tool (2026-11-18): one picture in, nine square pieces out, so
 * a Moments post shows one big picture. The work is all in `NineGrid`, in the
 * browser; this page is the frame and the three lines of how-to.
 *
 * Chinese only: WeChat Moments is the whole point of it.
 */
export default function GridToolPage() {
  const c = getCopy("zh");

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang="zh" copy={c} path="/tools/grid" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "560px" }}>
            <div className="stack-3">
              <span className="eyebrow">§ 小工具</span>
              <h1>朋友圈九宫格切图</h1>
              <p className="body-lg" style={{ margin: 0 }}>
                传一张图，切成九张正方形。发朋友圈时九张拼回一张大图。
              </p>
            </div>

            <NineGrid />

            <div className="stack-3">
              <h2 className="h3">怎么发</h2>
              <ol className="grid-tool__steps">
                <li>保存这 9 张图（顺序就是图上的编号）。</li>
                <li>发朋友圈 → 从相册选择，<strong>按 1→9 的顺序</strong>依次勾选。</li>
                <li>发出去就是一张完整的大图。</li>
              </ol>
              <p className="body-sm" style={{ margin: 0 }}>
                每张都是 1080×1080 的正方形：朋友圈缩略图本来就按正方形显示，所以在任何手机上都不会被裁掉。图片只在你手机上处理，不会上传。
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
