import workletUrl from './scratch-worklet.ts?worker&url'
import { BEATS, renderBeat } from './synth-beats'
import { SAMPLES, renderSample, type SampleDef } from './synth-samples'
import { useStore, getSettings, type BeatMeta, type SampleMeta, type Take } from '../store'

/** One full platter turn at 33⅓ rpm, in seconds of audio. */
export const TURN = 60 / (100 / 3)
const LEAD = 0.25
const HIST = 2048
/** Fader travel time: sharp cut (just de-clicks) vs smooth blend (audible fade). */
export const FADER_CUT_MS = 1
export const FADER_SMOOTH_MS = 150

/** Live deck telemetry, written by the audio thread's reports. Read it every frame; never put it in React state. */
export const deck = {
  pos: 0,
  vel: 0,
  hand: true,
  fader: 0,
  loopLen: 1.4,
  lead: LEAD,
  peak: 0,
  t: 0, // ctx time of the last report
  // history ring (for the WaveStrip trail and — later — lesson scoring)
  hT: new Float64Array(HIST),
  hPos: new Float64Array(HIST),
  hFader: new Float32Array(HIST),
  hHead: 0,
  hCount: 0,
}

type Beat = { meta: BeatMeta; buf: AudioBuffer | null }
type Sample = { meta: SampleMeta; buf: AudioBuffer | null }

class Engine {
  ctx: AudioContext | null = null
  master!: GainNode
  limiter!: DynamicsCompressorNode
  beatBus!: GainNode
  previewBus!: GainNode
  scratch!: AudioWorkletNode
  tap!: AudioWorkletNode

  beats = new Map<string, Beat>()
  samples = new Map<string, Sample>()
  beatId = ''
  sampleId = ''
  bpm = 90
  beatLoopBeats = 16
  beatT0 = 0
  private beatSrc: AudioBufferSourceNode | null = null
  private beatGain: GainNode | null = null
  private previewSrc: AudioBufferSourceNode | null = null
  private recL: Float32Array[] = []
  private recR: Float32Array[] = []
  private recStopResolve: (() => void) | null = null
  started = false
  ready = false

  private initP: Promise<void> | null = null
  private progressCb: (p: number, label: string) => void = () => {}

  /** Idempotent — React StrictMode runs effects twice; there must only ever be one context. */
  init(progress: (p: number, label: string) => void) {
    this.progressCb = progress
    this.initP ??= this.boot((p, l) => this.progressCb(p, l))
    return this.initP
  }

