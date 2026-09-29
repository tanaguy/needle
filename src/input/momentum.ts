// macOS keeps emitting wheel events after the fingers leave the trackpad ("momentum").
// Those events shrink smoothly and geometrically. A human hand slowing down does not —
// it's jittery and short. We look for that smooth geometric tail and call it a release.

export type WheelVerdict = 'touch' | 'release' | 'ignore'

const DECAY_RUN = 5 // consecutive shrinking events needed
const RATIO_MIN = 0.78
const RATIO_MAX = 0.985
const RATIO_SPREAD = 0.09 // how consistent the shrink ratio must be
const MIN_PEAK = 6 // px — slow nudges never count as a fling
const GESTURE_GAP = 110 // ms of silence = a new gesture

export class MomentumFilter {
  private state: 'touch' | 'momentum' = 'touch'
  private hist: number[] = []
  private lastT = -1e9
  private lastD = 0

  reset() {
    this.state = 'touch'
    this.hist = []
    this.lastD = 0
  }

  push(d: number, t: number): WheelVerdict {
    const gap = t - this.lastT
    this.lastT = t

    if (this.state === 'momentum') {
      const same = Math.sign(d) === Math.sign(this.lastD)
      const shrinking = Math.abs(d) <= Math.abs(this.lastD) * 1.08 + 0.5
      if (gap < GESTURE_GAP && same && shrinking) {
        this.lastD = d
        return 'ignore'
      }
      this.reset()
    }

    if (gap > GESTURE_GAP) this.hist = []
    this.hist.push(d)
    if (this.hist.length > 12) this.hist.shift()
    this.lastD = d

    if (this.isDecayTail()) {
      this.state = 'momentum'
      return 'release'
    }
    return 'touch'
  }

  private isDecayTail(): boolean {
    const h = this.hist
    if (h.length < DECAY_RUN + 1) return false
    const tail = h.slice(-(DECAY_RUN + 1))
    const s = Math.sign(tail[0])
    if (s === 0 || tail.some((v) => Math.sign(v) !== s)) return false
    const a = tail.map(Math.abs)
    if (a[0] < MIN_PEAK) return false
    const ratios: number[] = []
    for (let i = 1; i < a.length; i++) {
      if (a[i] >= a[i - 1]) return false
      ratios.push(a[i] / a[i - 1])
    }
    const lo = Math.min(...ratios)
    const hi = Math.max(...ratios)
    return lo >= RATIO_MIN && hi <= RATIO_MAX && hi - lo <= RATIO_SPREAD
  }
}
