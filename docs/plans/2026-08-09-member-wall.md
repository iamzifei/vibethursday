# 成员墙（Member Wall）实施计划

设计依据：`/Users/james/Dev/vibethursday/docs/design/2026-08-09-member-wall-and-paid-qa.md`
开工日期：2026-08-09　状态：进行中

## 目标

把散在微信群里的成员信息（产品 / 业务 / 自媒体 / 社群 / LinkedIn / 只想旁听）沉淀成一面
可分享的成员墙。**一人一张卡，卡上挂 0..N 个资源**，产品只是资源的一种。

## 落地时与设计文档的三处偏差（已决定）

| 设计文档写的 | 实际做的 | 为什么 |
| --- | --- | --- |
| 可见性三档：公开 / 仅成员 / 隐藏 | **两档：公开 / 隐藏** | 「仅成员可见」要求整面墙先登录才能看，与「墙同时是招募页、必须公开」直接冲突。三档里中间那档没有真实用途 |
| 认领走 email magic link | **认领走「姓名 + 微信号/邮箱」自助匹配** | 这个仓库里**没有任何发信设施**（无 SMTP、无 SendGrid、无 lark-cli 调用）。上 magic link 等于先接一套发信基建。而且只有约三分之一的人留了邮箱，主渠道是微信 |
| 第一版含图片（贴外链） | **第一版无图** | 现有站点通篇没有产品截图，卡片是排版驱动的。加图会引出图床/热链/审核三个新问题，不值得 |

认领的安全性是**刻意的软校验**：知道某人姓名 + 微信号的人可以改他的卡片。
代价上限是「一张公开名片被改」，James 可从 `/admin` 把那张卡撤下来；对一个三十人的线下社群，
这个强度是相称的。真出问题再上一次性链接。

## 阶段

- [x] P0 — 读现有代码，确认约定（copy 全在 `content.ts`、无 ORM、`ensureSchema` 自建表）
- [x] P1 — 数据层：`members` / `member_assets` 两张表 + 查询函数（`src/lib/db.ts`）
- [x] P2 — 领域层：`src/lib/members.ts`（类型/枚举/校验）、`src/lib/member-auth.ts`（签名 cookie）
- [x] P3 — 文案：`content.ts` 补 `members` / `claim` / `editor` / `membersTeaser`，中英并排
- [x] P4 — 接口：`/api/claim`、`/api/me`
- [x] P5 — 页面：`/members`（墙）、`/members/[slug]`（详情）、`/claim`、`/me`
- [x] P6 — 样式 + 首页入口 + README
- [x] P7 — 部署到 Zeabur（2026-08-09，`zeabur deploy --service-id 6a704d6bfefeb46a8834b625`），`MEMBER_SECRET` 已设
- [ ] P8 — 群里发认领链接（见 HUMAN QUEUE）

## 生产验证（2026-08-09，vibethursday.com，全部实测）

| 检查 | 结果 |
| --- | --- |
| `/members` `/members?lang=en` `/claim` `/claim?lang=en` `/` | ✅ 200 |
| `/members` 显示「还没有人认领名片」 | ✅ 说明两张表已在生产库建好，且**没有测试数据** |
| `/members/nope` | ✅ 404 |
| `/me` 无 cookie | ✅ 307 → `/claim` |
| `/me` 伪造 cookie | ✅ 307 → `/claim`（不是 500，说明 `MEMBER_SECRET` 读得到且签名校验在工作） |
| `/admin?key=…` | ✅ 200；无 key 仍然拒绝 |
| 首页成员板块 | ✅ 已上 |

> 生产验证刻意全部只读——生产库里是真实报名数据，不在上面造测试行。
> 端到端的写入路径（认领→编辑→发布）在本地一次性 Postgres 上已跑通，见上一节。

## 🔴 顺带修掉的一个既有 bug：老成员报第二场会 500

**发现于 2026-08-09**，在回答「第一场来过的人能不能报第二场」时实测出来的。**不是成员墙引入的，是原有代码。**

**症状**：第一次报名**只填了微信号没填邮箱**的人，第二次把邮箱也填上 → HTTP 500，
提示「提交失败了」，**那一场根本没记上，而且每次重试都是 500，永久卡死**。
唯一绕过方式是把邮箱留空。中文表邮箱是选填，第一场二十多人绝大多数走中文表，命中面不小。
而且这个失败**对组织者不可见**——`/admin` 不会多一行也不会少一行，丢单是静默的。