  private async boot(progress: (p: number, label: string) => void) {
    if (typeof AudioWorkletNode === 'undefined' || typeof OfflineAudioContext === 'undefined') {
      throw new Error('unsupported')
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    this.ctx = ctx
    const sr = ctx.sampleRate

    this.master = ctx.createGain()
    this.limiter = ctx.createDynamicsCompressor()
    this.limiter.threshold.value = -3
    this.limiter.knee.value = 0
    this.limiter.ratio.value = 20
    this.limiter.attack.value = 0.002
    this.limiter.release.value = 0.08
    this.beatBus = ctx.createGain()
    this.previewBus = ctx.createGain()
    this.previewBus.gain.value = 0.7

    progress(0.05, 'Warming up the platter')
    await ctx.audioWorklet.addModule(workletUrl)

    this.scratch = new AudioWorkletNode(ctx, 'scratch', { numberOfInputs: 0, outputChannelCount: [2] })
    this.tap = new AudioWorkletNode(ctx, 'recorder-tap', { numberOfInputs: 1, outputChannelCount: [2] })
    this.scratch.connect(this.master)
    this.beatBus.connect(this.master)
    this.previewBus.connect(this.master)
    this.master.connect(this.limiter)
    this.limiter.connect(this.tap)
    this.tap.connect(ctx.destination)

    this.scratch.port.onmessage = (e) => this.onReport(e.data)
    this.tap.port.onmessage = (e: MessageEvent<{ l: Float32Array[]; r: Float32Array[] }>) => {
      this.recL.push(...e.data.l)
      this.recR.push(...e.data.r)
      if (this.recStopResolve) {
        this.recStopResolve()
        this.recStopResolve = null
      }
    }

    // render built-in crate
    const total = BEATS.length + SAMPLES.length
    let done = 0
    for (const def of BEATS) {
      const buf = await renderBeat(def, sr)
      this.beats.set(def.id, {
        buf,
        meta: { id: def.id, name: def.name, bpm: def.bpm, style: def.style, bars: def.bars, source: 'builtin', playable: true },
      })
      progress(0.1 + (0.6 * ++done) / total, 'Cutting the beats')
    }
    for (const def of SAMPLES) {
      const buf = (await this.loadRecording(def)) ?? (await renderSample(def, sr))
      this.samples.set(def.id, {
        buf,
        meta: { id: def.id, name: def.name, note: def.note, duration: buf.duration, source: 'builtin', playable: true },
      })
      progress(0.1 + (0.6 * ++done) / total, 'Pressing the samples')
    }
    this.publishCrate()

    const s = getSettings()
    this.applyLevels()
    this.applyMotor()
    this.selectSample(this.samples.has(s.sampleId) ? s.sampleId : 'ahh')
    this.beatId = this.beats.has(s.beatId) ? s.beatId : 'boom-bap'
    this.bpm = this.beats.get(this.beatId)!.meta.bpm

    document.addEventListener('visibilitychange', () => {
      if (!this.started || !this.ctx) return
      if (document.hidden) {
        this.release()
        this.ctx.suspend()
      } else {
        this.ctx.resume()
      }
    })

    this.ready = true
  }

  private recordings = new Map<string, Promise<AudioBuffer | null>>()

  /** Decode (once per file) and cut a real recording for a sample; null if unavailable. */
  private async loadRecording(def: SampleDef): Promise<AudioBuffer | null> {
    const f = def.file
    if (!f || !this.ctx) return null
    const ctx = this.ctx
    if (!this.recordings.has(f.url)) {
      this.recordings.set(
        f.url,
        fetch(f.url)
          .then((r) => {
            // dev servers answer missing files with index.html
            if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) return null
            return r.arrayBuffer().then((b) => ctx.decodeAudioData(b))
          })
          .catch(() => null),
      )
    }
    const buf = await this.recordings.get(f.url)!
    return buf ? cut(ctx, buf, f.start, f.end) : null
  }

  private publishCrate() {
    useStore.getState().set({
      beats: [...this.beats.values()].map((b) => b.meta),
      samples: [...this.samples.values()].map((s) => s.meta),
    })
  }

  /** Must be called from a user gesture. */
  async start() {
    const ctx = this.ctx!
    await ctx.resume()
    if (!this.started) {
      this.started = true
      this.selectBeat(this.beatId)
    }
    return ctx.state === 'running'
  }

  // ─── Beat deck ──────────────────────────────────────────────
  beatPaused = false
  /** seconds into the loop where playback stopped */
  private pausedAt = 0

  private stopBeatSource(at: number) {
    if (this.beatSrc && this.beatGain) {
      this.beatGain.gain.setTargetAtTime(0, at, 0.01)
      this.beatSrc.stop(at + 0.08)
    }
    this.beatSrc = null
    this.beatGain = null
  }

  private startBeatSource(buf: AudioBuffer, offset: number) {
    const ctx = this.ctx!
    const now = ctx.currentTime + 0.02
    this.stopBeatSource(now)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(1, now + 0.01)
    src.connect(g)
    g.connect(this.beatBus)
    src.start(now, offset)
    this.beatSrc = src
    this.beatGain = g
    this.beatT0 = now - offset
  }

  selectBeat(id: string) {
    const b = this.beats.get(id)
    if (!b?.buf || !this.ctx) return
    this.startBeatSource(b.buf, 0)
    this.setBeatPaused(false)
    this.beatId = id
    this.bpm = b.meta.bpm
    this.beatLoopBeats = (b.buf.duration * this.bpm) / 60
    useStore.getState().setSettings({ beatId: id })
  }

  /** Stop the loop where it is, or pick it back up from the same spot. */
  toggleBeatPause() {
    const b = this.beats.get(this.beatId)
    if (!b?.buf || !this.ctx || !this.started) return
    if (this.beatPaused) {
      this.startBeatSource(b.buf, this.pausedAt)
      this.setBeatPaused(false)
    } else {
      const len = b.buf.duration
      const t = this.ctx.currentTime - this.beatT0
      this.pausedAt = ((t % len) + len) % len
      this.stopBeatSource(this.ctx.currentTime)
      this.setBeatPaused(true)
    }
  }

