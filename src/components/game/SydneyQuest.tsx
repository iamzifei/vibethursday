"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import harbourMap from "@/lib/game/maps/harbour.json";
import chatswoodMap from "@/lib/game/maps/chatswood.json";
import { fill, pickMeme, type GameCopy } from "@/lib/game/copy";
import { DEFAULT_LOOK, EMOTES, LOOK_RANGES, PETS, PHRASES, isPhrase, type Dir, type Emote, type Look, type PeerView } from "@/lib/game/protocol";
import {
  HATS,
  IDEAS,
  SAVE_KEY,
  TOTALS,
  addCritter,
  addTo,
  bumpDaily,
  currentQuest,
  dailyProgress,
  readyToFinish,
  sideProgress,
  SIDE_QUESTS,
  type DailyKind,
  type SideId,
  newSave,
  parseSave,
  questProgress,
  sydneyDay,
  touchStreak,
  unlockedHats,
  type IdeaKind,
  type QuestId,
  type SaveState,
} from "@/lib/game/state";
import { CRITTERS, LANDMARKS, SHARDS, SPAWN, isSydneyThursday, place, type CritterId, type GameMap, type MapId, type StoryNpcId } from "@/lib/game/world";
import type { Lang } from "@/lib/lang";
import { LANG_PARAM } from "@/lib/lang";
import { characterSprite, critterSprite, ferrySprite } from "./art";
import { Engine, type Community, type Interaction, type Locate } from "./engine";
import { Music, type Track } from "./music";
import { Net, type NetStatus } from "./net";
import { TrainRide } from "./TrainRide";
import { Icon } from "./Icon";
import type { IconName } from "./icons";
import { drawPostcard, drawPoster, type SceneId } from "./poster";

const MAPS: Record<MapId, GameMap> = {
  harbour: harbourMap as GameMap,
  chatswood: chatswoodMap as GameMap,
};

type Props = { copy: GameCopy; lang: Lang; community: Community; qr: string; site: string };

type Choice = { label: string; run: () => void };
type LinkOut = { label: string; href: string; external?: boolean };
type Dialog = {
  speaker: string;
  pages: string[];
  index: number;
  choices?: Choice[];
  links?: LinkOut[];
  onDone?: () => void;
  /** A member's photo, when a real person is talking. */
  avatar?: string | null;
};

type Overlay =
  | { type: "dialog"; dialog: Dialog }
  | { type: "quests" }
  | { type: "bag" }
  | { type: "wardrobe" }
  | { type: "emotes" }
  | { type: "member"; index: number }
  | { type: "stall"; index: number }
  | { type: "board" }
  | { type: "befriend"; id: CritterId }
  | { type: "train"; north: boolean }
  | { type: "ferry"; to: "milsons" | "quay" }
  | { type: "peer"; peer: PeerView }
  | { type: "postcard"; url: string; caption: string }
  | { type: "share" }
  | { type: "intro" }
  | { type: "guide" }
  | { type: "menu" }
  | { type: "help" };

/** What the quest guide is following: the story, or one side quest. */
type Tracked = "main" | SideId;

type Toast = { id: number; text: string };

