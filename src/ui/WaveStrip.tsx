import { useEffect, useRef } from 'react'
import { deck, engine } from '../audio/engine'
import { peaks } from '../audio/wav'
import { useStore } from '../store'
import { UI } from '../palette'

const H = 124
const LEFT = 64 // sample-waveform column
const WINDOW_BEATS = 8

/**
 * Scratch notation, live. X = time (last two bars, beat grid), Y = position on the
 * record (cue at the bottom, forward = up). Solid ink = fader open, faint = closed.
 */
export function WaveStrip() {
  const ref = useRef<HTMLCanvasElement>(null)
  const sampleId = useStore((s) => s.settings.sampleId)

  useEffect(() => {
    const cv = ref.current!
    const g = cv.getContext('2d')!
    let raf = 0
    let w = 0
    let dpr = 1
    let pk: Float32Array | null = null
    let dur = 1
    let pkFor = ''

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = cv.clientWidth
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(H * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cv)

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const ctx = engine.ctx
      if (!ctx) return
      const buf = engine.sampleBuffer()
      if (buf && pkFor !== engine.sampleId) {
        pk = peaks(buf.getChannelData(0), 160)
        dur = buf.duration
        pkFor = engine.sampleId
      }

      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, H)

      const top = 12
      const bot = H - 18
      const pad = 0.12
      const yMin = -pad
      const yMax = dur + pad
      const yOf = (rel: number) => bot - ((rel - yMin) / (yMax - yMin)) * (bot - top)

      // ── sample column: the record's content, laid on its side
      if (pk) {
        g.fillStyle = 'rgba(27,26,23,0.22)'
        const cx = LEFT / 2
        for (let i = 0; i < pk.length; i++) {
          const rel = (i / pk.length) * dur
          const y = yOf(rel)
          const hw = Math.max(0.5, pk[i] * (LEFT / 2 - 10))
          g.fillRect(cx - hw, y - 0.5, hw * 2, 1)
        }
      }
      // cue line
      g.strokeStyle = UI.accent
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(8, yOf(0))
      g.lineTo(LEFT - 8, yOf(0))
      g.stroke()
      g.fillStyle = UI.muted
      g.font = '500 9px Inter, sans-serif'
      g.fillText('CUE', 8, yOf(0) + 12)

      // divider
      g.fillStyle = UI.faint
      g.fillRect(LEFT, top - 4, 1, bot - top + 8)

      // ── time grid
      const x0 = LEFT + 14
      const x1 = w - 18
      const spb = 60 / engine.bpm
      const winT = WINDOW_BEATS * spb
      const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
      const now = ctx.currentTime - lat
      const xOf = (t: number) => x1 - ((now - t) / winT) * (x1 - x0)

      const bNow = (now - engine.beatT0) / spb
      g.font = '400 9px "JetBrains Mono", monospace'
      for (let b = Math.floor(bNow - WINDOW_BEATS); b <= Math.floor(bNow); b++) {
        if (b < 0) continue
        const x = xOf(engine.beatT0 + b * spb)
        if (x < x0) continue
        const bar = b % 4 === 0
        g.fillStyle = bar ? 'rgba(27,26,23,0.22)' : 'rgba(27,26,23,0.08)'
        g.fillRect(Math.round(x), top, 1, bot - top)
        if (bar) {
          g.fillStyle = UI.muted
          g.fillText(String(Math.floor(b / 4) + 1), Math.round(x) + 4, H - 5)
        }
      }
      // cue reference line across the trail
      g.fillStyle = 'rgba(200,100,59,0.28)'
      g.fillRect(x0, Math.round(yOf(0)), x1 - x0, 1)

      // ── trail
      const n = deck.hCount
      if (n > 1 && engine.started) {
        const L = deck.loopLen
        const gapHalf = (L - dur) / 2
        const relOf = (p: number) => {
          const k = Math.floor((p - deck.lead + gapHalf) / L)
          return p - (k * L + deck.lead)
        }
        const start = (deck.hHead - n + deck.hT.length) % deck.hT.length
        let px = 0
        let py = 0
        let prevRel = 0
        let prevOpen = false
        let have = false
        g.lineCap = 'round'
        g.lineJoin = 'round'
        for (let j = 0; j < n; j++) {
          const i = (start + j) % deck.hT.length
          const t = deck.hT[i]
          if (now - t > winT + 0.1) continue
          const rel = relOf(deck.hPos[i])
          const x = xOf(t)
          const y = yOf(Math.max(yMin, Math.min(yMax, rel)))
          const open = deck.hFader[i] > 0.5
          if (have && Math.abs(rel - prevRel) < L / 2) {
            const on = open || prevOpen
            g.strokeStyle = on ? UI.ink : 'rgba(27,26,23,0.2)'
            g.lineWidth = on ? 2.2 : 1.2
            g.beginPath()
            g.moveTo(px, py)
            g.lineTo(x, y)
            g.stroke()
          }
          px = x
          py = y
          prevRel = rel
          prevOpen = open
          have = true
        }
        if (have) {
          // playhead
          g.fillStyle = UI.accent
          g.beginPath()
          g.arc(px, py, 3.5, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = 'rgba(200,100,59,0.35)'
          g.fillRect(LEFT - 10, py - 0.5, 10, 1)
        }
      }
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [sampleId])

  return <canvas ref={ref} className="wavestrip" style={{ width: '100%', height: H, display: 'block' }} aria-label="Scratch trail: your record movement over the last two bars" role="img" />
}
