# Needle — Scratch Studio

A small 3D record room in the browser for learning to scratch. Your MacBook trackpad is the record and your keyboard is the crossfader.

```bash
npm install
npm run dev      # http://localhost:5190
npm run build
```

## Playing

| Input | Does |
|---|---|
| Two-finger swipe | Move the record. Stop moving to hold it; flick and lift to let it spin. |
| Press & drag (Settings → Gesture) | Pressing puts your hand on the record, releasing lets it spin |
| `Space` (hold) | Open the fader (it rests closed) |
| `J` / `K` | Fader taps for transformers and chirps |
| `Shift` | Hamster: flips the fader |
| `Q` | Back to cue |
| `1`–`4` | Change beat |
| `[` `]` | Change sample |
| `M` | Motor on/off |
| `R` | Switch between Deck and Room views |
| `Tab` | Crate |
| `Esc` | Settings |
| `?` | Show all keys |

Recording (take review + WAV export) is built but switched off in `src/config.ts`.

All keys except `1`–`4`, `Esc` and `?` can be rebound in Settings.

The strip at the bottom is live scratch notation:
- X is time over the last two bars.
- Y is position on the record; the cue is at the bottom.
- Solid ink means the fader was open; faint means it was closed.

Add `?desktop` to the URL to skip the "made for a laptop" screen on narrow windows.

## Your own sounds

Drop files into `public/audio/user/` and list them in `manifest.json` (see the README in that folder).

## How it works

- **Audio:** `src/audio/`
  - The scratch deck is an AudioWorklet that runs a virtual record: a sub-sample playhead, a hand-follow model, motor spin-up and a sharp-cut fader.
  - Beats and samples are generated in code with `OfflineAudioContext` when the app loads.
- **Input:** `src/input/`
  - Trackpad swipes arrive as wheel events.
  - `momentum.ts` spots macOS's decaying momentum tail and treats it as your hand letting go.
- **Scene:** `src/scene/`
  - React Three Fiber diorama with flat-shaded materials, a low warm sun, N8AO contact shadows and tilt-shift.
  - The turntables and mixer are built in code. The props come from the Kenney Furniture Kit.

## Credits

- 3D props: [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) (CC0).
- Fonts: Instrument Serif, Inter and JetBrains Mono (Google Fonts, OFL).