function withLang(href: string, lang: Lang) {
  const param = LANG_PARAM[lang];
  if (!param) return href;
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}lang=${param}${hash ? `#${hash}` : ""}`;
}

function spawnSave(): SaveState {
  const at = place(MAPS.harbour, SPAWN.harbour.lat, SPAWN.harbour.lon);
  return newSave("harbour", at.x, at.y);
}

/**
 * /play's React layer: everything that is a decision, a word or a button.
 *
 * The engine walks and draws; this decides what talking to somebody means,
 * keeps the save, runs the story, and draws the HUD and every panel on top of
 * the canvas. The canvas is never asked to render text longer than a name.
 */
export function SydneyQuest({ copy, lang, community, qr, site }: Props) {
  const [phase, setPhase] = useState<"title" | "create" | "play">("title");
  const [save, setSave] = useState<SaveState>(spawnSave);
  const [hasSave, setHasSave] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [prompt, setPrompt] = useState<Interaction | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [status, setStatus] = useState<NetStatus>("connecting");
  const [peerCount, setPeerCount] = useState(0);
  const [where, setWhere] = useState<string | null>(null);
  const [me, setMe] = useState<{ name: string | null; slug: string | null; guest: [number, number] | null } | null>(null);
  const [tracked, setTracked] = useState<Tracked>("main");
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  const [banner, setBanner] = useState<string | null>(null);
  const [musicOn, setMusicOn] = useState(true);
  const musicRef = useRef<Music | null>(null);
  const lastWaveAt = useRef(0);
  const highFived = useRef(new Map<string, number>());
  const greetedWalkers = useRef(new Set<string>());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const netRef = useRef<Net | null>(null);
  const saveRef = useRef(save);
  const peersRef = useRef<PeerView[]>([]);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const counts = useMemo(
    () => ({
      members: community.members.length,
      // The market always has one more stall than there are works — the empty
      // one at the end — and an empty noticeboard shows its examples.
      stalls: community.works.length + 1,
      questions: community.questions.length || copy.npc.noticeboard.examples.length,
    }),
    [community, copy],
  );
  const progress = useMemo(() => questProgress(save, counts), [save, counts]);
  const current = currentQuest(progress);
  const hats = useMemo(() => unlockedHats(save, progress), [save, progress]);
  const sides = useMemo(() => sideProgress(save, counts), [save, counts]);
  const [today] = useState(() => sydneyDay(new Date()));
  const dailies = useMemo(() => dailyProgress(save, today, counts), [save, today, counts]);

  /** Counts one more of a daily kind, announcing a finished task. */
  const daily = useCallback(
    (kind: DailyKind, landmark?: string) => {
      setSave((prev) => {
        const next = bumpDaily(prev, kind, today, counts, landmark);
        return next;
      });
    },
    [today, counts],
  );

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { id, text }]);
    setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 3200);
  }, []);

  const update = useCallback((change: (save: SaveState) => SaveState) => {
    setSave((prev) => change(prev));
  }, []);

  /* ── Load and persist ──────────────────────────────────────────── */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = parseSave(raw, spawnSave());
        // Reading the save once on mount is the one legitimate place for a
        // state update in an effect: localStorage does not exist on the server.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSave(parsed);
        setHasSave(true);
      }
    } catch {
      // Private mode or blocked storage: play without saving.
    }
  }, []);

  useEffect(() => {
    if (phase !== "play") return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch {
        // Nothing to do; progress for this session still stands.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [save, phase]);

  /* ── Quest and unlock announcements ───────────────────────────── */

  const seenDone = useRef<Set<QuestId> | null>(null);
  const seenHats = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (phase !== "play") return;
    const done = new Set(progress.filter((quest) => quest.done).map((quest) => quest.id));
    if (seenDone.current) {
      for (const id of done) if (!seenDone.current.has(id)) toast(fill(copy.toast.quest, { name: copy.quests[id].title }));
    }
    seenDone.current = done;
    const hatSet = new Set<string>(hats);
    if (seenHats.current) {
      for (const hat of hatSet) if (!seenHats.current.has(hat)) toast(fill(copy.toast.hat, { name: copy.wardrobe.hats[hat as (typeof HATS)[number]] }));
    }
    seenHats.current = hatSet;
  }, [progress, hats, phase, toast, copy]);

  // Stars, and side quests whose goal has just been met.
  const seenStars = useRef<number | null>(null);
  const seenReady = useRef<Set<SideId> | null>(null);
  useEffect(() => {
    if (phase !== "play") return;
    if (seenStars.current !== null && save.stars > seenStars.current) {
      const allDone = dailies.every((task) => task.have >= task.need);
      toast(allDone ? copy.guide.allDaily : copy.guide.dailyDone);
    }
    seenStars.current = save.stars;
    const ready = new Set(readyToFinish(sides));
    if (seenReady.current) {
      for (const id of ready) {
        if (seenReady.current.has(id)) continue;
        const giver = SIDE_QUESTS.find((quest) => quest.id === id)!.giver;
        toast(fill(copy.side.ready, { name: copy.side.quests[id].title, who: npcName(copy, giver) }));
      }
    }
    seenReady.current = ready;
  }, [save.stars, sides, dailies, phase, toast, copy]);

  // A chapter card whenever the story moves on, and once on arrival.
  const shownChapter = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "play") return;
    const id = current?.id ?? "done";
    if (shownChapter.current === id) return;
    shownChapter.current = id;
    const text = current
      ? `${fill(copy.guide.chapter, { n: progress.findIndex((quest) => quest.id === current.id) + 1 })} · ${copy.quests[current.id].title}`
      : copy.hud.done;
    setBanner(text);
    const timer = setTimeout(() => setBanner(null), 2800);
    return () => clearTimeout(timer);
  }, [current, progress, phase, copy]);

  /* ── Music ─────────────────────────────────────────────────────── */

  useEffect(() => {
    const music = new Music();
    musicRef.current = music;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMusicOn(music.isEnabled());
    // The first touch anywhere is what lets a browser make a sound.
    const unlock = () => music.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      music.stop();
      musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    const track: Track = phase !== "play" ? "title" : overlay?.type === "train" ? "train" : save.map;
    musicRef.current?.play(track);
  }, [phase, overlay?.type, save.map]);

  const toggleMusic = () => {
    const next = !musicOn;
    setMusicOn(next);
    musicRef.current?.setEnabled(next);
  };

  /* ── Stuck detection ───────────────────────────────────────────── */

  // Ninety seconds without anything moving forward — no stamp, no new
  // person met, no quest step — and the help button starts calling, once,
  // with a nudge. Any progress resets the clock.
  const [idleHint, setIdleHint] = useState(false);
  const progressKey = [
    save.flags.length,
    save.stamps.length,
    save.met.length,
    save.stalls.length,
    save.read.length,
    save.critters.length,
    save.shards.length,
    save.map,
  ].join("|");
  useEffect(() => {
    if (phase !== "play") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdleHint(false);
    const timer = setTimeout(() => {
      setIdleHint(true);
      toast(copy.help.idle);
    }, 90_000);
    return () => clearTimeout(timer);
  }, [progressKey, phase, toast, copy]);

  /* ── The engine ────────────────────────────────────────────────── */

  const openInteraction = useRef<(what: Interaction) => void>(() => {});

  useEffect(() => {
    if (phase !== "play" || !canvasRef.current) return;
    const initial = saveRef.current;

    const engine = new Engine(
      canvasRef.current,
      MAPS,
      community,
      { map: initial.map, x: initial.x, y: initial.y, look: initial.look, shards: initial.shards, stamps: initial.stamps },
      {
        onPrompt: setPrompt,
        onInteract: (what) => openInteraction.current(what),
        onStep: (map, x, y) => {
          setSave((prev) => (prev.map === map && prev.x === x && prev.y === y ? prev : { ...prev, map, x, y }));
          const landmark = engine.nearestLandmark();
          setWhere(landmark ? copy.landmarks[landmark as keyof GameCopy["landmarks"]].name : engine.nearestStreet());
        },
        onLandmark: (id) => {
          setSave((prev) => addTo(prev, "stamps", id));
          const landmark = copy.landmarks[id as keyof GameCopy["landmarks"]];
          toast(`${fill(copy.toast.stamp, { name: landmark.name })} · ${landmark.fact}`);
        },
        onShard: (id) => {
          setSave((prev) => {
            const next = addTo(prev, "shards", id);
            toast(fill(copy.toast.shard, { n: next.shards.length, total: TOTALS.shards }));
            return next;
          });
        },
        onArrive: (id) => daily("landmark", id),
        // Now and then a line for the time of day instead of their usual one.
        onNear: (id) => engine.say(id, copy.barks[id] && Math.random() < 0.35 ? pickMeme(copy.memes, new Date()) : copy.barks[id]),
        onMove: (map, x, y, dir) => netRef.current?.update(map, x, y, dir, saveRef.current.look),
        onTooFar: () => toast(copy.toast.tooFar),
      },
      {
        guestName: (animal, n) => fill(copy.guestName, { animal: copy.guestAnimals[animal] ?? "", n }),
        phrase: (id) => (isPhrase(id) ? copy.phrases[id] : ""),
      },
    );
    engineRef.current = engine;
    engine.start();
    const landmark = engine.nearestLandmark();
    setWhere(landmark ? copy.landmarks[landmark as keyof GameCopy["landmarks"]].name : engine.nearestStreet());

    const net = new Net(
      (peers, selfId) => {
        peersRef.current = peers;
        engine.setPeers(peers, selfId);
        setPeerCount(peers.filter((peer) => peer.id !== selfId).length);
        // Somebody near you waved within a few seconds of you waving: that is
        // a high five, on both screens, with no server round trip to agree it.
        if (Date.now() - lastWaveAt.current < 4000) {
          for (const peer of engine.peersNear(2.5)) {
            if (peer.emote !== "wave") continue;
            if (Date.now() - (highFived.current.get(peer.id) ?? 0) < 15000) continue;
            highFived.current.set(peer.id, Date.now());
            const name = peerName(copy, peer);
            toast(fill(copy.social.highFive, { name }));
            engineRef.current?.showEmote("party");
            setSave((prev) => ({ ...addTo(prev, "friends", name), highFives: prev.highFives + 1 }));
          }
        }
      },
      (next, seat) => {
        setStatus(next);
        if (seat) setMe({ name: seat.name, slug: seat.slug, guest: seat.guest });
      },
    );
    netRef.current = net;
    void net.start();

    return () => {
      engine.stop();
      net.stop();
      engineRef.current = null;
      netRef.current = null;
    };
  }, [phase, community, copy, toast, daily]);

  useEffect(() => {
    engineRef.current?.setPaused(overlay !== null && overlay.type !== "emotes");
  }, [overlay]);

  useEffect(() => {
    engineRef.current?.setLook(save.look);
    engineRef.current?.setShards(save.shards);
    const pos = engineRef.current?.position();
    if (pos) netRef.current?.update(pos.map, pos.x, pos.y, 0, save.look);
  }, [save.look, save.shards]);

  /* ── Guidance ──────────────────────────────────────────────────── */

  // What the arrow points at, and who wears a "!" or "?". Recomputed on every
  // step — it is a handful of distance checks — so the arrow always points at
  // the nearest unfinished thing, not the one that was nearest when you set off.
  useEffect(() => {
    const engine = engineRef.current;
    if (phase !== "play" || !engine) return;

    const side = tracked === "main" ? null : sides.find((quest) => quest.id === tracked);
    let query: Locate | null = null;

    if (side && !side.done) {
      const ready = side.accepted && side.have >= side.need;
      if (!side.accepted || ready) query = { kind: "story", id: side.giver };
      else if (side.id === "ibis") query = { kind: "critter", id: "ibis" };
      else if (side.id === "postcards") query = { kind: "photo", exclude: save.flags.filter((f) => f.startsWith("photo:")).map((f) => f.slice(6)) };
      else if (side.id === "shards") query = { kind: "shard", exclude: save.shards };
      else if (side.id === "gday") query = { kind: "walker" };
      else if (side.id === "coffee") query = { kind: "member", exclude: save.flags.filter((f) => f.startsWith("coffee:")).map((f) => f.slice(7)) };
    } else if (current) {
      switch (current.id) {
        case "arrive":
          query = { kind: "story", id: "deckhand" };
          break;
        case "muse":
          query = { kind: "story", id: "busker" };
          break;
        case "wharf":
          query = { kind: "story", id: "noticeboard" };
          break;
        case "bridge":
          query = { kind: "station", map: "harbour" };
          break;
        case "train":
          query = { kind: "station", map: "harbour" };
          break;
        case "market":
          query = { kind: "stall", exclude: save.stalls };
          break;
        case "people":
          query = { kind: "member", exclude: save.met };
          break;
        case "thursday":
          query = { kind: "story", id: "host" };
          break;
      }
    }

    let target = query ? engine.locate(query) : null;
    // On the other map: point at the station that gets you there.
    if (target && target.map !== save.map) target = engine.locate({ kind: "station", map: save.map });
    engine.setObjective(target);

    const markers = new Map<StoryNpcId, "!" | "?">();
    for (const quest of sides) {
      if (quest.done) continue;
      if (!quest.accepted) markers.set(quest.giver, "!");
      else if (quest.have >= quest.need) markers.set(quest.giver, "?");
    }
    if (query?.kind === "story" && tracked === "main") markers.set(query.id, "!");
    engine.setMarkers(markers);
  }, [phase, tracked, sides, current, save.map, save.x, save.y, save.flags, save.shards, save.stalls, save.met]);

  /** Sends an emote or phrase, shows it, and counts what it counts for. */
  const sendEmote = useCallback(
    (emote: Emote) => {
      const engine = engineRef.current;
      engine?.showEmote(emote);
      const pos = engine?.position();
      if (pos) netRef.current?.update(pos.map, pos.x, pos.y, 0, saveRef.current.look, emote);
      if (isPhrase(emote)) daily("phrase");
      if (emote === "wave") {
        lastWaveAt.current = Date.now();
        // Waving at somebody who is waving: high five, from this side.
        for (const peer of engine?.peersNear(2.5) ?? []) {
          const name = peerName(copy, peer);
          setSave((prev) => addTo(prev, "friends", name));
          if (peer.emote !== "wave" || Date.now() - (highFived.current.get(peer.id) ?? 0) < 15000) continue;
          highFived.current.set(peer.id, Date.now());
          toast(fill(copy.social.highFive, { name }));
          setSave((prev) => ({ ...prev, highFives: prev.highFives + 1 }));
        }
      }
    },
    [copy, daily, toast],
  );

  /** A postcard: the current frame, framed, with where it was taken. */
  /**
   * A postcard: the landmark drawn side-on, you in it, framed like a real card
   * with a stamp and a postmark dated today in Sydney.
   */
  const takePostcard = useCallback(
    (scene: SceneId, place: string, looks: Look[], sender: string) => {
      const date = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "2-digit", month: "short", year: "numeric" })
        .format(new Date())
        .toUpperCase();
      const url = drawPostcard(scene, looks, {
        greetings: copy.photo.greetings,
        town: scene === "mall" ? "CHATSWOOD" : "SYDNEY",
        place,
        from: fill(copy.photo.from, { name: sender }),
        date,
        site,
      });
      setOverlay({ type: "postcard", url, caption: place });
      daily("photo");
    },
    [copy, daily, site],
  );

  /* ── The story ─────────────────────────────────────────────────── */

  const say = useCallback((speaker: string, pages: string[], extra?: Partial<Dialog>) => {
    setOverlay({ type: "dialog", dialog: { speaker, pages, index: 0, ...extra } });
  }, []);

  const hint = current ? fill(copy.quests[current.id].hint, { have: current.have, need: current.need }) : copy.quests.allDone;

  const startTrain = useCallback((north: boolean) => setOverlay({ type: "train", north }), []);

  // Rebuilt after every render so the story always reads the current save and
  // copy; the engine holds a stable function that forwards here.
  useEffect(() => {
    openInteraction.current = (what: Interaction) => {
      const s = saveRef.current;
      const npc = copy.npc;

      switch (what.kind) {
        case "story": {
          const errand = SIDE_QUESTS.find((quest) => quest.giver === what.id);
          if (errand) {
            const quest = sides.find((q) => q.id === errand.id)!;
            const lines = copy.npc[what.id as "barista" | "photographer" | "tourist" | "greeter" | "hunter"];
            const questHint = fill(copy.side.quests[quest.id].hint, { have: quest.have, need: quest.need });
            const hatIndex = { coffee: 7, ibis: 8, postcards: 9, gday: 10, shards: -1 }[quest.id];
            const reward = hatIndex >= 0 ? fill(copy.side.reward, { hat: copy.wardrobe.hats[HATS[hatIndex]] }) : null;
            if (quest.done) {
              say(lines.name, lines.after);
            } else if (!quest.accepted) {
              say(lines.name, reward ? [...lines.offer, reward] : lines.offer, {
                choices: [
                  {
                    label: copy.side.accept,
                    run: () => {
                      update((prev) => addTo(prev, "flags", `side:${quest.id}`));
                      setTracked(quest.id);
                      setOverlay(null);
                    },
                  },
                  { label: copy.side.decline, run: () => setOverlay(null) },
                ],
              });
            } else if (quest.have >= quest.need) {
              say(lines.name, lines.done, {
                onDone: () => {
                  update((prev) => addTo(prev, "flags", `sidedone:${quest.id}`));
                  toast(fill(copy.side.finished, { name: copy.side.quests[quest.id].title }));
                  engineRef.current?.showEmote("party");
                  setTracked("main");
                },
              });
            } else {
              say(lines.name, lines.active.map((line) => fill(line, { hint: questHint })));
            }
            return;
          }
          switch (what.id) {
            case "deckhand":
              if (!s.flags.includes("talked:deckhand")) {
                say(npc.deckhand.name, npc.deckhand.first, { onDone: () => update((prev) => addTo(prev, "flags", "talked:deckhand")) });
              } else say(npc.deckhand.name, npc.deckhand.later.map((line) => fill(line, { hint })));
              return;
            case "busker":
              if (!s.idea) {
                say(npc.busker.name, npc.busker.ask, {
                  choices: IDEAS.map((idea: IdeaKind) => ({
                    label: copy.ideas[idea],
                    run: () => {
                      update((prev) => ({ ...prev, idea }));
                      const after = questProgress({ ...s, idea }, counts);
                      const next = currentQuest(after);
                      const nextHint = next ? fill(copy.quests[next.id].hint, { have: next.have, need: next.need }) : copy.quests.allDone;
                      say(npc.busker.name, [npc.busker.reply[idea], ...npc.busker.after.map((line) => fill(line, { hint: nextHint }))]);
                    },
                  })),
                });
              } else say(npc.busker.name, [npc.busker.reply[s.idea], ...npc.busker.after.map((line) => fill(line, { hint }))]);
              return;
            case "noticeboard":
              setOverlay({ type: "board" });
              return;
            case "climber":
              say(npc.climber.name, npc.climber.lines);
              return;
            case "guard":
              say(npc.guard.name, npc.guard.lines, {
                choices: [
                  { label: npc.guard.board, run: () => startTrain(true) },
                  { label: npc.guard.stay, run: () => setOverlay(null) },
                ],
              });
              return;
            case "stallholder":
              say(npc.stallholder.name, community.works.length ? npc.stallholder.lines : [npc.stallholder.lines[0], npc.stallholder.empty]);
              return;
            case "host": {
              const links: LinkOut[] = [
                { label: npc.host.signup, href: withLang("/#signup", lang) },
                { label: npc.host.claim, href: withLang("/claim", lang) },
                { label: npc.host.wharf, href: withLang("/wharf", lang) },
              ];
              if (s.flags.includes("talked:host")) {
                say(npc.host.name, npc.host.later, { links });
                return;
              }
              say(npc.host.name, [...npc.host.lines, npc.host.demo], {
                choices: npc.host.demoChoices.map((label, i) => ({
                  label,
                  run: () => {
                    update((prev) => addTo(prev, "flags", "talked:host"));
                    engineRef.current?.showEmote("party");
                    say(npc.host.name, [npc.host.demoReply[i], npc.host.ending], { links });
                  },
                })),
              });
              return;
            }
          }
          return;
        }
        case "member": {
          const member = community.members[what.index];
          if (!member) return;
          const script = copy.member.say;
          const pages = [
            [fill(script.hi, { name: member.name }), member.headline].filter(Boolean).join(""),
            member.lookingFor ? fill(script.looking, { v: member.lookingFor }) : null,
            member.canHelp ? fill(script.help, { v: member.canHelp }) : null,
            ...member.products.flatMap((product) => [
              product.tagline ? fill(script.product, { title: product.title, tagline: product.tagline }) : fill(script.productBare, { title: product.title }),
              product.stage ? fill(script.stage, { stage: copy.stall.stages[product.stage as keyof GameCopy["stall"]["stages"]] ?? product.stage }) : null,
            ]),
            member.products.length === 0 ? script.noWork : null,
            member.tags.length ? fill(script.tags, { tags: member.tags.map((tag) => `#${tag}`).join(" ") }) : null,
          ].filter((page): page is string => Boolean(page));

          const hello = () => {
            update((prev) => addTo(prev, "met", member.slug));
            daily("member");
          };
          hello();
          const coffeeRun = sides.some((q) => q.id === "coffee" && q.accepted && !q.done) && !s.flags.includes(`coffee:${member.slug}`);
          const choices: Choice[] = [
            {
              label: copy.member.hello,
              run: () => {
                setOverlay(null);
                engineRef.current?.showEmote("wave");
                engineRef.current?.say(what, script.bye, 3);
              },
            },
            ...member.products
              .filter((product) => product.url)
              .slice(0, 2)
              .map((product) => ({
                label: fill(script.open, { title: product.title }),
                run: () => window.open(product.url!, "_blank", "noopener,noreferrer"),
              })),
            { label: copy.member.card, run: () => setOverlay({ type: "member", index: what.index }) },
          ];
          if (coffeeRun) {
            choices.unshift({
              label: copy.social.giveCoffee,
              run: () => {
                update((prev) => addTo(prev, "flags", `coffee:${member.slug}`));
                setOverlay(null);
                engineRef.current?.say(what, copy.social.coffeeThanks, 4);
                engineRef.current?.showEmote("coffee");
              },
            });
          }
          say(member.name, pages, { choices, avatar: member.avatar });
          return;
        }
        case "stall": {
          const work = community.works[what.index];
          update((prev) => addTo(prev, "stalls", work ? work.key : "placeholder"));
          setOverlay({ type: "stall", index: what.index });
          return;
        }
        case "critter": {
          daily("critter");
          const lines = copy.critterTalk[what.id];
          engineRef.current?.say(what, lines[Math.floor(Math.random() * lines.length)], 3);
          // A friend just talks; a stranger talks, then you can try your luck.
          if (!s.critters.includes(what.id)) setTimeout(() => setOverlay({ type: "befriend", id: what.id }), 1100);
          return;
        }
        case "station":
          if (what.map === "harbour") {
            say(npc.guard.name, npc.guard.lines, {
              choices: [
                { label: npc.guard.board, run: () => startTrain(true) },
                { label: npc.guard.stay, run: () => setOverlay(null) },
              ],
            });
          } else {
            say(copy.train.title, [copy.train.toCity], {
              choices: [
                { label: copy.hud.board, run: () => startTrain(false) },
                { label: npc.guard.stay, run: () => setOverlay(null) },
              ],
            });
          }
          return;
        case "ferry":
          say(copy.ferry.title, [what.to === "milsons" ? copy.ferry.toMilsons : copy.ferry.toQuay], {
            choices: [
              { label: copy.hud.ferry, run: () => setOverlay({ type: "ferry", to: what.to }) },
              { label: npc.guard.stay, run: () => setOverlay(null) },
            ],
          });
          return;
        case "peer": {
          const peer = peersRef.current.find((p) => p.id === what.id);
          if (peer) setOverlay({ type: "peer", peer });
          return;
        }
        case "walker": {
          const line =
            Math.random() < 0.5 ? pickMeme(copy.memes, new Date()) : copy.walkers[Math.floor(Math.random() * copy.walkers.length)];
          engineRef.current?.say(what, line);
          engineRef.current?.showEmote("gday");
          const key = `${s.map}.${what.index}`;
          if (!greetedWalkers.current.has(key)) {
            greetedWalkers.current.add(key);
            update((prev) => ({ ...prev, greeted: prev.greeted + 1 }));
            daily("greet");
          }
          return;
        }
        case "photo": {
          update((prev) => addTo(prev, "flags", `photo:${what.id}`));
          takePostcard(
            what.id as SceneId,
            copy.photo.spots[what.id as keyof GameCopy["photo"]["spots"]] ?? copy.photo.spot,
            [s.look],
            playerName(copy, meRef.current),
          );
          return;
        }
      }
    };
  });

  /* ── Keyboard ──────────────────────────────────────────────────── */

  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  // Reads the dialogue from a ref rather than inside a state updater: the
  // last page's `onDone` writes to the save, and React may run an updater
  // twice, which is no place for a side effect.
  const advance = useCallback(() => {
    const current = overlayRef.current;
    if (!current || current.type !== "dialog") return;
    const { dialog } = current;
    if (dialog.index < dialog.pages.length - 1) {
      const next: Overlay = { type: "dialog", dialog: { ...dialog, index: dialog.index + 1 } };
      overlayRef.current = next;
      setOverlay(next);
      return;
    }
    if (dialog.choices?.length || dialog.links?.length) return;
    // Cleared here, synchronously, before anything else can read it: a held
    // key's repeat or a click in the same tick would otherwise see the same
    // last page and run `onDone` a second time.
    overlayRef.current = null;
    dialog.onDone?.();
    setOverlay(null);
  }, []);

  useEffect(() => {
    if (phase !== "play") return;
    const keyDir: Record<string, Dir> = {
      ArrowDown: 0, s: 0, S: 0,
      ArrowLeft: 1, a: 1, A: 1,
      ArrowRight: 2, d: 2, D: 2,
      ArrowUp: 3, w: 3, W: 3,
    };
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key in keyDir) {
        event.preventDefault();
        if (!overlay) engineRef.current?.press(keyDir[event.key]);
        return;
      }
      if (event.key === " " || event.key === "Enter" || event.key === "e" || event.key === "E") {
        if (event.repeat) return;
        if (overlay?.type === "dialog") {
          // Enter on a focused button is the button's own click.
          if (event.key === "Enter" && target?.tagName === "BUTTON") return;
          event.preventDefault();
          advance();
        } else if (!overlay) {
          event.preventDefault();
          engineRef.current?.act();
        }
        return;
      }
      // Number keys pick a choice on the last page of a conversation.
      if (/^[1-9]$/.test(event.key) && overlay?.type === "dialog") {
        const { dialog } = overlay;
        if (dialog.index !== dialog.pages.length - 1) return;
        const n = Number(event.key) - 1;
        if (dialog.choices?.[n]) {
          event.preventDefault();
          dialog.choices[n].run();
        } else if (dialog.links?.[n]) {
          event.preventDefault();
          window.location.href = dialog.links[n].href;
        }
        return;
      }
      // Esc closes whatever is open; with nothing open, it is the menu.
      if (event.key === "Escape") setOverlay(overlay ? null : { type: "menu" });
    };
    const up = (event: KeyboardEvent) => {
      if (event.key in keyDir) engineRef.current?.release(keyDir[event.key]);
    };
    // A phone can take a touch away without ever sending pointerup — a
    // notification pulled down, an app switch — and a pad that never hears the
    // release walks the character into the harbour. Losing focus lets go.
    const letGo = () => engineRef.current?.releaseAll();
    const onVisibility = () => document.hidden && letGo();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", letGo);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", letGo);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, overlay, advance]);

  /* ── Starting ──────────────────────────────────────────────────── */

  const begin = (fresh: boolean) => {
    if (fresh || !hasSave) {
      setSave(spawnSave());
      setPhase("create");
      return;
    }
    enterWorld();
  };

  const enterWorld = () => {
    // Worked out here rather than inside a state updater: React may run an
    // updater twice in development, and a toast fired from one showed twice.
    const next = touchStreak(save, sydneyDay(new Date()));
    if (next !== save) {
      setSave(next);
      if (next.streak > 1) setTimeout(() => toast(fill(copy.toast.streak, { n: next.streak })), 800);
    }
    if (isSydneyThursday(new Date())) setTimeout(() => toast(copy.hud.thursday), 1600);
    setPhase("play");
    if (!hasSave) setTimeout(() => setOverlay({ type: "help" }), 300);
  };

  /* ── Render ────────────────────────────────────────────────────── */

  if (phase === "title") {
    return (
      <div className="vq vq-title">
        <TitleBackdrop community={community} copy={copy} />
        <MusicButton on={musicOn} copy={copy} onToggle={toggleMusic} />
        <div className="vq-title__card vq-title__card--panel">
          <p className="vq-eyebrow">{copy.subtitle}</p>
          <h1 className="vq-title__h1">{copy.title}</h1>
          <Sprite look={save.look} scale={6} />
          <p className="vq-title__tagline">{copy.tagline}</p>
          <div className="vq-title__actions">
            {hasSave ? (
              <>
                <button type="button" className="vq-btn vq-btn--primary" onClick={() => begin(false)}>
                  {copy.continue}
                </button>
                <button type="button" className="vq-btn vq-btn--ghost" onClick={() => begin(true)}>
                  {copy.newGame}
                </button>
              </>
            ) : (
              <button type="button" className="vq-btn vq-btn--primary" onClick={() => begin(true)}>
                {copy.start}
              </button>
            )}
          </div>
          <button type="button" className="vq-btn vq-btn--ghost vq-btn--small" onClick={() => setOverlay({ type: "intro" })}>
            {copy.intro.button}
          </button>
          <p className="vq-fine">{copy.saveNote}</p>
          <p className="vq-fine">{copy.osm}</p>
          <Link className="vq-back" href={withLang("/", lang)}>
            ← {copy.back}
          </Link>
        </div>
        {overlay?.type === "intro" && <IntroPanel copy={copy} onClose={() => setOverlay(null)} />}
      </div>
    );
  }

  if (phase === "create") {
    return (
      <div className="vq vq-title">
        <TitleBackdrop community={community} copy={copy} />
        <MusicButton on={musicOn} copy={copy} onToggle={toggleMusic} />
        <div className="vq-title__card vq-title__card--panel">
          <h1 className="vq-title__h2">{copy.create.title}</h1>
          <p className="vq-fine">{copy.create.hint}</p>
          <Sprite look={save.look} scale={7} turntable />
          <LookEditor copy={copy} look={save.look} onChange={(look) => update((prev) => ({ ...prev, look }))} />
          <div className="vq-title__actions">
            <button
              type="button"
              className="vq-btn vq-btn--ghost"
              onClick={() => {
                const random = { ...DEFAULT_LOOK };
                for (const key of ["skin", "hair", "hairColor", "top", "bottom", "acc"] as const) {
                  const [, max] = LOOK_RANGES[key];
                  random[key] = Math.floor(Math.random() * (max + 1));
                }
                update((prev) => ({ ...prev, look: random }));
              }}
            >
              {copy.create.random}
            </button>
            <button type="button" className="vq-btn vq-btn--primary" onClick={enterWorld}>
              {copy.create.go}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const promptLabel = prompt ? labelFor(prompt, copy) : null;

  // The chip at the top follows whatever is being tracked.
  const trackedSide = tracked === "main" ? null : sides.find((quest) => quest.id === tracked && !quest.done) ?? null;
  const chipTitle = trackedSide ? copy.side.quests[trackedSide.id].title : current ? copy.quests[current.id].title : copy.hud.done;
  const chipHint = trackedSide
    ? trackedSide.have >= trackedSide.need
      ? fill(copy.side.returnTo, { who: npcName(copy, trackedSide.giver) })
      : fill(copy.side.quests[trackedSide.id].hint, { have: trackedSide.have, need: trackedSide.need })
    : hint;
  const myName = me?.name ?? (me?.guest ? fill(copy.guestName, { animal: copy.guestAnimals[me.guest[0]], n: me.guest[1] }) : null);

  return (
    <div className="vq vq-play">
      <canvas
        ref={canvasRef}
        className="vq-canvas"
        onPointerDown={(event) => {
          (event.currentTarget as HTMLCanvasElement).dataset.down = `${event.clientX},${event.clientY}`;
        }}
        onPointerUp={(event) => {
          const start = (event.currentTarget as HTMLCanvasElement).dataset.down?.split(",").map(Number);
          if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 12) return;
          const rect = event.currentTarget.getBoundingClientRect();
          engineRef.current?.tap(event.clientX - rect.left, event.clientY - rect.top);
        }}
      />

      {/* HUD — top */}
      <div className="vq-hud">
        <IconButton label={copy.menu.button} icon="menu" onClick={() => setOverlay({ type: "menu" })} />
        <button type="button" className="vq-questchip" onClick={() => setOverlay({ type: "quests" })}>
          <span className="vq-questchip__label">
            {trackedSide && <span className="vq-questchip__tag">{copy.guide.side}</span>}
            {chipTitle}
          </span>
          <span className="vq-questchip__hint">{chipHint}</span>
        </button>
        <div className="vq-hud__right">
          <span className={`vq-online ${status === "online" ? "is-on" : ""}`}>
            {status === "online" ? fill(copy.hud.online, { n: peerCount + 1 }) : copy.hud.offline}
          </span>
          <div className="vq-hud__buttons">
            <IconButton label={copy.hud.bag} icon="bag" onClick={() => setOverlay({ type: "bag" })} />
            <IconButton label={copy.hud.wardrobe} icon="shirt" onClick={() => setOverlay({ type: "wardrobe" })} />
            <IconButton label={copy.hud.emote} icon="smile" onClick={() => setOverlay(overlay?.type === "emotes" ? null : { type: "emotes" })} />
          </div>
          <div className="vq-hud__buttons">
            <IconButton
              label={copy.help.button}
              icon="help"
              onClick={() => {
                setIdleHint(false);
                setOverlay({ type: "guide" });
              }}
              highlight={idleHint}
            />
            <IconButton label={copy.share.button} icon="share" onClick={() => setOverlay({ type: "share" })} />
            <IconButton label={musicOn ? copy.music.on : copy.music.off} icon={musicOn ? "sound" : "mute"} onClick={toggleMusic} />
          </div>
        </div>
      </div>
      {where && (
        <div className="vq-place">
          <Icon name="pin" size={14} /> {where}
        </div>
      )}
      {banner && !overlay && (
        <div className="vq-banner" role="status">
          {banner}
        </div>
      )}

      <div className="vq-toasts" aria-live="polite">
        {toasts.map((item) => (
          <div className="vq-toast" key={item.id}>
            {item.text}
          </div>
        ))}
      </div>

      {/* Controls — bottom. Hidden while a dialogue or panel is up, so there
          is only ever one thing on screen asking to be pressed. */}
      {(!overlay || overlay.type === "emotes") && <DPad engine={engineRef} />}
      {(!overlay || overlay.type === "emotes") && (
        <button
          type="button"
          className={`vq-a ${prompt ? "is-ready" : ""}`}
          aria-label={promptLabel ?? copy.hud.a}
          onClick={() => engineRef.current?.act()}
        >
          <span className="vq-a__glyph">A</span>
          {promptLabel && <span className="vq-a__label">{promptLabel}</span>}
        </button>
      )}

      {overlay?.type === "emotes" && (
        <div className="vq-emotes">
          <div className="vq-emotes__grid">
            {EMOTES.filter((emote) => !isPhrase(emote)).map((emote: Emote) => (
              <button
                type="button"
                key={emote}
                className="vq-emote"
                aria-label={copy.emotes[emote]}
                onClick={() => {
                  sendEmote(emote);
                  setOverlay(null);
                }}
              >
                <Icon name={emote as IconName} size={28} />
                <small>{copy.emotes[emote]}</small>
              </button>
            ))}
          </div>
          <p className="vq-emotes__label">{copy.social.quickChat}</p>
          <div className="vq-emotes__phrases">
            {PHRASES.map((phrase) => (
              <button
                type="button"
                key={phrase}
                className="vq-chip"
                onClick={() => {
                  sendEmote(phrase);
                  setOverlay(null);
                }}
              >
                {copy.phrases[phrase]}
              </button>
            ))}
          </div>
        </div>
      )}

      {overlay?.type === "dialog" && (
        <DialogBox dialog={overlay.dialog} onAdvance={advance} onClose={() => setOverlay(null)} hint={copy.hud.dialogKeys} />
      )}

      {overlay?.type === "quests" && (
        <Panel title={copy.hud.quest} onClose={() => setOverlay(null)} closeLabel={copy.hud.close}>
          <h3 className="vq-h3 vq-h3--row">
            {copy.guide.main}
            <TrackButton copy={copy} on={tracked === "main"} onClick={() => setTracked("main")} />
          </h3>
          <ol className="vq-quests">
            {progress.map((quest, i) => (
              <li key={quest.id} className={quest.done ? "is-done" : current?.id === quest.id ? "is-current" : ""}>
                <span className="vq-quests__n">{quest.done ? "✓" : i + 1}</span>
                <div>
                  <strong>{copy.quests[quest.id].title}</strong>
                  {!quest.done && current?.id === quest.id && <p>{fill(copy.quests[quest.id].hint, { have: quest.have, need: quest.need })}</p>}
                </div>
              </li>
            ))}
          </ol>
          {!current && <p className="vq-fine">{copy.quests.allDone}</p>}

          <h3 className="vq-h3">{copy.guide.side}</h3>
          <ul className="vq-quests">
            {sides.map((quest) => (
              <li key={quest.id} className={quest.done ? "is-done" : tracked === quest.id ? "is-current" : ""}>
                <span className="vq-quests__n">{quest.done ? "✓" : quest.accepted ? `${quest.have}/${quest.need}` : "!"}</span>
                <div className="vq-quests__body">
                  <strong>{copy.side.quests[quest.id].title}</strong>
                  <p>
                    {quest.done
                      ? quest.id === "shards"
                        ? "✓"
                        : copy.wardrobe.hats[HATS[{ coffee: 7, ibis: 8, postcards: 9, gday: 10 }[quest.id]]]
                      : quest.accepted
                        ? quest.have >= quest.need
                          ? fill(copy.side.returnTo, { who: npcName(copy, quest.giver) })
                          : fill(copy.side.quests[quest.id].hint, { have: quest.have, need: quest.need })
                        : npcName(copy, quest.giver)}
                  </p>
                </div>
                {!quest.done && <TrackButton copy={copy} on={tracked === quest.id} onClick={() => setTracked(quest.id)} />}
              </li>
            ))}
          </ul>

          <h3 className="vq-h3">
            {copy.guide.daily} <small>{fill(copy.guide.stars, { n: save.stars })}</small>
          </h3>
          <ul className="vq-quests">
            {dailies.map((task) => (
              <li key={task.kind} className={task.have >= task.need ? "is-done" : ""}>
                <span className="vq-quests__n">{task.have >= task.need ? <Icon name="star" size={16} /> : `${task.have}/${task.need}`}</span>
                <div>
                  <strong>
                    {fill(copy.daily[task.kind], {
                      need: task.need,
                      place: task.landmark ? copy.landmarks[task.landmark as keyof GameCopy["landmarks"]].name : "",
                    })}
                  </strong>
                </div>
              </li>
            ))}
          </ul>
          <p className="vq-fine">{copy.guide.dailyNote}</p>
          <button type="button" className="vq-btn vq-btn--ghost vq-btn--small" onClick={() => setOverlay({ type: "help" })}>
            {copy.controls.title}
          </button>
        </Panel>
      )}

      {overlay?.type === "bag" && (
        <Panel title={copy.bag.title} onClose={() => setOverlay(null)} closeLabel={copy.hud.close}>
          <h3 className="vq-h3">
            {copy.bag.stamps} <small>{fill(copy.bag.progress, { n: save.stamps.length, total: TOTALS.stamps })}</small>
          </h3>
          <ul className="vq-grid">
            {LANDMARKS.map((landmark) => {
              const got = save.stamps.includes(landmark.id);
              const info = copy.landmarks[landmark.id as keyof GameCopy["landmarks"]];
              return (
                <li key={landmark.id} className={`vq-stamp ${got ? "is-got" : ""}`} title={got ? info.fact : undefined}>
                  <span className="vq-stamp__mark">{got ? <Icon name="star" size={18} /> : "?"}</span>
                  <span>{got ? info.name : copy.bag.unknown}</span>
                </li>
              );
            })}
          </ul>
          <h3 className="vq-h3">
            {copy.bag.critters} <small>{fill(copy.bag.progress, { n: save.critters.length, total: TOTALS.critters })}</small>
          </h3>
          <ul className="vq-grid vq-grid--critters">
            {CRITTERS.map((critter) => {
              const got = save.critters.includes(critter.id);
              return (
                <li key={critter.id} className={`vq-critter ${got ? "is-got" : ""}`}>
                  <CritterIcon id={critter.id} dim={!got} />
                  <span>{got ? copy.critters[critter.id].name : copy.bag.unknown}</span>
                  {got && <small>{copy.critters[critter.id].fact}</small>}
                </li>
              );
            })}
          </ul>
          <h3 className="vq-h3">
            {copy.bag.shards} <small>{fill(copy.bag.progress, { n: save.shards.length, total: TOTALS.shards })}</small>
          </h3>
          <p className="vq-shards">
            {SHARDS.map((shard) => (
              <span key={shard.id} className={save.shards.includes(shard.id) ? "is-got" : ""} aria-hidden="true">
                ◆
              </span>
            ))}
          </p>
          {save.streak > 0 && <p className="vq-fine">{fill(copy.hud.streak, { n: save.streak })}</p>}
          <h3 className="vq-h3">
            {copy.social.friends} <small>{fill(copy.social.highFives, { n: save.highFives })}</small>
          </h3>
          {save.friends.length ? (
            <p className="vq-tags vq-tags--friends">
              {save.friends.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </p>
          ) : (
            <p className="vq-fine">{copy.social.noFriends}</p>
          )}
        </Panel>
      )}

      {overlay?.type === "wardrobe" && (
        <Panel title={copy.wardrobe.title} onClose={() => setOverlay(null)} closeLabel={copy.hud.close}>
          <Sprite look={save.look} scale={6} turntable />
          <h3 className="vq-h3">{copy.wardrobe.hat}</h3>
          <div className="vq-chips">
            {HATS.map((hat, index) => {
              const open = hats.includes(hat);
              return (
                <button
                  type="button"
                  key={hat}
                  disabled={!open}
                  className={`vq-chip ${save.look.hat === index ? "is-on" : ""}`}
                  onClick={() => update((prev) => ({ ...prev, look: { ...prev.look, hat: index } }))}
                  title={open ? undefined : copy.wardrobe.unlock[hat]}
                >
                  {open ? (
                    copy.wardrobe.hats[hat]
                  ) : (
                    <>
                      <Icon name="lock" size={14} /> {copy.wardrobe.unlock[hat]}
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <h3 className="vq-h3">{copy.wardrobe.pet}</h3>
          <p className="vq-fine">{copy.wardrobe.petHint}</p>
          <div className="vq-chips">
            <button
              type="button"
              className={`vq-chip ${save.look.pet === -1 ? "is-on" : ""}`}
              onClick={() => update((prev) => ({ ...prev, look: { ...prev.look, pet: -1 } }))}
            >
              {copy.wardrobe.none}
            </button>
            {PETS.map((pet, index) =>
              save.critters.includes(pet) ? (
                <button
                  type="button"
                  key={pet}
                  className={`vq-chip ${save.look.pet === index ? "is-on" : ""}`}
                  onClick={() => update((prev) => ({ ...prev, look: { ...prev.look, pet: index } }))}
                >
                  {copy.critters[pet].name}
                </button>
              ) : null,
            )}
          </div>
          <LookEditor copy={copy} look={save.look} onChange={(look) => update((prev) => ({ ...prev, look }))} />
        </Panel>
      )}

      {overlay?.type === "member" && (
        <MemberPanel
          copy={copy}
          lang={lang}
          member={community.members[overlay.index]}
          met={save.met.includes(community.members[overlay.index]?.slug)}
          canGiveCoffee={
            sides.some((q) => q.id === "coffee" && q.accepted && !q.done) &&
            !save.flags.includes(`coffee:${community.members[overlay.index]?.slug}`)
          }
          onHello={() => {
            const member = community.members[overlay.index];
            update((prev) => addTo(prev, "met", member.slug));
            engineRef.current?.showEmote("wave");
            daily("member");
          }}
          onAsk={() => {
            const member = community.members[overlay.index];
            const product = member.products[0];
            const line = product ? `${product.title}${product.tagline ? ` — ${product.tagline}` : ""}` : member.headline ?? member.lookingFor ?? "👋";
            setOverlay(null);
            engineRef.current?.say({ kind: "member", index: overlay.index }, line, 5);
            daily("member");
          }}
          onCoffee={() => {
            const member = community.members[overlay.index];
            update((prev) => addTo(prev, "flags", `coffee:${member.slug}`));
            setOverlay(null);
            engineRef.current?.say({ kind: "member", index: overlay.index }, copy.social.coffeeThanks, 4);
            engineRef.current?.showEmote("coffee");
          }}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay?.type === "stall" && (
        <StallPanel copy={copy} lang={lang} work={community.works[overlay.index] ?? null} onClose={() => setOverlay(null)} />
      )}

      {overlay?.type === "board" && (
        <Panel title={copy.npc.noticeboard.name} onClose={() => setOverlay(null)} closeLabel={copy.hud.close}>
          <p className="vq-fine">{copy.npc.noticeboard.intro}</p>
          {community.questions.length === 0 && <p className="vq-fine">{copy.npc.noticeboard.empty}</p>}
          <ul className="vq-notes">
            {(community.questions.length
              ? community.questions
              : copy.npc.noticeboard.examples.map((text, i) => ({ id: `example-${i}`, text, name: copy.npc.noticeboard.example, slug: "" }))
            ).map((question) => {
              const read = save.read.includes(question.id);
              return (
                <li key={question.id}>
                  <details
                    className={`vq-note ${read ? "is-read" : ""}`}
                    onToggle={(event) => {
                      if ((event.currentTarget as HTMLDetailsElement).open) update((prev) => addTo(prev, "read", question.id));
                    }}
                  >
                    <summary>{question.text}</summary>
                    <p className="vq-fine">
                      {question.slug ? (
                        <Link href={withLang(`/members/${question.slug}`, lang)} target="_blank">
                          {fill(copy.npc.noticeboard.by, { name: question.name })}
                        </Link>
                      ) : (
                        question.name
                      )}
                    </p>
                  </details>
                </li>
              );
            })}
          </ul>
          <Link className="vq-btn vq-btn--primary vq-btn--small" href={withLang("/wharf", lang)} target="_blank">
            {copy.npc.noticeboard.open} ↗
          </Link>
        </Panel>
      )}

      {overlay?.type === "befriend" && (
        <Befriend
          copy={copy}
          id={overlay.id}
          onSuccess={() => {
            const id = overlay.id;
            update((prev) => addCritter(prev, id));
            toast(fill(copy.toast.critter, { name: copy.critters[id].name }));
          }}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay?.type === "train" && (
        <TrainRide
          copy={copy}
          north={overlay.north}
          onDone={() => {
            const to: MapId = overlay.north ? "chatswood" : "harbour";
            setOverlay(null);
            const station = place(MAPS[to], to === "harbour" ? -33.8462 : -33.79735, to === "harbour" ? 151.2116 : 151.1813);
            engineRef.current?.teleport(to, station);
            if (overlay.north) update((prev) => addTo(prev, "flags", "rode:t1"));
          }}
        />
      )}

      {overlay?.type === "ferry" && (
        <Ferry
          copy={copy}
          onDone={() => {
            const to = overlay.to;
            setOverlay(null);
            const engine = engineRef.current;
            if (engine) engine.teleport("harbour", engine.wharfTile(to));
          }}
        />
      )}

      {overlay?.type === "peer" && (
        <Panel
          title={overlay.peer.name ?? (overlay.peer.guest ? fill(copy.guestName, { animal: copy.guestAnimals[overlay.peer.guest[0]], n: overlay.peer.guest[1] }) : copy.member.guest)}
          onClose={() => setOverlay(null)}
          closeLabel={copy.hud.close}
        >
          <Sprite look={overlay.peer.look} scale={5} />
          {overlay.peer.slug ? (
            <Link className="vq-btn vq-btn--primary vq-btn--small" href={withLang(`/members/${overlay.peer.slug}`, lang)} target="_blank">
              {copy.member.card} ↗
            </Link>
          ) : (
            <p className="vq-fine">{copy.member.guestNote}</p>
          )}
          <div className="vq-chips">
            {(["wave", "gday", "building", "thursday", "coffeeq", "follow", "thanks"] as Emote[]).map((emote) => (
              <button
                type="button"
                key={emote}
                className="vq-chip"
                onClick={() => {
                  sendEmote(emote);
                  setOverlay(null);
                }}
              >
                {isPhrase(emote) ? (
                  copy.phrases[emote]
                ) : (
                  <>
                    <Icon name={emote as IconName} size={16} /> {copy.emotes[emote]}
                  </>
                )}
              </button>
            ))}
            <button
              type="button"
              className="vq-chip"
              onClick={() => {
                const name = peerName(copy, overlay.peer);
                update((prev) => addTo(prev, "friends", name));
                setOverlay(null);
                // Wait a frame so the panel is gone from the picture.
                const mine = playerName(copy, me);
                takePostcard(
                  save.map === "chatswood" ? "mall" : "kirribilli",
                  fill(copy.photo.withFrom, { a: mine, b: name }),
                  [save.look, overlay.peer.look],
                  mine,
                );
              }}
            >
              <Icon name="camera" size={16} /> {copy.photo.withPeer}
            </button>
          </div>
        </Panel>
      )}

      {overlay?.type === "postcard" && (
        <Panel title={copy.photo.title} onClose={() => setOverlay(null)} closeLabel={copy.hud.close}>
          {/* A data URL made on this device; there is nothing to optimise. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="vq-postcard" src={overlay.url} alt={overlay.caption} />
          <p className="vq-fine">{copy.photo.shareHint}</p>
          <a className="vq-btn vq-btn--primary vq-btn--small" href={overlay.url} download="vibe-thursday-postcard.jpg">
            {copy.photo.save}
          </a>
        </Panel>
      )}

      {overlay?.type === "share" && (
        <SharePanel
          copy={copy}
          look={save.look}
          qr={qr}
          site={site}
          stats={fill(copy.share.stats, {
            name: playerName(copy, me),
            stamps: save.stamps.length,
            critters: save.critters.length,
            chapter: current ? fill(copy.share.chapter, { n: progress.findIndex((q) => q.id === current.id) + 1 }) : copy.share.allDone,
          })}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay?.type === "intro" && <IntroPanel copy={copy} onClose={() => setOverlay(null)} />}

      {overlay?.type === "menu" && (
        <Panel title={copy.menu.title} onClose={() => setOverlay(null)} closeLabel={copy.hud.close}>
          <div className="vq-menu">
            <button type="button" className="vq-btn vq-btn--primary" onClick={() => setOverlay(null)}>
              {copy.menu.resume}
            </button>
            <button
              type="button"
              className="vq-btn vq-btn--choice"
              onClick={() => {
                // Written now, not after the usual debounce: the play view
                // unmounts on the next render and would take the timer with it.
                try {
                  localStorage.setItem(SAVE_KEY, JSON.stringify(saveRef.current));
                } catch {
                  // Storage blocked; nothing more to do.
                }
                setHasSave(true);
                setOverlay(null);
                setPhase("title");
              }}
            >
              {copy.menu.toTitle}
            </button>
            <button type="button" className="vq-btn vq-btn--choice" onClick={() => setOverlay({ type: "intro" })}>
              {copy.intro.button}
            </button>
            <button type="button" className="vq-btn vq-btn--choice" onClick={() => setOverlay({ type: "guide" })}>
              <Icon name="help" size={18} /> {copy.help.title}
            </button>
            <button type="button" className="vq-btn vq-btn--choice" onClick={toggleMusic}>
              <Icon name={musicOn ? "sound" : "mute"} size={18} /> {musicOn ? copy.music.on : copy.music.off}
            </button>
            <Link className="vq-btn vq-btn--ghost" href={withLang("/", lang)}>
              {copy.menu.home}
            </Link>
          </div>
          <p className="vq-fine">{copy.saveNote}</p>
        </Panel>
      )}

      {overlay?.type === "guide" && (
        <Panel title={copy.help.title} onClose={() => setOverlay(null)} closeLabel={copy.hud.close}>
          <div className="vq-guide__goal">
            <p className="vq-fine">{copy.help.goal}</p>
            <strong>{chipTitle}</strong>
            <p>{chipHint}</p>
            {tracked === "main" && current && <p className="vq-guide__tip">{copy.help.tips[current.id]}</p>}
          </div>
          <div className="vq-chips">
            <button
              type="button"
              className="vq-btn vq-btn--primary vq-btn--small"
              onClick={() => {
                const engine = engineRef.current;
                const target = engine?.getObjective();
                setOverlay(null);
                if (!engine || !target) toast(copy.help.noTarget);
                else if (engine.walkTo(target)) toast(copy.help.walking);
                else toast(copy.toast.tooFar);
              }}
            >
              <Icon name="pin" size={16} /> {copy.help.take}
            </button>
            <button
              type="button"
              className="vq-btn vq-btn--choice vq-btn--small"
              onClick={() => {
                engineRef.current?.rescue();
                setOverlay(null);
                toast(copy.help.stuckDone);
              }}
            >
              {copy.help.stuck}
            </button>
          </div>
          <h3 className="vq-h3">{copy.help.faq}</h3>
          <ul className="vq-notes">
            {copy.help.questions.map((item) => (
              <li key={item.q}>
                <details className="vq-note is-read">
                  <summary>{item.q}</summary>
                  <p className="vq-fine">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>
          <div className="vq-chips">
            <button type="button" className="vq-btn vq-btn--ghost vq-btn--small" onClick={() => setOverlay({ type: "intro" })}>
              {copy.intro.button}
            </button>
            <button type="button" className="vq-btn vq-btn--ghost vq-btn--small" onClick={() => setOverlay({ type: "help" })}>
              {copy.controls.title}
            </button>
          </div>
        </Panel>
      )}

      {overlay?.type === "help" && (
        <Panel title={copy.controls.title} onClose={() => setOverlay(null)} closeLabel={copy.hud.close}>
          <p>{copy.controls.phone}</p>
          <p>{copy.controls.keys}</p>
          {myName && (
            <p className="vq-fine">
              {copy.hud.you}: <strong>{myName}</strong>
            </p>
          )}
          {!me?.slug && (
            <Link className="vq-fine" href={withLang("/claim", lang)} target="_blank">
              {copy.member.claim} ↗
            </Link>
          )}
          <button type="button" className="vq-btn vq-btn--primary" onClick={() => setOverlay(null)}>
            {copy.controls.ok}
          </button>
          <p className="vq-fine">{copy.osm}</p>
        </Panel>
      )}
    </div>
  );
}

/* =============================================================================
   Pieces
============================================================================= */

type Me = { name: string | null; slug: string | null; guest: [number, number] | null } | null;

/** What to sign a postcard or poster with: your wall name, your guest name, or "a player". */
function playerName(copy: GameCopy, me: Me): string {
  if (me?.name) return me.name;
  if (me?.guest) return fill(copy.guestName, { animal: copy.guestAnimals[me.guest[0]] ?? "", n: me.guest[1] });
  return copy.share.player;
}

function npcName(copy: GameCopy, id: StoryNpcId): string {
  return (copy.npc as Record<string, { name: string }>)[id]?.name ?? id;
}

function peerName(copy: GameCopy, peer: PeerView): string {
  if (peer.name) return peer.name;
  if (peer.guest) return fill(copy.guestName, { animal: copy.guestAnimals[peer.guest[0]] ?? "", n: peer.guest[1] });
  return copy.member.guest;
}

function labelFor(prompt: Interaction, copy: GameCopy): string {
  switch (prompt.kind) {
    case "story":
      return prompt.id === "noticeboard" ? copy.hud.read : copy.hud.talk;
    case "member":
      return copy.hud.talk;
    case "stall":
      return copy.hud.visit;
    case "critter":
      return copy.hud.befriend;
    case "station":
      return copy.hud.board;
    case "ferry":
      return copy.hud.ferry;
    case "peer":
      return copy.hud.look;
    case "walker":
      return "G'day";
    case "photo":
      return copy.photo.take;
  }
}

/**
 * The title screen's moving picture: the real game, running with no player,
 * the camera touring the harbour while the ferry crosses and people walk by.
 * Decorative, so hidden from assistive technology.
 */
function TitleBackdrop({ community, copy }: { community: Community; copy: GameCopy }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const noop = () => {};
    const start = place(MAPS.harbour, SPAWN.harbour.lat, SPAWN.harbour.lon);
    const engine = new Engine(
      ref.current,
      MAPS,
      community,
      { map: "harbour", x: start.x, y: start.y, look: DEFAULT_LOOK, shards: [], stamps: [], demo: true },
      { onPrompt: noop, onInteract: noop, onStep: noop, onLandmark: noop, onArrive: noop, onNear: noop, onShard: noop, onMove: noop, onTooFar: noop },
      { guestName: () => "", phrase: (id) => (isPhrase(id) ? copy.phrases[id] : "") },
    );
    engine.start();
    return () => engine.stop();
  }, [community, copy]);
  return (
    <>
      <canvas ref={ref} className="vq-backdrop" aria-hidden="true" />
      <div className="vq-backdrop__veil" aria-hidden="true" />
    </>
  );
}

/** Sound on/off where it can be found before the game starts. */
function MusicButton({ on, copy, onToggle }: { on: boolean; copy: GameCopy; onToggle: () => void }) {
  return (
    <button type="button" className="vq-music" onClick={onToggle} aria-pressed={on}>
      <Icon name={on ? "sound" : "mute"} size={18} /> {on ? copy.music.on : copy.music.off}
    </button>
  );
}

/** What the game is, what you can do in it, and how — before or during play. */
function IntroPanel({ copy, onClose }: { copy: GameCopy; onClose: () => void }) {
  const intro = copy.intro;
  return (
    <Panel title={intro.title} onClose={onClose} closeLabel={copy.hud.close}>
      <h3 className="vq-h3">{intro.what}</h3>
      <p>{intro.whatBody}</p>
      <h3 className="vq-h3">{intro.features}</h3>
      <ul className="vq-intro">
        {intro.list.map((item, i) => (
          <li key={item}>
            <Icon name={(["pin", "chat", "star", "bag", "smile", "heart"] as IconName[])[i % 6]} size={18} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <h3 className="vq-h3">{intro.how}</h3>
      <p>{intro.howBody}</p>
      <p className="vq-fine">{intro.note}</p>
      <button type="button" className="vq-btn vq-btn--primary" onClick={onClose}>
        {copy.controls.ok}
      </button>
    </Panel>
  );
}

/**
 * The share poster: drawn on open, then saved or handed to the phone's own
 * share sheet — which is what puts it in a WeChat chat or a Story in one tap.
 */
function SharePanel({
  copy,
  look,
  qr,
  site,
  stats,
  onClose,
}: {
  copy: GameCopy;
  look: Look;
  qr: string;
  site: string;
  stats: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    let live = true;
    const text = copy.share;
    void drawPoster(look, { ...text, stats, site, caption: text.caption }, qr).then((made) => {
      if (live) setUrl(made);
    });
    return () => {
      live = false;
    };
  }, [copy, look, qr, site, stats]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const share = async () => {
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], "vibe-thursday.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: copy.share.brand });
      else await navigator.share({ title: copy.share.brand, url: `https://${site}` });
    } catch {
      // Dismissed, or not allowed here: the save button still works.
    }
  };

  return (
    <Panel title={copy.share.title} onClose={onClose} closeLabel={copy.hud.close}>
      {url ? (
        // A data URL made on this device; nothing to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="vq-poster" src={url} alt={copy.share.brand} />
      ) : (
        <p className="vq-fine">{copy.share.making}</p>
      )}
      <p className="vq-fine">{copy.share.hint}</p>
      <div className="vq-chips">
        {url && (
          <a className="vq-btn vq-btn--primary vq-btn--small" href={url} download="vibe-thursday-sydney.png">
            {copy.share.save}
          </a>
        )}
        {url && canShare && (
          <button type="button" className="vq-btn vq-btn--choice vq-btn--small" onClick={share}>
            <Icon name="share" size={16} /> {copy.share.native}
          </button>
        )}
      </div>
    </Panel>
  );
}

function TrackButton({ copy, on, onClick }: { copy: GameCopy; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`vq-track ${on ? "is-on" : ""}`} onClick={onClick} aria-pressed={on}>
      {on ? `◎ ${copy.guide.tracking}` : copy.guide.track}
    </button>
  );
}

function IconButton({ label, icon, onClick, highlight = false }: { label: string; icon: IconName; onClick: () => void; highlight?: boolean }) {
  return (
    <button type="button" className={`vq-icon ${highlight ? "is-calling" : ""}`} aria-label={label} title={label} onClick={onClick}>
      <Icon name={icon} size={24} />
    </button>
  );
}

function Panel({ title, onClose, closeLabel, children }: { title: string; onClose: () => void; closeLabel: string; children: ReactNode }) {
  return (
    <div className="vq-scrim" onClick={onClose}>
      <section className="vq-panel" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header className="vq-panel__head">
          <h2>{title}</h2>
          <button type="button" className="vq-icon" aria-label={closeLabel} onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="vq-panel__body">{children}</div>
      </section>
    </div>
  );
}

function DialogBox({ dialog, onAdvance, onClose, hint }: { dialog: Dialog; onAdvance: () => void; onClose: () => void; hint: string }) {
  const last = dialog.index === dialog.pages.length - 1;
  const showChoices = last && dialog.choices?.length;
  const showLinks = last && dialog.links?.length;
  return (
    <div className="vq-dialog" role="dialog" aria-label={dialog.speaker} onClick={() => !showChoices && !showLinks && onAdvance()}>
      <div className="vq-dialog__head">
        {dialog.avatar && (
          // A member's own photo, already resized at upload.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="vq-dialog__avatar" src={dialog.avatar} alt="" width={40} height={40} />
        )}
        <p className="vq-dialog__speaker">{dialog.speaker}</p>
        <span className="vq-dialog__count">
          {dialog.index + 1}/{dialog.pages.length}
        </span>
      </div>
      <p className="vq-dialog__text">{dialog.pages[dialog.index]}</p>
      {showChoices ? (
        <div className="vq-dialog__choices">
          {dialog.choices!.map((choice, i) => (
            <button
              type="button"
              key={choice.label}
              className="vq-btn vq-btn--choice"
              onClick={(event) => {
                event.stopPropagation();
                choice.run();
              }}
            >
              <kbd className="vq-kbd">{i + 1}</kbd>
              {choice.label}
            </button>
          ))}
        </div>
      ) : showLinks ? (
        <div className="vq-dialog__choices">
          {dialog.links!.map((link, i) => (
            <Link key={link.href} href={link.href} className={`vq-btn ${i === 0 ? "vq-btn--primary" : "vq-btn--choice"}`}>
              <kbd className="vq-kbd">{i + 1}</kbd>
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            className="vq-btn vq-btn--ghost"
            aria-label="close"
            onClick={(event) => {
              event.stopPropagation();
              dialog.onDone?.();
              onClose();
            }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : (
        <span className="vq-dialog__more">
          <span className="vq-dialog__keys">{hint}</span>
          <span aria-hidden="true">▼</span>
        </span>
      )}
    </div>
  );
}

/** The on-screen pad: one surface, direction by where the thumb is. */
function DPad({ engine }: { engine: React.RefObject<Engine | null> }) {
  const current = useRef<Dir | null>(null);
  const [active, setActive] = useState<Dir | null>(null);

  const set = (dir: Dir | null) => {
    if (current.current === dir) return;
    if (current.current !== null) engine.current?.release(current.current);
    if (dir !== null) engine.current?.press(dir);
    current.current = dir;
    setActive(dir);
  };

  const fromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    if (Math.hypot(dx, dy) < rect.width * 0.12) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
  };

  return (
    <div
      className="vq-pad"
      aria-hidden="true"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        set(fromPointer(event) as Dir | null);
      }}
      onPointerMove={(event) => {
        if (current.current === null && event.buttons === 0) return;
        set(fromPointer(event) as Dir | null);
      }}
      onPointerUp={() => set(null)}
      onPointerCancel={() => set(null)}
      onLostPointerCapture={() => set(null)}
    >
      {(["up", "left", "right", "down"] as const).map((name, i) => (
        <span key={name} className={`vq-pad__${name} ${active === ([3, 1, 2, 0] as Dir[])[i] ? "is-on" : ""}`} />
      ))}
    </div>
  );
}

/** A character, drawn by the same code as the game, at a readable size. */
function Sprite({ look, scale, turntable = false }: { look: Look; scale: number; turntable?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dir, setDir] = useState<Dir>(0);

  useEffect(() => {
    if (!turntable) return;
    const order: Dir[] = [0, 1, 3, 2];
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % 4;
      setDir(order[i]);
    }, 1100);
    return () => clearInterval(timer);
  }, [turntable]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(characterSprite(look, dir, 0), 0, 0, canvas.width, canvas.height);
  }, [look, dir]);

  return <canvas ref={ref} width={16 * scale} height={24 * scale} className="vq-sprite" aria-hidden="true" />;
}

function CritterIcon({ id, dim }: { id: CritterId; dim: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sprite = critterSprite(id, 0);
    const scale = Math.min(canvas.width / sprite.width, canvas.height / sprite.height);
    ctx.drawImage(sprite, (canvas.width - sprite.width * scale) / 2, (canvas.height - sprite.height * scale) / 2, sprite.width * scale, sprite.height * scale);
    if (dim) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "#2a3038";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
    }
  }, [id, dim]);
  return <canvas ref={ref} width={64} height={48} className="vq-sprite" aria-hidden="true" />;
}

function LookEditor({ copy, look, onChange }: { copy: GameCopy; look: Look; onChange: (look: Look) => void }) {
  const fields = ["skin", "hair", "hairColor", "top", "bottom", "acc"] as const;
  return (
    <div className="vq-look">
      {fields.map((field) => {
        const [min, max] = LOOK_RANGES[field];
        const step = (delta: number) => {
          const span = max - min + 1;
          onChange({ ...look, [field]: ((look[field] - min + delta + span) % span) + min });
        };
        return (
          <div className="vq-look__row" key={field}>
            <button type="button" className="vq-icon" aria-label={`${copy.create[field]} −`} onClick={() => step(-1)}>
              ‹
            </button>
            <span>
              {copy.create[field]} <small>{look[field] + 1}</small>
            </span>
            <button type="button" className="vq-icon" aria-label={`${copy.create[field]} +`} onClick={() => step(1)}>
              ›
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MemberPanel({
  copy,
  lang,
  member,
  met,
  canGiveCoffee,
  onHello,
  onAsk,
  onCoffee,
  onClose,
}: {
  copy: GameCopy;
  lang: Lang;
  member: Community["members"][number] | undefined;
  met: boolean;
  canGiveCoffee: boolean;
  onHello: () => void;
  onAsk: () => void;
  onCoffee: () => void;
  onClose: () => void;
}) {
  if (!member) return null;
  return (
    <Panel title={member.name} onClose={onClose} closeLabel={copy.hud.close}>
      <div className="vq-member">
        {member.avatar ? (
          // Already resized in the browser at upload; nothing for an optimiser to do.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="vq-member__avatar" src={member.avatar} alt="" width={64} height={64} />
        ) : (
          <span className="vq-member__avatar vq-member__mono" aria-hidden="true">
            {member.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          {member.headline && <p className="vq-member__headline">{member.headline}</p>}
          {member.roles.length > 0 && (
            <p className="vq-fine">{member.roles.map((role) => copy.member.roles[role as keyof GameCopy["member"]["roles"]] ?? role).join(" · ")}</p>
          )}
        </div>
      </div>
      {member.lookingFor && (
        <p>
          <strong>{copy.member.looking}：</strong>
          {member.lookingFor}
        </p>
      )}
      {member.canHelp && (
        <p>
          <strong>{copy.member.help}：</strong>
          {member.canHelp}
        </p>
      )}
      {member.products.length > 0 && (
        <div>
          <strong>{copy.member.builds}：</strong>
          <ul className="vq-list">
            {member.products.map((product) => (
              <li key={product.title}>
                {product.title}
                {product.tagline ? ` — ${product.tagline}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {member.tags.length > 0 && (
        <p className="vq-tags">
          {member.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>
      )}
      <div className="vq-chips">
        <button type="button" className="vq-btn vq-btn--primary vq-btn--small" disabled={met} onClick={onHello}>
          {met ? `✓ ${copy.member.met}` : copy.member.hello}
        </button>
        <button type="button" className="vq-btn vq-btn--choice vq-btn--small" onClick={onAsk}>
          <Icon name="chat" size={16} /> {copy.social.ask}
        </button>
        {canGiveCoffee && (
          <button type="button" className="vq-btn vq-btn--primary vq-btn--small" onClick={onCoffee}>
            <Icon name="coffee" size={16} /> {copy.social.giveCoffee}
          </button>
        )}
        <Link className="vq-btn vq-btn--choice vq-btn--small" href={withLang(`/members/${member.slug}`, lang)} target="_blank">
          {copy.member.card} ↗
        </Link>
      </div>
    </Panel>
  );
}

function StallPanel({ copy, lang, work, onClose }: { copy: GameCopy; lang: Lang; work: Community["works"][number] | null; onClose: () => void }) {
  if (!work) {
    return (
      <Panel title={copy.stall.placeholder} onClose={onClose} closeLabel={copy.hud.close}>
        <p>{copy.stall.placeholderNote}</p>
        <Link className="vq-btn vq-btn--primary vq-btn--small" href={withLang("/claim", lang)} target="_blank">
          {copy.member.claim} ↗
        </Link>
      </Panel>
    );
  }
  return (
    <Panel title={work.title} onClose={onClose} closeLabel={copy.hud.close}>
      {work.stage && <span className="vq-pill">{copy.stall.stages[work.stage as keyof GameCopy["stall"]["stages"]] ?? work.stage}</span>}
      {work.tagline && <p className="vq-member__headline">{work.tagline}</p>}
      <p className="vq-fine">
        {copy.stall.by} {work.maker}
      </p>
      <div className="vq-chips">
        {work.url && (
          <a className="vq-btn vq-btn--primary vq-btn--small" href={work.url} target="_blank" rel="noopener noreferrer nofollow">
            {copy.stall.visit} ↗
          </a>
        )}
        <Link className="vq-btn vq-btn--choice vq-btn--small" href={withLang(`/members/${work.slug}`, lang)} target="_blank">
          {copy.stall.maker} ↗
        </Link>
      </div>
    </Panel>
  );
}

/**
 * Befriending: a marker sweeps a bar, tap while it is in the green. Rarer
 * animals get a narrower window and a faster marker.
 */
function Befriend({ copy, id, onSuccess, onClose }: { copy: GameCopy; id: CritterId; onSuccess: () => void; onClose: () => void }) {
  const rarity = CRITTERS.find((critter) => critter.id === id)?.rarity ?? 1;
  const zone = [0, 0.3, 0.22, 0.15, 0.1][rarity];
  const speed = [0, 0.9, 1.1, 1.35, 1.6][rarity];
  const [result, setResult] = useState<"playing" | "won" | "lost">("playing");
  const [zoneStart] = useState(() => 0.2 + Math.random() * (0.6 - zone));
  const markerRef = useRef<HTMLSpanElement>(null);
  const pos = useRef(0);

  useEffect(() => {
    if (result !== "playing") return;
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = ((now - start) / 1000) * speed;
      pos.current = (Math.sin(t * Math.PI) + 1) / 2;
      if (markerRef.current) markerRef.current.style.left = `${pos.current * 100}%`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [result, speed]);

  const tap = () => {
    if (result !== "playing") return;
    if (pos.current >= zoneStart && pos.current <= zoneStart + zone) {
      setResult("won");
      onSuccess();
    } else setResult("lost");
  };

  return (
    <Panel title={copy.critters[id].name} onClose={onClose} closeLabel={copy.hud.close}>
      <CritterIcon id={id} dim={false} />
      {result === "playing" && (
        <>
          <p className="vq-fine">{copy.befriend.tap}</p>
          <div className="vq-meter" onPointerDown={tap}>
            <span className="vq-meter__zone" style={{ left: `${zoneStart * 100}%`, width: `${zone * 100}%` }} />
            <span className="vq-meter__marker" ref={markerRef} />
          </div>
          <button type="button" className="vq-btn vq-btn--primary" onClick={tap}>
            {copy.befriend.tapButton}
          </button>
        </>
      )}
      {result === "won" && (
        <>
          <p>
            <strong>{copy.befriend.success}</strong>
          </p>
          <p className="vq-fine">{copy.critters[id].fact}</p>
          <button type="button" className="vq-btn vq-btn--primary" onClick={onClose}>
            {copy.controls.ok}
          </button>
        </>
      )}
      {result === "lost" && (
        <>
          <p>{copy.befriend.fail}</p>
          <div className="vq-chips">
            <button type="button" className="vq-btn vq-btn--primary" onClick={() => setResult("playing")}>
              {copy.befriend.retry}
            </button>
            <button type="button" className="vq-btn vq-btn--ghost" onClick={onClose}>
              {copy.befriend.leave}
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}

/** The ferry sprite from the game, big, bobbing — for the crossing screen. */
function FerryIcon() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ferrySprite(true), 0, 0, 200, 100);
  }, []);
  return <canvas ref={ref} width={200} height={100} className="vq-sprite vq-ferry__boat" aria-hidden="true" />;
}

function Ferry({ copy, onDone }: { copy: GameCopy; onDone: () => void }) {
  // Held in a ref: the parent re-renders on every toast and step, and a new
  // callback each time would restart the crossing before it ever landed.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const timer = setTimeout(() => done.current(), 1800);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="vq-ferry" role="status">
      <FerryIcon />
      <p>{copy.ferry.sailing}</p>
    </div>
  );
}
