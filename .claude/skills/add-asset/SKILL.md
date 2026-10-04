---
name: add-asset
description: Find, license-check and import a third-party asset (3D model, particle texture, skybox, sound, music, font, UI) into the Cocos project and record it in Credits. Use when the game needs new graphics or audio, or when asked «найди модель», «подбери звук», «добавь музыку», «какие есть корабли», «подбери ассеты».
---

# Add asset

Rules live in `docs/ASSETS.md` — read it first (candidate list, allowed licenses, import pipeline, Credits table).

## 1. Propose, the user picks

- Start from candidates already listed in `docs/ASSETS.md`; search further only if they don't fit.
- Offer 2–4 options: link, what's inside, license, why it fits (style: low-poly 3D, dark space, emissive accents; criteria: free + most impressive).
- Wait for the user's choice. Without it only engine primitives may be used as placeholders.

## 2. Verify the license on the source page

Allowed: CC0, Unlicense, Public Domain, Pixabay License, Mixkit Free License, SIL OFL (fonts); CC-BY with attribution.
Reject: NC, ND, "personal use only", unclear or missing license, rips from other games.

## 3. Download and prepare (outside the repo)

- Download into the scratchpad directory, unpack, pick only the files actually needed — never commit whole packs.
- Models: glTF/glb, nose along −Z, pivot centered, scale per pipeline (player ship ≈ 1 unit), check triangle budget (ARCHITECTURE §13).
- Textures ≤ 1024², PNG. Audio → `.mp3`, SFX mono and short.

## 4. Import

- Copy into `game/assets/<models|textures|audio|fonts>/<source>/…`.
- Let the editor import it (cocos MCP asset refresh, or ask the user to focus the editor) so `.meta` files are generated; commit the asset together with its `.meta`.
- Replace pack materials with project materials (shared palette + emissive) so packs from different authors look consistent.

## 5. Record

- Add a row to **Credits** in `docs/ASSETS.md` (asset, author, source URL, license, path in project).
- Flip the candidate's status to ✅ (or ❌ with a reason).
- CC-BY assets also go to the in-game Credits screen (stage 6).