**根因**（服务端日志实测：`duplicate key value violates unique constraint "signups_wechat_lower_idx"`）：
旧的 `saveSignup` 按「**本次提交有没有邮箱**」来选 `ON CONFLICT` 目标：

```ts
const conflictColumn = input.email ? "lower(email)" : "lower(wechat)";
```

这次填了邮箱 → 冲突目标选 email；但库里那行 email 是 NULL，冲突不上 →
Postgres 走 INSERT → 撞上微信号的唯一索引 → 23505 → 500。
它只看了提交，没看库里已有的那行。Postgres 本身无法表达
「冲突在这两列里非空的那一个上」，所以这个选择必须在代码里做——旧代码做错了。

**修法**：改成「先按 邮箱 OR 微信号 查已有行 → 查到按 id UPDATE，查不到才 INSERT」。
另外处理邮箱和微信号**分别命中两条不同行**的情况（历史遗留重复行）：
更新较早那行、**不写**那个会撞索引的字段，而不是抛 500。

**修复后的完整矩阵（本地一次性库，全部 200）**：

| 情形 | 结果 |
| --- | --- |
| A 只填微信 ×2（大小写不同） | ✅ sessions 累加，不产生第二行 |
| B **先只微信、后补邮箱**（原 500） | ✅ 200，邮箱补上，两场都在 |
| C 先邮箱、后补微信 | ✅ |
| D 先邮箱+微信、后只填微信 | ✅ 邮箱没被清掉 |
| E 邮箱和微信各命中一条历史重复行 | ✅ 200，新场次记在较早那行，另一行不动 |

复现/验证用 `./scripts/smoke-db.sh start`（一次性 Postgres + 生产构建，跑完 `stop` 删数据目录）。
**生产上没有验证这条写入路径**——线上库里是真实报名数据，不在上面造行。
生产只做了只读检查（见上一节），写入行为的证据来自本地同一份构建。

## 部署方式（git push 不会触发部署，别搞混）

代码托管在 `git@github.com:iamzifei/vibethursday.git`（private，2026-08-10 建）。
**但 Zeabur 不是从 GitHub 拉的**——它是 CLI 本地上传，所以 push 完还得单独部署：

```bash
zeabur deploy --service-id 6a704d6bfefeb46a8834b625 -i=false
```

project `vibethursday` = `6a70489bfefeb46a8834b342`（Tencent Singapore），
service `web` = `6a704d6bfefeb46a8834b625`，另有 `postgresql` service。
上线大约要等 4 分钟，`curl` 轮询 `/members` 到 200 为准。

## 冒烟测试结果（2026-08-09，本地一次性 Postgres 17，全部实测通过）

| 用例 | 结果 |
| --- | --- |
| 报名 → 认领（姓名+微信号，大小写不敏感） | ✅ 200，草稿卡自动生成 |
| 草稿由 `building` / `topic` 预填 | ✅ `/me` 页面渲染出报名时写的原文 |
| 认领联系方式不对 | ✅ 404 |
| 未登录访问 `/api/me` | ✅ 401；`/me` → 307 跳 `/claim` |
| 已登录访问 `/claim` | ✅ 307 跳 `/me` |
| 主页地址冲突 | ✅ 409，文案提示换一个 |
| `javascript:alert(1)` 链接 | ✅ 被丢弃（存成 NULL） |
| 裸域名 `xiaohongshu.com/user/1` | ✅ 升级成 `https://` |
| 非法 role / kind、空标题资源 | ✅ 静默丢弃 |
| 标签大小写去重 + 上限 6 | ✅ `ai agent` 被去重，截到 6 个 |
| 资源上限 8 | ✅ 12 条截到 8 条 |
| 无链接 + `stage=local` 的产品 | ✅ 卡片完整渲染，显示「🔧 本地跑通」，不出链接按钮 |
| 零资源会员卡（旁听者） | ✅ 卡片完整 |
| 「本周四会来」分组 | ✅ 按 `signups.sessions` 正确分出 8月13日 那一组 |
| 中英两个视图 | ✅ 均完整，英文计数用了单复数安全措辞 |
| `pnpm build` / `tsc --noEmit` | ✅ 全过 |
| `pnpm lint` | ⚠️ 3 个问题（2 error 1 warning）**全部是既有的**，在 `SignupForm.tsx` / `Turnstile.tsx` / `page.tsx` 的 `<img>`；已用 `git stash` 在干净树上复现确认。新增文件 0 问题 |

