import { engine } from './audio/engine'
import { useStore } from './store'

const st = () => useStore.getState()

export async function toggleRecord() {
  const s = st()
  if (s.recording) {
    const take = await engine.stopRecording()
    st().set({ recording: false, take: take.duration > 0.2 ? take : null, announce: 'Recording stopped' })
  } else {
    if (s.take) return // review the current take first
    engine.startRecording()
    st().set({ recording: true, recStartedAt: performance.now(), announce: 'Recording' })
  }
}

export function selectBeat(id: string) {
  engine.selectBeat(id)
  const b = st().beats.find((x) => x.id === id)
  // glide over to the beat deck to watch the new record go on, then come back
  if (b) st().set({ announce: `Beat: ${b.name}, ${b.bpm} BPM`, beatFocusUntil: performance.now() + 2600 })
}

export function selectBeatIndex(i: number) {
  const playable = st().beats.filter((b) => b.playable)
  if (playable[i]) selectBeat(playable[i].id)
}

export function selectSample(id: string) {
  engine.selectSample(id)
  const s = st().samples.find((x) => x.id === id)
  if (s) st().set({ announce: `Sample: ${s.name}` })
}

export function cycleSample(dir: 1 | -1) {
  const list = st().samples.filter((s) => s.playable)
  const i = list.findIndex((s) => s.id === engine.sampleId)
  const next = list[(i + dir + list.length) % list.length]
  if (next) selectSample(next.id)
}

export function toggleBeatPause() {
  engine.toggleBeatPause()
  st().set({ announce: engine.beatPaused ? 'Beat paused' : 'Beat playing' })
}

export function toggleMotor() {
  const on = !st().motorOn
  engine.setMotor(on)
  st().set({ announce: on ? 'Motor on' : 'Motor off' })
}

export function toggleCamera() {
  const s = st()
  s.setSettings({ camera: s.settings.camera === 'deck' ? 'room' : 'deck' })
}
