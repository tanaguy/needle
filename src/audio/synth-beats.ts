import { bass, bus, clap, crackle, hat, keys, kick, normalize, note, rim, shaker, snare, type Ctx } from './synth-kit'

export type BeatDef = {
  id: string
  name: string
  bpm: number
  style: string
  bars: number
  swing: number // 0.5 = straight, 0.66 = triplet feel (applies to odd 16ths)
  render: (ctx: Ctx, out: AudioNode, at: (bar: number, step: number) => number, step: number) => void
}

const has = (steps: number[], s: number) => steps.includes(s)

export const BEATS: BeatDef[] = [
  {
    id: 'boom-bap',
    name: 'Boom Bap',
    bpm: 90,
    style: 'Dusty kick, fat snare, walking bass',
    bars: 4,
    swing: 0.6,
    render(ctx, out, at, step) {
      const bassLine: [number, number, number, number][] = [
        // bar, step, len(steps), midi
        [0, 0, 5, 38], [0, 7, 2, 38], [0, 10, 5, 41],
        [1, 0, 5, 36], [1, 7, 2, 36], [1, 10, 4, 43],
        [2, 0, 5, 34], [2, 7, 2, 34], [2, 10, 5, 38],
        [3, 0, 5, 33], [3, 6, 3, 33], [3, 10, 3, 36], [3, 13, 3, 37],
      ]
      for (let b = 0; b < 4; b++) {
        for (let s = 0; s < 16; s++) {
          const t = at(b, s)
          const kicks = b % 2 === 0 ? [0, 7, 10] : [0, 3, 10, 11]
          if (has(kicks, s)) kick(ctx, out, t, s === 0 ? 1 : 0.85)
          if (s === 4 || s === 12) snare(ctx, out, t, 1, { decay: 0.22 })
          if (b % 2 === 1 && s === 15) snare(ctx, out, t, 0.25, { decay: 0.08 })
          if (s % 2 === 0) hat(ctx, out, t, s % 4 === 0 ? 0.9 : 0.55)
          else if (s === 13 && b === 3) hat(ctx, out, t, 0.4)
          if (b === 3 && s === 14) hat(ctx, out, t, 0.5, true)
        }
      }
      for (const [b, s, len, m] of bassLine) bass(ctx, out, at(b, s), len * step * 0.95, note(m), 0.9)
      crackle(ctx, out, at(4, 0) + 0.2, 4, 0.5)
    },
  },
  {
    id: 'lofi',
    name: 'Late Tape',
    bpm: 84,
    style: 'Soft rim, warm chords, crackle',
    bars: 4,
    swing: 0.64,
    render(ctx, out, at, step) {
      const chords = [
        [50, 53, 57, 60, 64], // Dm9
        [43, 55, 58, 62, 65], // Gm9-ish
        [46, 57, 58, 62, 65], // Bbmaj7
        [45, 55, 60, 64, 67], // Am7
      ]
      for (let b = 0; b < 4; b++) {
        keys(ctx, out, at(b, 0) + 0.012, step * 14, chords[b].slice(1).map(note), 1)
        bass(ctx, out, at(b, 0), step * 6, note(chords[b][0] - 12), 0.8)
        bass(ctx, out, at(b, 10), step * 4, note(chords[b][0] - 12), 0.6)
        for (let s = 0; s < 16; s++) {
          const t = at(b, s)
          const kicks = b === 3 ? [0, 3, 9] : [0, 9]
          if (has(kicks, s)) kick(ctx, out, t, 0.8, { hi: 95, lo: 42, decay: 0.35 })
          if (s === 4 || s === 12) rim(ctx, out, t, 1)
          if (s === 12) snare(ctx, out, t, 0.35, { decay: 0.14, bright: 1500 })
          if (s % 2 === 0) hat(ctx, out, t, s % 4 === 2 ? 0.6 : 0.35)
        }
      }
      crackle(ctx, out, at(4, 0) + 0.2, 9, 1)
    },
  },
  {
    id: 'breaks',
    name: 'Breaks',
    bpm: 100,
    style: 'Busy kick, ghost notes, open hats',
    bars: 4,
    swing: 0.54,
    render(ctx, out, at) {
      for (let b = 0; b < 4; b++) {
        for (let s = 0; s < 16; s++) {
          const t = at(b, s)
          const kicks = b % 2 === 0 ? [0, 2, 10] : [0, 6, 10, 11]
          if (has(kicks, s)) kick(ctx, out, t, s === 0 ? 1 : 0.8, { hi: 130, lo: 50, decay: 0.3 })
          if (s === 4 || s === 12) snare(ctx, out, t, 1, { decay: 0.16, bright: 2300, tone: 210 })
          if (has([7, 9, 15], s)) snare(ctx, out, t, 0.22, { decay: 0.06, bright: 2300, tone: 210 })
          if (!(b === 3 && s === 14)) hat(ctx, out, t, s % 2 === 0 ? 0.7 : 0.35)
          else hat(ctx, out, t, 0.6, true)
        }
      }
    },
  },
  {
    id: 'minimal',
    name: 'Practice',
    bpm: 95,
    style: 'Kick, clap, shaker — room to cut',
    bars: 2,
    swing: 0.56,
    render(ctx, out, at) {
      for (let b = 0; b < 2; b++) {
        for (let s = 0; s < 16; s++) {
          const t = at(b, s)
          if (has([0, 10], s)) kick(ctx, out, t, 0.95)
          if (s === 4 || s === 12) clap(ctx, out, t, 1)
          shaker(ctx, out, t, s % 4 === 2 ? 1 : 0.55)
        }
      }
    },
  },
]

export async function renderBeat(def: BeatDef, sampleRate: number): Promise<AudioBuffer> {
  const beat = 60 / def.bpm
  const step = beat / 4
  const len = def.bars * 4 * beat
  // render one extra bar and fold the tail back so the loop point is seamless
  const tail = 1.2
  const ctx = new OfflineAudioContext(1, Math.ceil((len + tail) * sampleRate), sampleRate)
  const out = bus(ctx)
  const at = (bar: number, s: number) => {
    const swingOff = s % 2 === 1 ? (def.swing - 0.5) * 2 * step : 0
    return bar * 4 * beat + s * step + swingOff
  }
  def.render(ctx, out, at, step)
  const raw = await ctx.startRendering()
  const loopN = Math.round(len * sampleRate)
  const res = new AudioBuffer({ length: loopN, numberOfChannels: 1, sampleRate })
  const src = raw.getChannelData(0)
  const dst = res.getChannelData(0)
  dst.set(src.subarray(0, loopN))
  for (let i = loopN; i < src.length; i++) dst[i - loopN] += src[i]
  return normalize(res, 0.85)
}