## 验收标准

1. `pnpm build` 与 `pnpm lint` 全过
2. 未认领时 `/me` 跳 `/claim`；认领后 `/me` 的字段**已用报名时填的 `building` / `topic` 预填**
3. 未发布（草稿）的成员不出现在 `/members`
4. `/members` 首屏是「本周四会来的人」，其余按最近出席倒序
5. 无资源的会员卡渲染完整（旁听者场景）
6. 产品资源没有链接时不渲染链接按钮，卡片仍完整（本地 demo 场景）
7. `signups.wechat` / `signups.email` 在任何公开页面都不出现
8. 中英两个语言视图都完整

## HUMAN QUEUE

- [ ] 部署后在群里发一条 `https://vibethursday.com/claim`，配一句
      「填过报名表的直接用姓名+微信号认领，资料已经帮你预填好了，改两个字就能发布」
- [ ] 决定 `MEMBER_SECRET` 是否单独设（不设就复用 `ADMIN_TOKEN`，见 README）
- [ ] 现场把 `/members` 投出来，60 秒自我介绍时打开对应卡片

## 已关闭的决策

- **Cloudflare 橙云：试过了，无效，已回滚**（2026-08-09）。
  Zeabur 的 `zeabur domain dns update --proxied` 能直接开关（zone 在 Zeabur 的 CF 账号里，
  但这个 flag 透出来了）。开启后功能全部正常：无重定向循环、证书换成 CF 的
  Google Trust Services、静态资源 `cf-cache-status` 二次请求命中 HIT。
  **但性能没有任何可测量的改善**：交替采样各 6 次，经 CF 中位 ~457ms，直连源站 ~449ms。
  **根因**：两个 CF anycast IP 的 `cf-ray` 尾缀都是 **SIN**——免费套餐把澳洲流量路由到
  新加坡节点，而源站也在新加坡。请求变成「悉尼 → 新加坡(CF) → 新加坡(源站)」，
  多一跳，没缩短任何距离。
  ⚠️ **之前预测「TTFB 480ms → 250–350ms」是推断，而且是错的**，错在假设 CF 会在悉尼
  终止 TLS。这个假设从未验证过，`cf-ray` 一看就推翻了。
  真要压 TTFB 只剩一条路：**把源站挪到澳洲**。其余（付费套餐 / Argo）不确定且要花钱。
  现状 450ms 对一个报名表 + 一面墙是可接受的，不建议为此迁移。
- 付费问答（仿 new.web.cafe/ask）**不做**。三个月后按设计文档 3.3 的三个信号复评。
- **认领强度维持现状**（2026-08-09 James 决定）。已知并接受的风险：知道某人**报名时的姓名 + 微信号/邮箱**的人可以认领并编辑那张卡；第二个认领者拿到的是**同一张卡的编辑权**（`claimMember` 的 `ON CONFLICT (signup_id)` 会返回同一个 member id），两人都能改。
  接受的理由：墙上没有钱、没有私信、没有声望分，破坏是可见且可从 `/admin` 撤下来的。
  > ⚠️ **2026-08-10 订正**：上面那句「可从 /admin 回滚」在写下时是**假的**——
  > `/admin` 当时只列报名，代码里完全不认识 member，真出事只能开 psql。
  > 已补上成员卡片表和「隐藏 / 放回」按钮（`/api/admin/member`），这句话现在才成立。
  > **在长期文档里写下未经核实的补救措施，比没有补救措施更糟：
  > 它让一个被明知接受的风险看起来是有兜底的。**
  **升级路径已想清楚，不改数据模型**：`signups` 加一列 `claim_code`（随机 8 位），`/admin` 每行带复制按钮，`/claim` 改成只认码。约 30 分钟。真出事再做。
  一个次要缓冲（是运气不是设计）：比对的是 `signups.name`，不是墙上的展示名——改过展示名的人，那个「口令」就不再是公开信息。
