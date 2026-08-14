<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Half of this project lives in another directory

This repo is only the **website**. Everything about how the meetup is actually run
— session plans, per-session retros, and all commercialisation judgements — lives in
`/Users/james/Dev/sydney-meetup/docs/`.

**Read `/Users/james/Dev/sydney-meetup/docs/商业化/README.md` before proposing anything
involving money**: pricing, tickets, membership, sponsorship, donations, equipment
spend, or venue terms. It carries a "已关闭的决策（不要重开）" table. Proposals have
already been made here that reopened decisions closed in that table, purely because
only this directory was read.

The two directories are named differently (`vibethursday` vs `sydney-meetup`), so
nothing about this repo hints that the other one exists. That is the trap.

# 这个仓库是公开的

`github.com/iamzifei/vibethursday` 是 public。**提交历史和 issue 一起公开，而且
删不掉**——fork、镜像、GitHub 的事件 API 都会留下副本。所以下面这几类东西，
**写进 commit message 就等于发布**：

| 不要写 | 改成 |
| --- | --- |
| **具体金额**：场地预付、最低消费、当天消费、任何澳元数字 | 区间或定性（「一两百澳元」「场地预付是固定的」）。站上 `/support` 就是刻意只给区间不给数字，仓库不能反过来把数字漏出去 |
| **参会者的姓名、微信号、邮箱** | 不提；确实要指代就说「某位参与者」 |
| **报名/到场的绝对人数**，以及由它反算得出的比例 | 说比例或量级（「约四分之一的人在墙上」），不说「56 人里 14 张卡」 |
| **群里的聊天原文** | 转述要点，不引原话 |
| 场地方的联系人、谈判过程与条件 | 不提 |

**为什么值得专门写一条**：这些信息不会触发任何检查——没有 lint、没有测试、
没有 secret scanner 会拦它。等到发现的时候，它已经在别人的 fork 里了。
2026-08-14 开源之前，仓库里有 9 条提交的 message 需要改写，就是因为写的时候
它还是私有的。

**判断标准一句话**：**这句话你愿意贴在活动主页上吗？** 不愿意，就不要写进
commit message。

（活动本身的判断、复盘、商业化推理，本来就属于 `~/Dev/sydney-meetup/docs/`，
不要放进这个仓库——见本文开头。那个目录不是 git 仓库，也不该是。）
