import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { QuickBotCheck } from "@/components/QuickBotCheck";
import { getCopy } from "@/lib/content";
import { CHAT_URL } from "@/lib/go";
import { OWNER_SIZES, OWNER_SIZE_LABEL } from "@/lib/owner-lead";

type PageProps = { searchParams: Promise<{ done?: string; err?: string; h?: string }> };

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我是老板 · Vibe Thursday",
  description: "悉尼做生意的老板：留下你这一行，同行老板的小范围专场第一时间通知你。",
};

const ERRORS: Record<string, string> = {
  missing: "称呼和微信号都要填。",
  name: "这个微信号之前报过名，用的是别的名字。请填报名时用的那个名字。",
  bot: "没确认上你不是机器人。等按钮变成可点再点；还不行就刷新一下页面。",
  rate: "这个网络刚提交过好几次了，过几分钟再试。",
  failed: "没提交上，请再试一次；还不行就扫页底二维码加 James 微信。",
};

/**
 * /boss (2026-11-19, owner-lead.ts): the home page's fourth way in. A business
 * owner who wants a result rather than a class leaves their trade and the one
 * job they want AI to take. Chinese only, like /quick: the owners this is for
 * write in Chinese.
 */
export default async function BossPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const c = getCopy("zh");
  const industries = c.signup.fields.industryOptions.filter((option) => option.value !== "student");
  const hint = params.h && /^[^<>]{1,8}$/.test(params.h) ? params.h : null;

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang="zh" copy={c} path="/" />
      <main id="main">
        <section className="section">
          <div className="shell stack-6" style={{ maxWidth: "560px" }}>
            <div className="stack-3">
              <span className="eyebrow">§ 我是老板</span>
              <h1 className="h2" style={{ margin: 0 }}>AI 在你这一行，先做哪件事？</h1>
              <p className="body-lg" style={{ margin: 0 }}>
                留下你这一行和最想让 AI 帮的一件事。同一行的老板凑够了，会开一个 6–8 人的小范围专场，第一时间叫你。
              </p>
            </div>

            {params.done ? (
              <div className="stack-3">
                <p className="alert" role="status">收到了，谢谢。勾了「可以加我微信」的话，James 会在微信上跟你打个招呼，你这一行的专场定了日子也会通知你。</p>
                <p className="body">等不及的话，周四早上直接来坐坐，每次都有不同行业的老板讲自己怎么用 AI。</p>
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <Link className="btn btn--primary" href="/#signup">报名周四 →</Link>
                  <a className="btn btn--secondary" href={CHAT_URL}>想先单独聊 →</a>
                </div>
              </div>
            ) : (
              <form method="post" action="/api/boss" className="stack-4">
                {params.err && ERRORS[params.err] && (
                  <p className="alert alert--error" role="alert">
                    {ERRORS[params.err]}
                    {params.err === "name" && hint && ` 你上次填的名字是「${hint}」这样开头结尾的。`}
                  </p>
                )}
                <div>
                  <label className="label" htmlFor="boss-name">怎么称呼你</label>
                  <input className="field" id="boss-name" name="name" required maxLength={60} autoComplete="name" placeholder="比如：陈总 / Kevin" />
                </div>
                <div>
                  <label className="label" htmlFor="boss-wechat">微信号</label>
                  <input className="field" id="boss-wechat" name="wechat" required maxLength={60} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="微信号，不是昵称" />
                  <p className="field-hint">只有主办人看得到。在 微信 → 我 → 头像右边「微信号：」后面那串。</p>
                </div>
                <div>
                  <label className="label" htmlFor="boss-industry">你做哪一行</label>
                  <select className="field" id="boss-industry" name="industry" defaultValue="">
                    <option value="">选一个最接近的</option>
                    {industries.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="boss-shop">店名或公司名（选填）</label>
                  <input className="field" id="boss-shop" name="shop" maxLength={100} />
                </div>
                <div>
                  <label className="label" htmlFor="boss-size">多大规模（选填）</label>
                  <select className="field" id="boss-size" name="size" defaultValue="">
                    <option value="">不想说</option>
                    {OWNER_SIZES.map((size) => (
                      <option key={size} value={size}>{OWNER_SIZE_LABEL[size]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="boss-need">最想让 AI 帮你做掉的一件事（选填）</label>
                  <textarea className="field" id="boss-need" name="need" rows={3} maxLength={1000} placeholder="比如：客人问价我回得太慢 / 想要西人客户 / 每个月请人写小红书效果一般" />
                  <p className="field-hint">顺手写一句现在怎么做、花多少时间或钱，最容易对上同行的做法。</p>
                </div>
                <label className="choice" style={{ alignItems: "flex-start" }}>
                  <input type="checkbox" name="consent" value="1" />
                  <span>可以加我微信，有我这一行的专场或者适合我的做法时告诉我</span>
                </label>
                <QuickBotCheck siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} label="提交" />
              </form>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
