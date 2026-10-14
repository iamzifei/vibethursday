import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WeChatMark } from "@/components/WeChatMark";
import { Celebration } from "@/components/Celebration";
import { currentAccount } from "@/lib/account";
import { getCopy } from "@/lib/content";
import { COURSE, looksLikeCourseRef } from "@/lib/course";
import { getCourseOrderByRef, getSignupProfile } from "@/lib/db";
import { wechatLoginHref } from "@/lib/login-link";

// Who is asking changes the form, and a reference changes the whole page.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ ref?: string; err?: string; other?: string; done?: string }>;
};

export const metadata: Metadata = {
  title: `${COURSE.title} · Vibe Thursday`,
  // Shared by link in the group and on Moments; not something to rank for,
  // and Thursdays stay the face of this site.
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  missing: "名字和微信号要填一下，好让我们对上你的转账。",
  rate: "提交得太频繁了，过几分钟再试一次。",
  failed: "没提交上，请再试一次；还不行的话直接私信 James（首页最下面有他的微信二维码）。",
};

const BIZ_FOCUS_OPTIONS = [
  { value: "leads", label: "找客户、获客" },
  { value: "content", label: "做内容、营销" },
  { value: "service", label: "客服、回消息" },
  { value: "ops", label: "内部流程、省人手" },
  { value: "unsure", label: "还不知道" },
];

const INDUSTRY_OPTIONS = [
  { value: "property", label: "房产 / 建筑 / 装修" },
  { value: "finance", label: "金融 / 贷款 / 会计 / 保险" },
  { value: "professional", label: "法律 / 移民 / 留学 / 咨询" },
  { value: "food", label: "餐饮 / 食品" },
  { value: "ecommerce", label: "电商 / 零售 / 门店" },
  { value: "trade", label: "外贸 / 物流 / 制造" },
  { value: "education", label: "教育 / 培训" },
  { value: "health", label: "医疗 / 健康 / 美容" },
  { value: "media", label: "媒体 / 内容 / 营销 / 设计" },
  { value: "tech", label: "软件 / 互联网 / IT" },
  { value: "other", label: "其他" },
];

/**
 * The paid class (`course.ts`): what it is, a short form, and — once signed
 * up — how to pay. Chinese only: the class is taught in Chinese.
 *
 * Large type and few fields on purpose: keep the form short and the type big.
 * WeChat login comes first; someone it recognises fills in two optional
 * questions and taps once — or taps "not me" to sign up someone else.
 */
