# Song Analyzer roadmap

- [x] Branding, logo, favicon
- [x] Dashboard
- [x] Live song identification (AudD) — needs AUDD_API_TOKEN
- [x] Identification history / library (local)
- [x] Upload, playback, key + BPM detection
- [ ] Hum to search (needs melody-recognition provider)
- [x] Free instrument separation (browser Demucs), melody notes/MIDI export, lyrics search — checked on synthetic audio and a real catalog search
- [x] Free multi-note transcription with Spotify Basic Pitch — simultaneous C4/E4 audio and MIDI download verified
- [x] Instrument identification (free YAMNet estimate in Stems & MIDI)
- [x] Chords, song structure, timeline (major/minor triads, A/B sections)
- [x] Vocoder analyzer (live band bank, mic or file, record output)
- [ ] Licensed lyrics catalog (community LRCLIB search works; commercial licensing is not verified)
- [x] Accounts (email, Google, Lovable) + library saved to account
- [x] Subscriptions + admin dashboard (roles, stats, recent subscriptions)

- [x] Checkout for Pro ($9.95/mo, 7-day trial, card up front), 3 free uses/day combined, access until period end on cancel
- [x] Policy pages (terms, refunds, privacy)
- [x] Owner free access — only the owner's account is exempt from payment; verified the limit is lifted and no use is counted
- [x] AI Style Tags — 30-second clip upload, AI style/mood/instrument tags, editable search phrase, YouTube/Spotify discovery links and saved-library matching; real signed-in model response verified
- [x] Analyze instrument visual — instrument input and streamed AI-generated musician image; real signed-in violin image verified in the preview
- [x] Personal music uploads — private account storage, library playback, favorites and deletion; real signed-in WAV upload, playback, reload persistence and deletion verified on desktop and phone layouts
- [x] Song Finder can identify your own music — pick a device file or a saved My Music song, scrub to any part, and identify the 12 seconds from there; upload, library pick and identification request verified signed-in (provider key still needs renewal)
- [ ] Activate an AudD trial or plan, replace the rejected token from dashboard.audd.io, then re-test microphone and uploaded-song identification (account currently inactive)
