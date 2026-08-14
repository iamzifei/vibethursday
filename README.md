# Vibe Thursday

悉尼每周四上午的 AI 局，和它的网站。

一群在做东西的人围一张桌子喝咖啡，聊各自在用 AI 干什么、卡在哪。不是分享会，
没人讲课。这个仓库是它的站点：[vibethursday.com](https://vibethursday.com)

活动本身免费，不卖票，也没有会员费。

![vibethursday.com 首屏](.github/readme-hero.jpg)

---

## 这个站在做什么

它不是一个宣传页。四件事都是为了让线下那两个小时更好用：

| | |
| --- | --- |
| **报名** | 一张 30 秒填完的表。人数直接决定跟店里怎么订位子 |
| **成员墙** `/members` | 一人一张卡：在做什么、想找什么、能帮什么。**来之前先知道该找谁聊**，比到现场花半小时试探快得多。报名时勾一下就能上墙 |
| **手机桌牌** `/badge` | 全屏显示名字和一句话，手机往桌上一放当名牌。不用印、不用笔 |
| **开销说明** `/support` | 场地不是免费的。这一页说清楚这件事，给一个自愿分摊的入口，不分摊照样来 |

## 它没有什么

- **没有报名数据。** 数据库不在这个仓库里，`.env` 也从没进过版本控制
- **能不用客户端 JS 的地方都没用。** 相册的堆叠和展开是 `<details>`，没有一行脚本；
  报名表是个 client component（要做 Turnstile 和「这个浏览器来过」的记忆），其余页面
  基本是静态渲染的 HTML
- **没有 webfont。** 全系统字体栈，中文优先，省掉一次字体加载抖动
- **没有第三方统计、没有 cookie 横幅**

## 技术栈

Next.js 16（App Router）· React 19 · Postgres（`pg`，不用 ORM）· Tailwind v4 ·
Cloudflare Turnstile · 部署在 Zeabur。

测试用 Node 内置 runner，零新依赖。

## 本地跑起来

```bash
pnpm install
cp .env.example .env.local   # 按里面的注释填
pnpm dev
```

`.env.example` 里给的 Turnstile 是 Cloudflare 官方的测试密钥对，本地直接能用。
数据库随便一个本地 Postgres 就行，表结构在首次请求时自动建（`src/lib/db.ts`
的 `ensureSchema`）。

```bash
pnpm test    # 单元测试
pnpm lint
pnpm build
```

## 目录

```
src/app/          页面与 API 路由
src/lib/          content.ts（全站中英文案）· db.ts · sessions.ts · members.ts
src/components/   报名表、成员卡、桌牌、认领表单
scripts/          图片管线、图标生成、端到端脚本
tests/            单元测试
```

**改文案去 `src/lib/content.ts`。** 全站中英两份都在那一个文件里，页面本身不写死
任何一句人话。

**加一场活动的照片**：

```bash
node --experimental-strip-types scripts/build-photos.mts \
  --in "/path/to/照片目录" --session 03
```

它出三档宽度、两种格式，顺手清掉 EXIF（手机照片带 GPS 和机器序列号），
最后打印一段可以贴进 `content.ts` 的代码。

## 几个刻意的决定

- **成员墙按最近出席排序，永远不按点赞。** 卡片是「我是谁、我需要什么」，
  不是排行榜
- **照片里认得出的人脸都遮掉。** 遮不掉又非放不可的，就不放
- **`/badge` 和成员墙都不要求登录去看。** 墙同时是招募页，加一道登录就废了一半
- **报名表是全站最脆的面。** 加字段前先想清楚，它每多一栏就少一批人填完

## 关于钱

这个局免费，但场地不是。每周会有最低消费或者场地费，目前先垫着。
想一起分摊的话有个入口，不分摊照样来，也没人会知道谁给了谁没给。

<a href="https://ko-fi.com/vibethursday" target="_blank">
  <img height="40" src="https://storage.ko-fi.com/cdn/kofi3.png?v=6" alt="在 Ko-fi 上分摊一点场地开销">
</a>

## In English, briefly

Vibe Thursday is a weekly Thursday-morning meetup in Sydney for people building
things with AI. It runs in Mandarin. This repo is its website — Next.js and
Postgres, no client-side JS where it can be avoided, no analytics, no tracking.
The code is MIT; the photos in `public/photos/` are not, since they are of real
attendees. The site itself is bilingual: [vibethursday.com](https://vibethursday.com)
and [?lang=en](https://vibethursday.com/?lang=en).

## 用它办你自己的局

代码随便拿去用。真要开一个的话，比代码有用的是这几条：

1. **时间雷打不动。** 一旦「这周有没有」需要问一句，它就开始死了
2. **只来两个人也照办**
3. **别让所有人挨个自我介绍。** 三十个人轮一圈半小时就没了，而且没有人记得住
   三十个人。目标不是让所有人互相认识，是让每个人碰上三五个对的人
4. **明说「走开不用打招呼」。** 不说这句，看两眼不感兴趣的人只能干坐着

## 协议

**代码是 MIT**，随便拿去用。

**`public/photos/` 里的照片不在授权范围内。** 那是真实参与者，虽然认得出的
人脸都遮掉了，但把它们连同代码一起授权出去，等于替这些人做了一个他们没同意
过的决定。要 fork 的话把那个目录换成你自己的照片。

同理，`Vibe Thursday` 这个名字和 logo 也请换掉——不是因为舍不得，是因为
两个同名的局会让想来的人走错地方。
