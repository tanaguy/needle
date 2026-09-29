# Your crate

Drop your own CC0 / royalty-free loops and scratch samples in this folder,
then list them in `manifest.json`:

```json
{
  "beats": [
    { "file": "my-boom-bap-90.wav", "name": "Dusty 90", "bpm": 90 }
  ],
  "samples": [
    { "file": "ahh.wav", "name": "Ahh (real)" }
  ]
}
```

- Beats should be seamless loops; `bpm` sets the beat grid.
- Samples are placed on the record at the cue sticker.
- One file can hold several samples — cut them with `start` / `end` in seconds:
  `{ "file": "ahh-fresh.mp3", "name": "Ahh", "start": 0.0, "end": 0.9 }`
- Files in this folder are git-ignored, so classic record samples stay on your machine.
- Good sources: Freesound (filter by CC0), Looperman, Sample Focus, Pixabay.
