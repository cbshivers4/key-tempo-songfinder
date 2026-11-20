<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Browser-only audio code (Web Audio graphs, canvas drawing) lives in `src/lib`, is instantiated only inside a user gesture, and never runs at module import — SSR and prerender evaluate imports, so anything touching `AudioContext` or `document` at import time breaks the build or the first paint.
- Library storage: signed-out users save to localStorage, signed-in users to the library_songs table (RLS per user); local songs move into the account on sign-in — keeps the app usable without an account.
- Stems and melody processing run locally from user gestures; Demucs runs in a terminable single-thread WASM worker to avoid blocking the page or requiring cross-origin isolation that disrupts checkout. Lyrics use a validated LRCLIB server function without storing lyrics or claiming catalog licensing.
- WASM binaries are URL-loaded only after a user gesture, never imported into source; oversized binaries use hosted asset pointers under public/wasm with the version-matched loader, keeping deployment bundles and repository files within platform limits.
- Multi-note transcription uses Basic Pitch in a terminable CPU worker with locally served model files; retain single-melody mode for faster lightweight analysis and never treat inferred notes as instrument identification.
- Instrument identification uses locally served YAMNet in a terminable CPU worker and reports ranked model scores as estimates, with a no-match result below a minimum score — never present them as confirmed identifications.

- Free-use limits are enforced by the service-only consume_use_for function called from server functions, with the payments environment taken from the build, never the browser — stops users raising their own limit or using test subscriptions on the live site. Analyze/Vocoder gates stay client-side; signed-out counts live in localStorage.
- Checkout price is chosen server-side (getCheckoutPrice): accounts with any prior subscription get the no-trial price — enforces one free trial per account.
- AI Style Tags uses an authenticated server function and Lovable AI Gateway with an audio-capable model; clips are trimmed to 30 seconds and converted to WAV only after a user gesture, are never stored, and use a fresh per-request gateway provider with no automatic retries.