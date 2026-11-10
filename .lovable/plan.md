# Free instrument identification

## What you’ll get
- Add an **Identify instruments** option to Stems & MIDI.
- Analyze an uploaded recording and show likely instruments, ranked by model score—not confirmed identifications.
- Show an honest “no clear instrument match” result when evidence is weak.
- Keep audio on the device, with progress and cancellation, using the existing free-use allowance.

## Technical approach
- Use Google’s Apache-licensed YAMNet sound classifier, downloaded from its official model distribution and served locally.
- Run classification in a terminable browser worker; examine short excerpts spread across a recording to keep processing manageable.
- Filter actual model classes to instruments; never infer instruments from detected notes.
- Add tests for score filtering and weak/no-match cases, then verify a real recording and phone/desktop layouts.

## Limits
- This is an experimental estimate: mixed songs, effects and similar-sounding instruments can confuse the model.
- Humming search and a commercially licensed lyrics catalog remain separate unfinished items.