export default async function ClassPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const c = getCopy("zh");

  const ref = looksLikeCourseRef(params.ref) ? params.ref : null;
  const order = ref ? await getCourseOrderByRef(ref).catch(() => null) : null;

  let knownName: string | null = null;
  if (!order && params.other !== "1") {
    const account = await currentAccount();
    if (account) {
      try {
        const profile = await getSignupProfile(account.signupId);
        if (profile?.wechat) knownName = profile.name;
      } catch (error) {
        console.error("[class] could not read the recognised signup", error);
      }
    }
  }

  const loginHref = wechatLoginHref("/class", null);
  const error = params.err && Object.hasOwn(ERRORS, params.err) ? ERRORS[params.err] : null;
  const paymentInfo = process.env.COURSE_PAYMENT_INFO?.replace(/\\n/g, "\n").trim() ?? "";

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang="zh" copy={c} path="/class" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "680px", fontSize: "1.1rem" }}>
            {order ? (
              // ── Signed up: how to pay ─────────────────────────────────
              <div className="stack-6">
                <div className="stack-3">
                  <span className="eyebrow">§ 报名成功</span>
                  <h1>
                    {order.status === "cancelled"
                      ? "这条报名已取消"
                      : order.status === "waitlist"
                        ? "名额已满，你在候补名单上"
                        : order.status === "paid"
                          ? `${order.name}，欢迎加入！`
                          : order.claimed
                            ? `${order.name}，欢迎加入！`
                            : "报上了，最后一步：转账"}
                  </h1>
                </div>

                {order.status === "cancelled" ? (
                  <p className="body-lg">这条报名已经取消了，不用转账。想重新报名，回到报名页再填一次就行。</p>
                ) : order.status === "waitlist" ? (
                  <p className="body-lg">名额已经满了。有人退出，我们会按顺序微信联系你，先不用转账。</p>
                ) : order.status === "paid" ? (
                  <p className="body-lg">已经收到你的转账了，{COURSE.dateLabel}见。</p>
                ) : order.claimed ? (
                  <div className="stack-6">
                    {params.done === "1" && <Celebration />}
                    <div className="tick" aria-hidden="true">✓</div>
                    <p className="body-lg" style={{ margin: 0 }}>
                      转账通知收到了。我们核对到账后，会在微信上联系你，拉你进学员群。
                    </p>
                    <p className="body-lg" style={{ margin: 0 }}>
                      很多老板听 AI 听了一年，你是真的动手的那一个。
                    </p>
                    <div className="card card--accent stack-2">
                      <h2 className="h3">{COURSE.dateLabel}之前，你可以先做一件事</h2>
                      <p style={{ margin: 0 }}>
                        想好你生意里最头疼的那一件事。那天上午，我们就从它开始：把它写成一张需求单，看看 AI 能帮你做掉多少。
                      </p>
                    </div>
                    <p className="body" style={{ margin: 0 }}>建议带上笔记本电脑，充好电；手机也带上。</p>
                    <details>
                      <summary className="body-sm">再看一下转账信息</summary>
                      <div className="stack-2" style={{ marginTop: "var(--space-3)" }}>
                        <p style={{ margin: 0 }}>转账金额：{COURSE.payLabel} · 转账备注：<strong className="mono">{order.ref}</strong></p>
                        {paymentInfo && <pre className="body" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{paymentInfo}</pre>}
                      </div>
                    </details>
                  </div>
                                ) : (
                  <>
                    <div className="card card--accent stack-3">
                      <p className="body-lg" style={{ margin: 0 }}>
                        转账金额：<strong>{COURSE.payLabel}</strong>
                      </p>
                      <p className="body-lg" style={{ margin: 0 }}>
                        转账备注填：<strong className="mono" style={{ fontSize: "1.4rem" }}>{order.ref}</strong>
                      </p>
                      {paymentInfo ? (
                        <pre className="body" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{paymentInfo}</pre>
                      ) : (
                        <p className="body" style={{ margin: 0 }}>
                          转账信息请私信 James 获取（<a href="/#contact">微信二维码</a>）。
                        </p>
                      )}
                    </div>
                    <form method="post" action="/api/course/claim">
                      <input type="hidden" name="ref" value={order.ref} />
                      <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>
                        我已经转账了
                      </button>
                    </form>
                    <p className="body">
                      转完点上面的按钮，再把截图发给 James 的微信（<a href="/#contact">James 的微信二维码在这里</a>），我们核对后会把你拉进学员群。这个页面可以截图保存，备注编号别填错。
                    </p>
                  </>
                )}

                <p className="body">
                  时间：{COURSE.dateLabel}，{COURSE.timeLabel}
                  <br />
                  地点：{COURSE.placeLabel}
                </p>
              </div>
            ) : (
              // ── Not signed up yet ─────────────────────────────────────
              <>
                <div className="stack-4">
                  <span className="eyebrow">§ 精品小班课 · {COURSE.dateLabel}</span>
                  <h1>{COURSE.title}</h1>
                  <p className="body-lg">
                    老板要的不是 AI，是用 AI 降本增效、获客成交。不讲空泛概念，带着你自己的生意来，4 小时边学边练，带走一个懂你生意的 AI 助理。
                  </p>
                </div>

                <div className="card card--accent stack-3">
                  <h2 className="h3">先看这门课适不适合你</h2>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                    <li><strong>适合谁</strong>：自己做生意的老板和创业者，房产、贷款、建筑装修、餐饮、门店、电商外贸、教育咨询都行。听过 AI、可能也用过，但生意还是老样子</li>
                    <li><strong>要什么基础</strong>：会用微信、会打字就够了。不用懂技术，不写代码</li>
                    <li><strong>解决什么问题</strong>：你生意里那件最费时间的事（回客人消息、写文案、整理资料、找客人），AI 到底能接多少、怎么接、接到什么程度算好</li>
                    <li><strong>不太适合谁</strong>：已经自己在做 AI 产品、写代码的朋友。这门课偏入门，周四局更适合你</li>
                  </ul>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">周四局的老板们报名时，问得最多的是这几件事</h2>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                    <li>AI 到底怎么和我的生意结合起来？</li>
                    <li>每天的杂事，能不能交给 AI，让我从小事里脱身？</li>
                    <li>客人从哪来？生意刚起步，怎么让客人相信我们？</li>
                    <li>能不能有一个 AI 客服，帮我回客人消息？</li>
                  </ul>
                  <p style={{ margin: 0 }}>这门课就是冲着这些问题来的。</p>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">举个例子：一位做装修的老板，这一上午做了什么</h2>
                  <p className="hint" style={{ margin: 0 }}>课上用的示范，不是真实客户。你带来的会是你自己的事。</p>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                    <li><strong>原来怎么做</strong>：客人在微信、小红书私信里问。白天在工地顾不上，晚上一条条回。「大概多少钱一平」「多久能完工」「有没有做过类似的」，这几句每天要回好几遍</li>
                    <li><strong>卡在哪</strong>：回慢了，客人转头就去问别家。想过请人帮着回，可新人不懂行，报错价更麻烦</li>
                    <li><strong>课上做成什么</strong>：一张需求单。要交给 AI 的事是回新客人的第一轮咨询；做到常见问题当天有回复、说法跟他本人一致就算好；要用的资料是价格区间、做过的案例和常见问答；具体报价、工期承诺和折扣必须他拍板，AI 只起草，不替他发</li>
                    <li><strong>回去用在哪</strong>：把常见问答和价格区间交给助理，客人的问题贴进去，它出草稿，他看一眼再发（客人的电话、地址不用贴）。想做成客人一来消息就自动回，拿着这张需求单去找人做，可以直接开工。写得清楚的，还有机会被挑中，我们免费做出来</li>
                  </ul>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">课程大纲：这四个小时，你亲手做什么</h2>
                  <ul className="stack-3" style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                    <li><strong>9:00　AI 能干什么、不能干什么</strong><br />把 AI 能接的活分成四类：搬运、归类、生成、拍板，哪些今天就能交，哪些不能交。你先在卡片上写下自己生意里最头疼的一件事</li>
                    <li><strong>9:40　装好你的 AI 助理</strong><br />现场装在你的电脑和手机上，告诉它你做什么生意、客人是谁，再用那件头疼的事问它。带走：它回答你生意问题的截图</li>
                    <li><strong>10:40　茶歇</strong></li>
                    <li><strong>11:00　写你的需求单</strong>（今天最重要的一段）<br />助理一格一格问你：哪件事、现在谁在做、每周花多久、做成什么样算好、用到哪些资料、值多少。带走：一张填好的需求单</li>
                    <li><strong>12:00　交给 AI 之前，先对一遍</strong><br />两个真实的翻车案，和四条线：拍板的事不交、对客人的承诺你本人看过再发、客人隐私先遮掉、数字人名日期对原件</li>
                    <li><strong>12:20　下课以后</strong><br />约好一对一咨询，讲清楚彩蛋怎么挑、会员有哪些权益</li>
                    <li><strong>12:40　答疑、合影，13:00 结束</strong></li>
                  </ul>
                </div>

                <div className="card card--accent stack-3">
                  <h2 className="h3">这门课和别的 AI 课有什么不一样</h2>
                  <p style={{ margin: 0 }}>
                    很多 AI 课是带你看 AI 能做什么、教你在对话框里打字。当场看着挺惊艳，回到店里，生意还是老样子。
                  </p>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                    <li><strong>从你的生意出发</strong>：带着你自己的事来，走的时候手上是一张能开工的需求单，不是一堆功能演示</li>
                    <li><strong>不是听完就散</strong>：课后有一对一专属咨询，大家的刚需我们挑出来免费做出来</li>
                    <li><strong>讲课的人自己用 AI 拿到了结果</strong>：零员工，一个人运营数十款面向海外市场的软件产品，用 AI 把软件生意做到了七位数年营收；开发、上线、获客到客服，大部分交给 AI 去跑。每周还和悉尼各行各业的老板聊 AI 怎么落地。是自己做生意的人来讲，不是只会讲工具的导师</li>
                  </ul>
                </div>

                <div className="stack-4">
                  <h2 className="h3">你会得到</h2>

                  <div className="card stack-2">
                    <h3 className="h3" style={{ fontSize: "1.15em" }}>1　一个懂你生意的私人 AI 助理</h3>
                    <p style={{ margin: 0 }}>
                      课上帮你装好，电脑和手机都能用。先告诉它你做什么生意、客人是谁、现在最头疼的事。
                    </p>
                    <p style={{ margin: 0 }}>
                      之后可以问它：这个月生意为什么差了？它不会马上给你一个答案，会先问你：是来的客人少了，每个客人买得少了，还是价格变了？一步步帮你找到原因。也可以问：我的客人主要从哪来？怎么让第一次来的客人信我？
                    </p>
                  </div>

                  <div className="card stack-2">
                    <h3 className="h3" style={{ fontSize: "1.15em" }}>2　一张需求单：把生意问题变成 AI 能接的任务</h3>
                    <p style={{ margin: 0 }}>
                      很多老板说「帮我弄个 AI」。这句话谁都没法开工，因为不知道要做什么。
                    </p>
                    <p style={{ margin: 0 }}>
                      课上你挑一件最想交给 AI 的事：回客人消息、写营销文案、把产品和报价整理成 AI 能查的资料、日常重复的杂事，都行。助理会一格一格问你：这件事现在谁在做？每周花多少时间？做成什么样算好？答完，就是一张需求单。以后不管找谁做 AI，都用得上。
                    </p>
                  </div>

                  <div className="card stack-2">
                    <h3 className="h3" style={{ fontSize: "1.15em" }}>3　限时一对一专属咨询（每人 15 分钟）</h3>
                    <p style={{ margin: 0 }}>
                      课后在线上，只有你和我。带着你的需求单，和用助理时卡住的地方来。你的生意、你的数据，别人听不到。
                    </p>
                    <p style={{ margin: 0 }}>需要提前预约，没约的不安排。</p>
                  </div>

                  <div className="card stack-2">
                    <h3 className="h3" style={{ fontSize: "1.15em" }}>4　彩蛋：你的刚需，我们免费做出来</h3>
                    <p style={{ margin: 0 }}>
                      课后我们会看每一张需求单，从中挑出大家的刚需，免费做成你生意里能直接用的 AI 工具，比如自动回客人消息的客服助手、帮你整理资料的小工具。做好交到你手上，教会你怎么用。
                    </p>
                    <p className="hint" style={{ margin: 0 }}>需求单写得越清楚，越容易被挑中。具体以实际评估为准。</p>
                  </div>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">要准备什么</h2>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                    <li>建议带上笔记本电脑，充好电；手机也带上</li>
                    <li>想好你生意里最头疼的一件事</li>
                    <li>想拿来练的客人聊天截图或单据可以带上，客人的姓名和电话先遮掉</li>
                  </ul>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">599 买的是什么，送的 365 又是什么</h2>
                  <p style={{ margin: 0 }}>
                    <strong>599 澳元 + GST</strong>：这一上午的课、课后 15 分钟一对一咨询，和彩蛋的机会。
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>另送一年 AI 创始人 IP 会员（价值 365 澳元）</strong>：这门课讲用 AI 理生意；会员讲用 AI 做自媒体、做内容获客，让更多人认识你。想用 AI 做内容、持续获客的，主要在会员里学。会员包括：
                  </p>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                    <li>全年不少于 6 场线下公开课，讲怎么用 AI 做自媒体内容、获客</li>
                    <li>会员专属线下活动和聚会</li>
                    <li>周四局会员专属留位</li>
                    <li>一年会员群：AI 资讯和答疑</li>
                    <li>知识星球资料库，一直在更新</li>
                    <li>会员专属 AI 智能体，一年使用权</li>
                  </ul>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">常见问题</h2>
                  <div className="stack-3">
                    <p style={{ margin: 0 }}><strong>我完全不懂 AI，能跟上吗？</strong><br />能。每一步都跟着做，卡住了举手，我们过来帮你。</p>
                    <p style={{ margin: 0 }}><strong>我主要想用 AI 做内容、获客，这门课管用吗？</strong><br />课上你可以把「做内容」这件事写成需求单，用助理把选题、文案这一步理清楚。系统地讲用 AI 做自媒体获客，是送你的一年会员里的公开课。两个加起来正好接上。</p>
                    <p style={{ margin: 0 }}><strong>要带电脑吗？</strong><br />建议带上笔记本电脑，课上操作更方便。实在没有，用手机也能跟。</p>
                    <p style={{ margin: 0 }}><strong>用中文上课吗？</strong><br />是，全程中文。</p>
                    <p style={{ margin: 0 }}><strong>我生意上的事，会被其他人听到吗？</strong><br />课上的练习在你自己的手机上做。具体的生意问题，留到一对一咨询里说，只有你和我。</p>
                  </div>
                </div>

                <p className="body-lg">
                  时间：{COURSE.dateLabel}，{COURSE.timeLabel}
                  <br />
                  地点：{COURSE.placeLabel}
                  <br />
                  费用：{COURSE.priceLabel}，银行转账
                  <br />
                  席位有限，报满即止
                </p>

                {error && <p className="alert" role="alert">{error}</p>}

                <p className="body" style={{ color: "var(--fg3)" }}>
                  已经报过名、找不到转账信息了？用同一个微信号再填一次，会显示你原来那条。
                </p>

                <form method="post" action="/api/course" className="stack-6">
                  {knownName ? (
                    <div className="stack-2">
                      <input type="hidden" name="self" value="1" />
                      <p className="body-lg" style={{ margin: 0 }}>
                        ✓ 已认出你：<strong>{knownName}</strong>，名字和微信号不用再填。
                      </p>
                      <a className="body" href="/class?other=1">不是我？帮别人报名点这里</a>
                    </div>
                  ) : (
                    <>
                      {loginHref && (
                        <div className="stack-3">
                          <a className="btn btn--wechat btn--block" href={loginHref}>
                            <WeChatMark />
                            报过周四局？用微信登录，不用再填
                          </a>
                          <p className="or-divider" style={{ margin: 0 }}>或者直接填写</p>
                        </div>
                      )}
                      <div>
                        <label className="label" htmlFor="class-name">名字</label>
                        <input className="field" id="class-name" name="name" required autoComplete="name" maxLength={60} />
                      </div>
                      <div>
                        <label className="label" htmlFor="class-wechat">微信号（或手机号）</label>
                        <input className="field" id="class-wechat" name="wechat" required autoCapitalize="off" autoCorrect="off" maxLength={60} />
                        <p className="hint">微信号在：微信 → 我 → 头像右边「微信号：」后面那串，不是昵称。不知道的话填手机号也行。</p>
                      </div>
                    </>
                  )}

                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="label">最想让 AI 帮你哪一块？（选填，可多选）</legend>
                    <div className="choice-group">
                      {BIZ_FOCUS_OPTIONS.map((option) => (
                        <label className="choice" key={option.value}>
                          <input type="checkbox" name="biz_focus" value={option.value} />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label className="label" htmlFor="class-industry">你在哪个行业？（选填）</label>
                    <select className="field" id="class-industry" name="industry" defaultValue="">
                      <option value="">（跳过）</option>
                      {INDUSTRY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor="class-note">你的生意里，具体哪件事最想交给 AI？（选填）</label>
                    <textarea className="field" id="class-note" name="note" maxLength={500} placeholder="比如：每天回客人微信太花时间；房源文案写不过来" />
                    <p className="hint">写得越具体，课上越能对着你的事讲。</p>
                  </div>

                  <div>
                    <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>
                      报名，看转账信息
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
