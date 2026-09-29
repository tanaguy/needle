/** 16-bit PCM stereo WAV. */
export function encodeWav(l: Float32Array, r: Float32Array, sampleRate: number): Blob {
  const n = l.length
  const buf = new ArrayBuffer(44 + n * 4)
  const v = new DataView(buf)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + n * 4, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 2, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 4, true)
  v.setUint16(32, 4, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, n * 4, true)
  let o = 44
  for (let i = 0; i < n; i++) {
    const a = Math.max(-1, Math.min(1, l[i]))
    const b = Math.max(-1, Math.min(1, r[i]))
    v.setInt16(o, a < 0 ? a * 0x8000 : a * 0x7fff, true)
    v.setInt16(o + 2, b < 0 ? b * 0x8000 : b * 0x7fff, true)
    o += 4
  }
  return new Blob([buf], { type: 'audio/wav' })
}

/** Peak envelope for drawing: `bins` values in [0,1]. */
export function peaks(data: Float32Array, bins: number): Float32Array {
  const out = new Float32Array(bins)
  const step = data.length / bins
  for (let b = 0; b < bins; b++) {
    let m = 0
    const s = Math.floor(b * step)
    const e = Math.min(data.length, Math.floor((b + 1) * step))
    for (let i = s; i < e; i++) {
      const a = data[i] < 0 ? -data[i] : data[i]
      if (a > m) m = a
    }
    out[b] = m
  }
  return out
}
