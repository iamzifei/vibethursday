import RPCClient from "@alicloud/pop-core";
import OSS from "ali-oss";

/**
 * Alibaba Cloud, for recorded lessons (2026-10-28): video on demand (VOD) for
 * the lessons themselves, object storage (OSS) for their handouts.
 *
 * Why Alibaba Cloud: the same video has to play smoothly both in Australia
 * and in mainland China, and one upload served from a CDN with nodes in both
 * is the only setup that does that without keeping two copies in sync.
 *
 * Every credential comes from the environment and none of it reaches the
 * browser. What the browser gets is short-lived: a play authorisation that
 * expires, and a signed handout link that expires.
 *
 * - LEARN_ALIYUN_ACCESS_KEY_ID / LEARN_ALIYUN_ACCESS_KEY_SECRET — a RAM user
 *   allowed VOD and the one handout bucket, and nothing else
 * - LEARN_VOD_REGION — where the videos are stored, e.g. cn-shanghai
 * - LEARN_OSS_REGION / LEARN_OSS_BUCKET — the private handout bucket
 */

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Whether VOD is set up for this deployment. Off means lessons show "coming soon" instead of a player. */
export function vodConfigured(): boolean {
  return Boolean(env("LEARN_ALIYUN_ACCESS_KEY_ID") && env("LEARN_ALIYUN_ACCESS_KEY_SECRET") && env("LEARN_VOD_REGION"));
}

export function ossConfigured(): boolean {
  return Boolean(env("LEARN_ALIYUN_ACCESS_KEY_ID") && env("LEARN_ALIYUN_ACCESS_KEY_SECRET") && env("LEARN_OSS_REGION") && env("LEARN_OSS_BUCKET"));
}

function vodClient(): RPCClient {
  return new RPCClient({
    accessKeyId: env("LEARN_ALIYUN_ACCESS_KEY_ID")!,
    accessKeySecret: env("LEARN_ALIYUN_ACCESS_KEY_SECRET")!,
    endpoint: `https://vod.${env("LEARN_VOD_REGION")}.aliyuncs.com`,
    apiVersion: "2017-03-21",
  });
}

/** VOD calls are quick; a stuck one must not hold a page. */
const VOD_TIMEOUT_MS = 8_000;

/** How long a play authorisation lasts, in seconds. Long enough to sit through a two-hour lesson. */
const PLAY_AUTH_TTL_S = 3 * 60 * 60;

/**
 * A play authorisation for one video: what the player needs to fetch it. It
 * names a single video and expires, so passing it on lets someone else watch
 * that one lesson for a few hours at most.
 */
export async function videoPlayAuth(videoId: string): Promise<{ playAuth: string; durationS: number | null; cover: string | null }> {
  const result = await vodClient().request<{
    PlayAuth: string;
    VideoMeta?: { Duration?: number; CoverURL?: string };
  }>("GetVideoPlayAuth", { VideoId: videoId, AuthInfoTimeout: PLAY_AUTH_TTL_S }, { method: "POST", timeout: VOD_TIMEOUT_MS });
  return {
    playAuth: result.PlayAuth,
    durationS: result.VideoMeta?.Duration ? Math.round(result.VideoMeta.Duration) : null,
    cover: result.VideoMeta?.CoverURL ?? null,
  };
}

/** A video's title, length and state, for the admin page to confirm an id is right. */
export async function videoInfo(videoId: string): Promise<{ title: string; durationS: number | null; status: string }> {
  const result = await vodClient().request<{ Video: { Title: string; Duration?: number; Status: string } }>(
    "GetVideoInfo",
    { VideoId: videoId },
    { method: "POST", timeout: VOD_TIMEOUT_MS },
  );
  return {
    title: result.Video.Title,
    durationS: result.Video.Duration ? Math.round(result.Video.Duration) : null,
    status: result.Video.Status,
  };
}

function ossClient(): OSS {
  return new OSS({
    accessKeyId: env("LEARN_ALIYUN_ACCESS_KEY_ID")!,
    accessKeySecret: env("LEARN_ALIYUN_ACCESS_KEY_SECRET")!,
    region: `oss-${env("LEARN_OSS_REGION")}`,
    bucket: env("LEARN_OSS_BUCKET")!,
    secure: true,
    timeout: 120_000,
  });
}

/** Stores a handout. The bucket is private: nothing in it can be fetched without a signed link. */
export async function putHandout(key: string, body: Buffer, contentType: string): Promise<void> {
  await ossClient().put(key, body, { headers: { "Content-Type": contentType } });
}

export async function deleteHandout(key: string): Promise<void> {
  await ossClient().delete(key);
}

/** How long a handout link works. Enough to start the download, not enough to be worth sharing. */
const HANDOUT_LINK_TTL_S = 10 * 60;

/** A link that downloads one handout, under a readable file name, for ten minutes. */
export function handoutLink(key: string, fileName: string): string {
  return ossClient().signatureUrl(key, {
    expires: HANDOUT_LINK_TTL_S,
    response: { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}` },
  });
}
