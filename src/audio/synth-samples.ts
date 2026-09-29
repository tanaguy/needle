import { normalize, noise, type Ctx } from './synth-kit'

export type SampleDef = {
  id: string
  name: string
  note: string
  dur: number
  render: (ctx: Ctx, out: AudioNode) => void
  /** Real recording to use when available; the synth render is the fallback. */
  file?: { url: string; start: number; end: number }
}

// The classic battle-record "Ahh" / "Fresh" (Fab 5 Freddy — Change the Beat).
// Kept out of git; if it's missing, the synthesized voices stand in.
const CLASSIC = '/audio/classic/ahh-fresh.mp3'

type Formant = [freq: number, q: number, gain: number]

function voice(
  ctx: Ctx,
  out: AudioNode,
  t0: number,
  t1: number,
  f0: [number, number],
  formants: Formant[],
  { attack = 0.02, release = 0.12, breath = 0.08, detune = 0 } = {},
) {
  const src = ctx.createOscillator()
  src.type = 'sawtooth'
  src.frequency.setValueAtTime(f0[0], t0)
  src.frequency.exponentialRampToValueAtTime(f0[1], t1)
  src.detune.value = detune
  const vib = ctx.createOscillator()
  vib.frequency.value = 5.6
  const vibG = ctx.createGain()
  vibG.gain.setValueAtTime(0, t0)
  vibG.gain.linearRampToValueAtTime(f0[0] * 0.018, t1)
  vib.connect(vibG)
  vibG.connect(src.frequency)

  const air = ctx.createBufferSource()
  air.buffer = noise(ctx)
  const airG = ctx.createGain()
  airG.gain.value = breath
  air.connect(airG)

  const envG = ctx.createGain()
  envG.gain.setValueAtTime(0, t0)
  envG.gain.linearRampToValueAtTime(1, t0 + attack)
  envG.gain.setValueAtTime(1, t1 - release)
  envG.gain.linearRampToValueAtTime(0, t1)

  for (const [f, q, g] of formants) {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = q
    const gg = ctx.createGain()
    gg.gain.value = g
    src.connect(bp)
    airG.connect(bp)
    bp.connect(gg)
    gg.connect(envG)
  }
  envG.connect(out)
  src.start(t0)
  vib.start(t0)
  air.start(t0, Math.random())
  src.stop(t1 + 0.02)
  vib.stop(t1 + 0.02)
  air.stop(t1 + 0.02)
}

function fricative(ctx: Ctx, out: AudioNode, t0: number, t1: number, lo: number, hi: number, peak: number) {
  const n = ctx.createBufferSource()
  n.buffer = noise(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = lo
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = hi
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + (t1 - t0) * 0.3)
  g.gain.linearRampToValueAtTime(0, t1)
  n.connect(hp)
  hp.connect(lp)
  lp.connect(g)
  g.connect(out)
  n.start(t0, Math.random())
  n.stop(t1 + 0.01)
}

function master(ctx: Ctx) {
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 110
  const sh = ctx.createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 2.2)
  }
  sh.curve = curve
  hp.connect(sh)
  sh.connect(ctx.destination)
  return hp
}

// a brighter, female-register "aah" — closer to the classic battle-record vowel
const AH: Formant[] = [
  [920, 7, 1],
  [1350, 9, 0.6],
  [2850, 12, 0.3],
  [3900, 14, 0.14],
]

export const SAMPLES: SampleDef[] = [
  {
    id: 'ahh',
    name: 'Ahh',
    note: 'The classic long vowel — best for baby & tear scratches',
    dur: 0.78,
    file: { url: CLASSIC, start: 1.795, end: 2.83 },
    render(ctx, out) {
      voice(ctx, out, 0, 0.76, [370, 300], AH, { attack: 0.018, release: 0.22 })
      voice(ctx, out, 0.012, 0.76, [370, 300], AH, { attack: 0.03, release: 0.22, detune: 9, breath: 0.03 })
    },
  },
  {
    id: 'fresh',
    name: 'Fresh',
    note: 'Two-part word — try chirps across the “fr” and “esh”',
    dur: 0.62,
    file: { url: CLASSIC, start: 2.85, end: 3.585 },
    render(ctx, out) {
      fricative(ctx, out, 0, 0.1, 900, 3200, 0.5)
      voice(ctx, out, 0.07, 0.38, [320, 285], [
        [620, 8, 1],
        [2150, 11, 0.55],
        [2900, 12, 0.28],
      ], { attack: 0.03, release: 0.06 })
      fricative(ctx, out, 0.33, 0.62, 2200, 7500, 0.9)
    },
  },
  {
    id: 'ahh-fresh',
    name: 'Ahh → Fresh',
    note: 'The full phrase — for combos and flares across both words',
    dur: 1.42,
    file: { url: CLASSIC, start: 1.795, end: 3.585 },
    render(ctx, out) {
      // fallback: the two synth words back to back
      SAMPLES[0].render(ctx, out)
      const d = ctx.createDelay(1)
      d.delayTime.value = 0.8
      d.connect(out)
      SAMPLES[1].render(ctx, d)
    },
  },
  {
    id: 'tone',
    name: 'Tone',
    note: 'Pure test tone — hear every movement clearly',
    dur: 1.0,
    render(ctx, out) {
      const o = ctx.createOscillator()
      o.frequency.value = 740
      const o3 = ctx.createOscillator()
      o3.frequency.value = 2220
      const g3 = ctx.createGain()
      g3.gain.value = 0.12
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, 0)
      g.gain.linearRampToValueAtTime(0.5, 0.006)
      g.gain.setValueAtTime(0.5, 0.99)
      g.gain.linearRampToValueAtTime(0, 1.0)
      o.connect(g)
      o3.connect(g3)
      g3.connect(g)
      g.connect(out)
      o.start(0)
      o3.start(0)
      o.stop(1.01)
      o3.stop(1.01)
    },
  },
  {
    id: 'stab',
    name: 'Horn Stab',
    note: 'Short and punchy — for transformers and flares',
    dur: 0.46,
    render(ctx, out) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.Q.value = 2
      lp.frequency.setValueAtTime(4200, 0)
      lp.frequency.exponentialRampToValueAtTime(900, 0.4)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, 0)
      g.gain.linearRampToValueAtTime(0.9, 0.008)
      g.gain.exponentialRampToValueAtTime(0.25, 0.3)
      g.gain.linearRampToValueAtTime(0, 0.45)
      lp.connect(g)
      g.connect(out)
      for (const m of [58, 62, 65, 69, 46]) {
        for (const det of [-8, 7]) {
          const o = ctx.createOscillator()
          o.type = 'sawtooth'
          o.frequency.value = 440 * Math.pow(2, (m - 69) / 12)
          o.detune.value = det
          const a = ctx.createGain()
          a.gain.value = 0.12
          o.connect(a)
          a.connect(lp)
          o.start(0)
          o.stop(0.46)
        }
      }
    },
  },
]

export async function renderSample(def: SampleDef, sampleRate: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(def.dur * sampleRate), sampleRate)
  def.render(ctx, master(ctx))
  const buf = await ctx.startRendering()
  return normalize(buf, 0.92)
}
