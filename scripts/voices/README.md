# Voices

Every character line, grunt, hurt sound and announcer call is rendered with ElevenLabs (model `eleven_v4`, whose
audio tags like `[effort grunt]`, `[pained grunt]` and `[shouting]` give real grunts instead of words). The voices
are JRPG-style. `lines.json` is the script of record: speaker -> ElevenLabs voice id, and bank -> lines.

## Rendering

1. **Takes.** For each line, make one `creative_generate_speech` call through the ElevenLabs MCP with the speaker's
   `voice_id`, `model_id: eleven_v4` and the line as the prompt (tags included), keeping the default 2 takes.
   Poll `creative_get_flow_run_status`, then download each take (the signed URLs last 2 hours) as
   `<raw>/<speaker>/<bank>-<line index>-<take>.mp3`. Render one line per call: splitting a multi-line take at its
   silences cuts some words in two. Never re-run a call to retry, because each call is billed.
2. **Clips.** `python3 scripts/voices/finish.py <raw> <out>` trims silence, normalises loudness (-16 LUFS), and
   writes mono 32 kHz MP3s as `<out>/<speaker>/<bank>-<n>.mp3`. Grunt and hurt takes keep only their first burst
   (a take often has a breath or a second grunt after it), capped at 0.6 s (grunt), 0.7 s (hurt) and 1.2 s (hurtBig).
3. **Into the game.** Class and announcer clips replace `assets/audio/voice/<speaker>/` wholesale. For a mod skin,
   `python3 scripts/voices/skin.py <out>/<skin> mods/<mod> <skin id>` copies at most 4 clips per line into the mod
   folder and rewrites the skin's `voice` map in its `mod.json` (each clip must stay under 64 KB).

## In game

`src/engine/voice.ts` loads every bank. Heavy attacks always grunt and light attacks grunt one time in four; a grunt
never cuts off a spoken line. Hits of 80 or more say `hurt`, and 600 or more say `hurtBig`. DEV TOOLS > VOICE TEST
plays every line for each class, each voiced mod skin, and the announcer, and the Art Lab's Sounds section plays
them too.
