/**
 * Words on the /learn pages (2026-10-28), in the two languages the site uses.
 * Kept apart from content.ts, which is already the site's largest file.
 */

export type LearnLang = "zh" | "en";

export function learnLang(value: string | null | undefined): LearnLang {
  return value === "en" ? "en" : "zh";
}

export const LEARN_COPY = {
  zh: {
    title: "录播课",
    eyebrow: "Vibe Thursday · 录播课",
    login: {
      title: "登录看录播课",
      lead: "录播课只对学员开放。用微信或邮箱登录，第一次登录后等主理人通过即可观看。",
      wechatInApp: "用微信登录",
      wechatScan: "用手机微信扫码，在微信里打开",
      wechatScanHint: "扫码后在微信里直接观看，不用再登录。",
      orEmail: "或者用邮箱登录",
      email: "邮箱",
      send: "发送验证码",
      code: "验证码",
      codeHint: "验证码已发到你的邮箱，10 分钟内有效。没收到的话看看垃圾邮件。",
      verify: "登录",
      resend: "换个邮箱 / 重新发送",
      errors: {
        email: "邮箱格式不对。",
        rate: "操作太频繁了，过一会儿再试。",
        send: "邮件没发出去，稍后再试，或者改用微信登录。",
        code: "验证码不对，再看一眼邮件。",
        expired: "验证码过期了，重新发一个吧。",
        locked: "错误次数太多，这个验证码已失效，请重新发送。",
        off: "邮箱登录暂未开放，请用微信登录。",
      } as Record<string, string>,
    },
    pending: {
      title: "等主理人通过",
      lead: "你已经登录，但还不在学员名单里。留下名字，主理人认出你之后就会开通。",
      done: "已提交。通过后刷新这个页面就能看了。",
      name: "你的名字（主理人能认出来的）",
      note: "备注（选填，比如你在哪个群、哪天上的课）",
      submit: "提交",
    },
    revoked: { title: "暂时不能观看", lead: "你的观看权限已被关闭。有疑问请联系主理人。" },
    list: { lead: "按顺序看就行。每节课下面有教案下载和留言区。", empty: "课程还在上传，稍后再来。", signOut: "退出登录" },
    lesson: {
      back: "← 全部课程",
      handouts: "教案和资料",
      noHandouts: "这节课没有附件。",
      comments: "留言",
      noComments: "还没有留言，来说第一句。",
      write: "写下你的问题或心得",
      post: "发表",
      reply: "回复",
      replyTo: "回复",
      host: "主理人",
      someone: "学员",
      videoComing: "视频还在处理中，稍后再来。",
      videoError: "视频加载失败，刷新页面再试一次。",
      chapters: "章节",
    },
  },
  en: {
    title: "Recorded lessons",
    eyebrow: "Vibe Thursday · Lessons",
    login: {
      title: "Sign in to watch",
      lead: "Lessons are for members only. Sign in with WeChat or email; the first time, the host lets you in.",
      wechatInApp: "Sign in with WeChat",
      wechatScan: "Scan with WeChat to open it there",
      wechatScanHint: "Watch right inside WeChat — no separate sign-in.",
      orEmail: "Or sign in with email",
      email: "Email",
      send: "Send me a code",
      code: "Code",
      codeHint: "We emailed you a code. It works for 10 minutes — check spam if it is not there.",
      verify: "Sign in",
      resend: "Different email / send again",
      errors: {
        email: "That does not look like an email address.",
        rate: "Too many tries. Wait a little and try again.",
        send: "The email did not go out. Try again shortly, or use WeChat.",
        code: "That code is not right — check the email again.",
        expired: "The code has expired. Send a new one.",
        locked: "Too many wrong tries. Send a new code.",
        off: "Email sign-in is not available yet. Please use WeChat.",
      } as Record<string, string>,
    },
    pending: {
      title: "Waiting for the host",
      lead: "You are signed in but not on the list yet. Leave your name so the host knows who you are.",
      done: "Sent. Once you are let in, refresh this page.",
      name: "Your name (one the host will recognise)",
      note: "Note (optional — which group, which class)",
      submit: "Send",
    },
    revoked: { title: "Not available", lead: "Your access has been turned off. Contact the host if this is a mistake." },
    list: { lead: "Watch in order. Each lesson has its handouts and comments underneath.", empty: "Lessons are still uploading. Check back soon.", signOut: "Sign out" },
    lesson: {
      back: "← All lessons",
      handouts: "Handouts",
      noHandouts: "No handouts for this lesson.",
      comments: "Comments",
      noComments: "No comments yet. Start the conversation.",
      write: "Your question or takeaway",
      post: "Post",
      reply: "Reply",
      replyTo: "Reply to",
      host: "Host",
      someone: "Member",
      videoComing: "The video is still processing. Check back soon.",
      videoError: "The video did not load. Refresh to try again.",
      chapters: "Chapters",
    },
  },
} as const;
