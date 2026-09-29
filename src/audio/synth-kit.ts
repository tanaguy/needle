// Small offline synthesis toolkit: drum voices, bass, keys, crackle.
// Everything renders into an OfflineAudioContext once at load.

export type Ctx = OfflineAudioContext

const noiseCache = new WeakMap<Ctx, AudioBuffer>()
export function noise(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx)
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = b.getChannelData(0)
    let seed = 1234567
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647
      d[i] = (seed / 2147483647) * 2 - 1
    }
    noiseCache.set(ctx, b)
  }
  return b
}

export function env(ctx: Ctx, t: number, peak: number, attack: number, decay: number, out: AudioNode) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  g.connect(out)
  return g
}

function noiseSrc(ctx: Ctx, t: number, dur: number, offset = Math.random()) {
  const s = ctx.createBufferSource()
  s.buffer = noise(ctx)
  s.start(t, offset, dur)
  return s
}

export function kick(ctx: Ctx, out: AudioNode, t: number, v = 1, o: { hi?: number; lo?: number; decay?: number } = {}) {
  const { hi = 115, lo = 44, decay = 0.42 } = o
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(hi, t)
  osc.frequency.exponentialRampToValueAtTime(lo, t + 0.09)
  const g = env(ctx, t, 1.0 * v, 0.002, decay, out)
  osc.connect(g)
  osc.start(t)
  osc.stop(t + decay + 0.05)
  // beater click
  const n = noiseSrc(ctx, t, 0.02)
  const hp = ctx.createBiquadFilter()
  hp.type = 'bandpass'
  hp.frequency.value = 3500
  n.connect(hp)
  hp.connect(env(ctx, t, 0.18 * v, 0.001, 0.012, out))
}

export function snare(ctx: Ctx, out: AudioNode, t: number, v = 1, o: { tone?: number; decay?: number; bright?: number } = {}) {
  const { tone = 185, decay = 0.2, bright = 1900 } = o
  const n = noiseSrc(ctx, t, decay + 0.3)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = bright
  bp.Q.value = 0.6
  n.connect(bp)
  bp.connect(env(ctx, t, 0.7 * v, 0.001, decay, out))
  // room tail
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 4200
  bp.connect(lp)
  lp.connect(env(ctx, t + 0.01, 0.12 * v, 0.01, decay * 2.2, out))
  // body
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(tone, t)
  osc.frequency.exponentialRampToValueAtTime(tone * 0.82, t + 0.08)
  osc.connect(env(ctx, t, 0.55 * v, 0.001, 0.09, out))
  osc.start(t)
  osc.stop(t + 0.2)
}

export function clap(ctx: Ctx, out: AudioNode, t: number, v = 1) {
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1250
  bp.Q.value = 1.1
  bp.connect(out)
  for (let i = 0; i < 3; i++) {
    const n = noiseSrc(ctx, t + i * 0.011, 0.03)
    n.connect(env(ctx, t + i * 0.011, 0.6 * v, 0.001, 0.02, bp))
  }
  const n = noiseSrc(ctx, t + 0.033, 0.3)
  n.connect(env(ctx, t + 0.033, 0.55 * v, 0.002, 0.16, bp))
}

export function rim(ctx: Ctx, out: AudioNode, t: number, v = 1) {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = 830
  osc.connect(env(ctx, t, 0.35 * v, 0.0005, 0.03, out))
  osc.start(t)
  osc.stop(t + 0.06)
  const n = noiseSrc(ctx, t, 0.02)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2500
  n.connect(hp)
  hp.connect(env(ctx, t, 0.3 * v, 0.0005, 0.015, out))
}

export function hat(ctx: Ctx, out: AudioNode, t: number, v = 1, open = false) {
  const d = open ? 0.24 : 0.035
  const n = noiseSrc(ctx, t, d + 0.05)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7200
  const pk = ctx.createBiquadFilter()
  pk.type = 'peaking'
  pk.frequency.value = 10500
  pk.gain.value = 6
  n.connect(hp)
  hp.connect(pk)
  pk.connect(env(ctx, t, 0.28 * v, 0.0008, d, out))
}

