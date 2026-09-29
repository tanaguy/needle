/// <reference lib="webworker" />
// Runs on the audio thread. Two processors:
//   "scratch"      – a virtual record: sub-sample playhead driven by a hand/motor model
//   "recorder-tap" – pass-through that streams PCM to the main thread while recording

declare const sampleRate: number
declare const currentTime: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor()
}

type Msg =
  | { type: 'load'; data: Float32Array; lead: number }
  | { type: 'grab' }
  | { type: 'move'; d: number }
  | { type: 'release' }
  | { type: 'fader'; open: boolean; rampMs: number; smooth: boolean }
  | { type: 'motor'; on: boolean; tauMs: number }
  | { type: 'cue' }
  | { type: 'level'; gain: number }

const TAU_FOLLOW = 0.014 // s — how tightly the platter follows the hand
const FF_HOLD = 0.02 // s — keep feed-forward velocity this long after the last move
const FF_FADE = 0.016 // s — then fade it out over this long
const REPORT_EVERY = 256 // frames
const TURN_S = 1.8 // one platter turn at 33⅓ rpm, in seconds

class ScratchProcessor extends AudioWorkletProcessor {
  buf: Float32Array = new Float32Array(0)
  lead = 0.25 // seconds of silence before the cue on each loop
  loopLen = 1 // seconds (sample + gaps)

  pos = 0 // seconds of record travel (unwrapped)
  vel = 0 // record speed, 1 = normal
  hand = true
  handTarget = 0
  ffVel = 0
  lastMoveT = -1
  lastMoveAt = -1

  motorOn = true
  motorTau = 0.03

  /** fader travel 0 (closed) → 1 (open), moved at a constant rate */
  faderPos = 0
  faderTarget = 0
  faderStep = 1
  faderSmooth = false
  /** resulting gain after the curve */
  fader = 0