  private setBeatPaused(p: boolean) {
    this.beatPaused = p
    useStore.getState().set({ beatPaused: p })
  }

  /** Beat position (in beats, fractional) as currently heard. Frozen while paused. */
  beatNow(): number {
    const ctx = this.ctx
    if (!ctx || !this.started) return 0
    if (this.beatPaused) return (this.pausedAt * this.bpm) / 60
    const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
    const t = ctx.currentTime - lat - this.beatT0
    return Math.max(0, (t * this.bpm) / 60)
  }

  // ─── Scratch deck ───────────────────────────────────────────
  selectSample(id: string) {
    const s = this.samples.get(id)
    if (!s?.buf) return
    let data = s.buf.getChannelData(0)
    if (s.buf.numberOfChannels > 1) {
      const r = s.buf.getChannelData(1)
      const mono = new Float32Array(data.length)
      for (let i = 0; i < mono.length; i++) mono[i] = (data[i] + r[i]) * 0.5
      data = mono
    }
    const max = Math.floor(6 * s.buf.sampleRate)
    if (data.length > max) data = data.slice(0, max)
    else data = data.slice()
    this.scratch.port.postMessage({ type: 'load', data, lead: LEAD }, [data.buffer])
    this.sampleId = id
    useStore.getState().setSettings({ sampleId: id })
  }

  sampleBuffer(): AudioBuffer | null {
    return this.samples.get(this.sampleId)?.buf ?? null
  }

  grab() {
    this.scratch?.port.postMessage({ type: 'grab' })
    deck.hand = true
  }
  /** d in platter turns */
  move(d: number) {
    this.scratch?.port.postMessage({ type: 'move', d: d * TURN })
  }
  release() {
    this.scratch?.port.postMessage({ type: 'release' })
    deck.hand = false
  }
  cue() {
    this.scratch?.port.postMessage({ type: 'cue' })
  }
  setFader(open: boolean) {
    const smooth = getSettings().faderCurve === 'smooth'
    this.scratch?.port.postMessage({ type: 'fader', open, rampMs: smooth ? FADER_SMOOTH_MS : FADER_CUT_MS, smooth })
  }
  setMotor(on: boolean) {
    useStore.getState().set({ motorOn: on })
    this.applyMotor()
  }
  applyMotor() {
    const on = useStore.getState().motorOn
    this.scratch?.port.postMessage({ type: 'motor', on, tauMs: on ? getSettings().motorStartMs : 900 })
  }
  applyLevels() {
    if (!this.ctx) return
    const s = getSettings()
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(s.volume, t, 0.02)
    this.beatBus.gain.setTargetAtTime(s.beatLevel, t, 0.02)
    this.scratch?.port.postMessage({ type: 'level', gain: s.sampleLevel })
  }

  private onReport(r: typeof deck & { t: number }) {
    deck.pos = r.pos
    deck.vel = r.vel
    deck.hand = r.hand
    deck.fader = r.fader
    deck.loopLen = r.loopLen
    deck.lead = r.lead
    deck.peak = r.peak
    deck.t = r.t
    const i = deck.hHead
    deck.hT[i] = r.t
    deck.hPos[i] = r.pos
    deck.hFader[i] = r.fader
    deck.hHead = (i + 1) % HIST
    deck.hCount = Math.min(deck.hCount + 1, HIST)
  }

  /** Platter position (seconds of record travel) extrapolated to now. */
  platterNow(): number {
    const ctx = this.ctx
    if (!ctx) return deck.pos
    const dt = Math.min(Math.max(ctx.currentTime - deck.t, 0), 0.03)
    return deck.pos + deck.vel * dt
  }