export function shaker(ctx: Ctx, out: AudioNode, t: number, v = 1) {
  const n = noiseSrc(ctx, t, 0.1)
  const bp = ctx.createBiquadFilter()
  bp.type = 'highpass'
  bp.frequency.value = 5200
  n.connect(bp)
  bp.connect(env(ctx, t, 0.16 * v, 0.012, 0.055, out))
}

export function bass(ctx: Ctx, out: AudioNode, t: number, dur: number, freq: number, v = 1) {
  const o1 = ctx.createOscillator()
  o1.type = 'sine'
  o1.frequency.value = freq
  const o2 = ctx.createOscillator()
  o2.type = 'triangle'
  o2.frequency.value = freq * 2
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 520
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.55 * v, t + 0.012)
  g.gain.setValueAtTime(0.5 * v, t + dur - 0.04)
  g.gain.linearRampToValueAtTime(0, t + dur)
  const g2 = ctx.createGain()
  g2.gain.value = 0.18
  o1.connect(g)
  o2.connect(g2)
  g2.connect(g)
  g.connect(lp)
  lp.connect(out)
  o1.start(t)
  o2.start(t)
  o1.stop(t + dur + 0.02)
  o2.stop(t + dur + 0.02)
}

export function keys(ctx: Ctx, out: AudioNode, t: number, dur: number, freqs: number[], v = 1) {
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2000
  const trem = ctx.createGain()
  trem.gain.value = 0.85
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 4.2
  const lfoG = ctx.createGain()
  lfoG.gain.value = 0.15
  lfo.connect(lfoG)
  lfoG.connect(trem.gain)
  lfo.start(t)
  lfo.stop(t + dur + 0.6)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.16 * v, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.07 * v, t + dur * 0.7)
  g.gain.linearRampToValueAtTime(0, t + dur + 0.5)
  g.connect(trem)
  trem.connect(lp)
  lp.connect(out)
  for (const f of freqs) {
    for (const [mul, amp, det] of [
      [1, 1, -3],
      [1, 0.8, 4],
      [2, 0.22, 0],
    ] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f * mul
      o.detune.value = det
      const a = ctx.createGain()
      a.gain.value = amp / freqs.length
      o.connect(a)
      a.connect(g)
      o.start(t)
      o.stop(t + dur + 0.6)
    }
  }
}

export function crackle(ctx: Ctx, out: AudioNode, len: number, density = 7, v = 1) {
  const b = ctx.createBuffer(1, Math.ceil(len * ctx.sampleRate), ctx.sampleRate)
  const d = b.getChannelData(0)
  let seed = 42
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const pops = Math.floor(len * density)
  for (let p = 0; p < pops; p++) {
    const at = Math.floor(rnd() * (d.length - 200))
    const amp = (0.2 + rnd() * 0.8) * (rnd() < 0.1 ? 1 : 0.35)
    for (let k = 0; k < 40; k++) d[at + k] += (rnd() * 2 - 1) * amp * Math.exp(-k / 6)
  }
  for (let i = 0; i < d.length; i++) d[i] += (rnd() * 2 - 1) * 0.012 // hiss
  const s = ctx.createBufferSource()
  s.buffer = b
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 900
  const g = ctx.createGain()
  g.gain.value = 0.22 * v
  s.connect(hp)
  hp.connect(g)
  g.connect(out)
  s.start(0)
}

export const note = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

export function normalize(buf: AudioBuffer, peak = 0.9) {
  let m = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]))
  }
  if (m < 1e-6) return buf
  const k = peak / m
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] *= k
  }
  return buf
}

export function bus(ctx: Ctx) {
  // gentle glue: soft clip + compressor
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 3
  comp.attack.value = 0.006
  comp.release.value = 0.12
  const shaper = ctx.createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4)
  }
  shaper.curve = curve
  comp.connect(shaper)
  shaper.connect(ctx.destination)
  return comp
}