  level = 1
  lp = 0
  frames = 0
  peak = 0

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<Msg>) => this.onMsg(e.data)
  }

  onMsg(m: Msg) {
    switch (m.type) {
      case 'load': {
        this.buf = m.data
        this.lead = m.lead
        const dur = m.data.length / sampleRate
        // whole turns per loop, so the cue sticker always sits at 12 o'clock on the cue
        this.loopLen = Math.max(1, Math.ceil((dur + this.lead + 0.35) / TURN_S)) * TURN_S
        // snap to the cue of the current loop so a sample swap lands on the sticker
        const base = Math.floor(this.pos / this.loopLen) * this.loopLen + this.lead
        this.pos = base
        this.handTarget = base
        this.vel = 0
        break
      }
      case 'grab':
        this.hand = true
        this.handTarget = this.pos
        this.ffVel = 0
        this.lastMoveT = -1
        break
      case 'move': {
        if (!this.hand) {
          this.hand = true
          this.handTarget = this.pos
        }
        this.handTarget += m.d
        const t = currentTime
        if (this.lastMoveT >= 0) {
          const dt = Math.max(t - this.lastMoveT, 0.004)
          const inst = m.d / Math.min(dt, 0.05)
          this.ffVel += (inst - this.ffVel) * 0.6
        } else {
          this.ffVel = 0
        }
        this.lastMoveT = t
        this.lastMoveAt = t
        break
      }
      case 'release':
        this.hand = false
        this.lastMoveT = -1
        break
      case 'fader':
        this.faderTarget = m.open ? 1 : 0
        this.faderStep = 1 / Math.max(1, (sampleRate * m.rampMs) / 1000) // full travel in rampMs
        this.faderSmooth = m.smooth
        break
      case 'motor':
        this.motorOn = m.on
        this.motorTau = Math.max(m.tauMs, 5) / 1000 / 3
        break
      case 'cue': {
        const base = Math.round((this.pos - this.lead) / this.loopLen) * this.loopLen + this.lead
        this.pos = base
        this.handTarget = base
        this.vel = 0
        this.hand = true
        break
      }
      case 'level':
        this.level = m.gain
        break
    }
  }

  read(p: number): number {
    // p is seconds on the record; the sample lives at [lead, lead + dur) within each loop
    const L = this.loopLen
    const q = p - Math.floor(p / L) * L - this.lead
    const x = q * sampleRate
    const n = this.buf.length
    if (x < -2 || x > n + 1) return 0
    const i = Math.floor(x)
    const f = x - i
    const b = this.buf
    const s0 = i - 1 >= 0 && i - 1 < n ? b[i - 1] : 0
    const s1 = i >= 0 && i < n ? b[i] : 0
    const s2 = i + 1 >= 0 && i + 1 < n ? b[i + 1] : 0
    const s3 = i + 2 >= 0 && i + 2 < n ? b[i + 2] : 0
    // cubic Hermite
    const c1 = 0.5 * (s2 - s0)
    const c2 = s0 - 2.5 * s1 + 2 * s2 - 0.5 * s3
    const c3 = 0.5 * (s3 - s0) + 1.5 * (s1 - s2)
    return ((c3 * f + c2) * f + c1) * f + s1
  }

  process(_in: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]
    const L = out[0].length
    const dt = 1 / sampleRate
    const smooth = 1 - Math.exp(-dt / 0.0015)
    const motorA = 1 - Math.exp(-dt / this.motorTau)

    // feed-forward velocity weight (block-rate is plenty)
    let ffW = 0
    if (this.hand && this.lastMoveAt >= 0) {
      const age = currentTime - this.lastMoveAt
      ffW = age < FF_HOLD ? 1 : Math.max(0, 1 - (age - FF_HOLD) / FF_FADE)
      if (ffW === 0) this.ffVel = 0
    }

    for (let k = 0; k < L; k++) {
      if (this.hand) {
        const desired = this.ffVel * ffW + (this.handTarget - this.pos) / TAU_FOLLOW
        this.vel += (desired - this.vel) * smooth
      } else {
        const want = this.motorOn ? 1 : 0
        this.vel += (want - this.vel) * motorA
      }
      this.pos += this.vel * dt

      let s = this.read(this.pos)

      // cartridge feel: output fades near standstill, highs roll off when slow
      const sp = Math.abs(this.vel)
      const amp = sp >= 0.08 ? 1 : (sp / 0.08) * (sp / 0.08) * (3 - 2 * (sp / 0.08))
      const fc = Math.min(18000, 900 + 17000 * Math.min(sp, 1.2))
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sampleRate)
      this.lp += (s - this.lp) * a
      s = this.lp * amp

      if (this.faderPos !== this.faderTarget) {
        this.faderPos += this.faderPos < this.faderTarget ? this.faderStep : -this.faderStep
        if (this.faderPos > 1) this.faderPos = 1
        if (this.faderPos < 0) this.faderPos = 0
        if (Math.abs(this.faderPos - this.faderTarget) < this.faderStep) this.faderPos = this.faderTarget
      }
      // sharp: gain follows travel (the ~1 ms travel only de-clicks)
      // smooth: equal-power curve over a long glide — an audible fade in and out
      this.fader = this.faderSmooth ? Math.sin((this.faderPos * Math.PI) / 2) : this.faderPos
      const v = s * this.fader * this.level

      for (let c = 0; c < out.length; c++) out[c][k] = v
      const av = v < 0 ? -v : v
      if (av > this.peak) this.peak = av
    }

    this.frames += L
    if (this.frames >= REPORT_EVERY) {
      this.frames = 0
      this.port.postMessage({
        pos: this.pos,
        vel: this.vel,
        hand: this.hand,
        fader: this.fader,
        loopLen: this.loopLen,
        lead: this.lead,
        peak: this.peak,
        t: currentTime,
      })
      this.peak = 0
    }
    return true
  }
}

class RecorderTap extends AudioWorkletProcessor {
  on = false
  chunkL: Float32Array[] = []
  chunkR: Float32Array[] = []
  count = 0
  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<{ on: boolean }>) => {
      this.on = e.data.on
      if (!this.on) this.flush()
    }
  }
  flush() {
    if (!this.chunkL.length) return
    this.port.postMessage({ l: this.chunkL, r: this.chunkR })
    this.chunkL = []
    this.chunkR = []
    this.count = 0
  }
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const inp = inputs[0]
    const out = outputs[0]
    if (inp && inp.length) {
      for (let c = 0; c < out.length; c++) out[c].set(inp[Math.min(c, inp.length - 1)])
      if (this.on) {
        this.chunkL.push(inp[0].slice())
        this.chunkR.push((inp[1] || inp[0]).slice())
        this.count += inp[0].length
        if (this.count >= 16384) this.flush()
      }
    }
    return true
  }
}

registerProcessor('scratch', ScratchProcessor)
registerProcessor('recorder-tap', RecorderTap)