  // ─── Preview ────────────────────────────────────────────────
  preview(kind: 'beat' | 'sample', id: string) {
    const ctx = this.ctx
    if (!ctx || !this.started) return
    this.stopPreview()
    const item = kind === 'beat' ? this.beats.get(id) : this.samples.get(id)
    if (!item?.buf) return
    const src = ctx.createBufferSource()
    src.buffer = item.buf
    src.connect(this.previewBus)
    const bars = kind === 'beat' ? Math.min(item.buf.duration, (60 / (item.meta as BeatMeta).bpm) * 8) : item.buf.duration
    src.start(ctx.currentTime + 0.01, 0, bars)
    if (kind === 'beat') this.beatBus.gain.setTargetAtTime(0.08, ctx.currentTime, 0.05)
    src.onended = () => {
      if (this.previewSrc === src) this.stopPreview()
    }
    this.previewSrc = src
  }
  stopPreview() {
    if (this.previewSrc) {
      try {
        this.previewSrc.stop()
      } catch {
        /* already stopped */
      }
      this.previewSrc = null
    }
    if (this.ctx) this.beatBus.gain.setTargetAtTime(getSettings().beatLevel, this.ctx.currentTime, 0.08)
  }

  // ─── Recording ──────────────────────────────────────────────
  startRecording() {
    this.recL = []
    this.recR = []
    this.tap.port.postMessage({ on: true })
  }
  async stopRecording(): Promise<Take> {
    const flushed = new Promise<void>((res) => {
      this.recStopResolve = res
      setTimeout(res, 300)
    })
    this.tap.port.postMessage({ on: false })
    await flushed
    const n = this.recL.reduce((a, c) => a + c.length, 0)
    const l = new Float32Array(n)
    const r = new Float32Array(n)
    let o = 0
    for (let i = 0; i < this.recL.length; i++) {
      l.set(this.recL[i], o)
      r.set(this.recR[i], o)
      o += this.recL[i].length
    }
    this.recL = []
    this.recR = []
    const sampleRate = this.ctx!.sampleRate
    return { l, r, sampleRate, duration: n / sampleRate }
  }

  playBuffer(l: Float32Array, r: Float32Array, sampleRate: number, onEnd: () => void) {
    const ctx = this.ctx!
    const buf = ctx.createBuffer(2, l.length, sampleRate)
    buf.copyToChannel(l as Float32Array<ArrayBuffer>, 0)
    buf.copyToChannel(r as Float32Array<ArrayBuffer>, 1)
    const src = ctx.createBufferSource()
    src.buffer = buf
    // bypass the tap so review playback never records itself
    src.connect(ctx.destination)
    src.onended = onEnd
    src.start()
    return {
      stop: () => {
        src.onended = null
        try {
          src.stop()
        } catch {
          /* noop */
        }
      },
      startedAt: ctx.currentTime,
    }
  }

  /** Silence the beat bus without stopping the loop (used under take playback). */
  muteBeat(muted: boolean) {
    if (!this.ctx) return
    this.beatBus.gain.setTargetAtTime(muted ? 0 : getSettings().beatLevel, this.ctx.currentTime, 0.03)
  }
}

export const engine = new Engine()
if (import.meta.env.DEV) (window as unknown as { engine: Engine; deck: typeof deck }).engine = engine
if (import.meta.env.DEV) (window as unknown as { deck: typeof deck }).deck = deck

/**
 * Cut [start, end] out of a recording as mono, snapping the start to the actual attack
 * so the cue sticker sits right on the sound (browsers disagree about MP3 padding),
 * with tiny fades so the cut points don't click.
 */
function cut(ctx: BaseAudioContext, buf: AudioBuffer, start: number, end: number): AudioBuffer {
  const sr = buf.sampleRate
  let a = Math.max(0, Math.floor(start * sr))
  const b = Math.min(buf.length, Math.ceil(end * sr))
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c))
  const mono = (i: number) => chans.reduce((acc, d) => acc + d[i], 0) / chans.length
  let peak = 0
  for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(mono(i)))
  const floor = Math.max(0.01, peak * 0.08)
  let on = a
  while (on < b && Math.abs(mono(on)) < floor) on++
  if (on < b) a = Math.max(a, on - Math.floor(0.002 * sr))
  const out = ctx.createBuffer(1, Math.max(1, b - a), sr)
  const d = out.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = mono(a + i)
  const fade = Math.min(64, Math.floor(d.length / 4))
  for (let i = 0; i < fade; i++) {
    d[i] *= i / fade
    d[d.length - 1 - i] *= i / fade
  }
  return out
}
