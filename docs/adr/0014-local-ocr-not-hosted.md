# 0014 — oocr reads scanned documents via the session model, not Tesseract

`oocr` needed a backend for scanned/image-based PDFs and standalone images. The original decision was local OCR (Tesseract): offline, no per-page cost, but weak on tables, handwriting, and non-Latin scripts, and it required a separate binary install plus a language probe (`eng+vie`). Superseded during #23 implementation: the session model itself reads the rasterized pages natively — the same model that already handles everything else in the session.

Why the change: Tesseract's accuracy ceiling is a hard constraint no amount of tuning fixes, while a vision model reading the rasterized page does strictly better on tables and handwriting, with zero new dependencies (`pdftoppm` was already needed for rasterization) and zero new providers (the model comes from the same provider layer as the session model, see `llm/providers.ts`).

Privacy follows the session model, not a separate OCR config:

- OCR always uses the **session model** — the daemon resolves `config.model` (see `daemon.ts`). The user configures exactly one model, and the OCR fallback rides it natively.
- The document's extracted content already reaches that model via the normal `read` flow, so the OCR fallback adds **no new exposure**.
- A user who must keep documents on-machine simply points the session model at a local vision model (e.g. `ollama/qwen2.5-vl`) — the same choice they would make for the whole session anyway.

A separate `ocr.model` knob was considered and rejected: it would force users to configure and credential two models at once, when the session model is already the correct choice for OCR in every case that matters.

## Considered options

- **Local OCR (Tesseract)**: rejected — separate binary install, language probing, weaker accuracy on tables/handwriting, and its only advantage (no upload) is recoverable by choosing a local session model.
- **Hosted OCR API**: rejected — an extra third-party integration with its own privacy profile; the vision-model path already covers the accuracy case without a new dependency.
- **Separate `ocr.model` config**: rejected — a second model to configure and credential for a gain that only materializes in the rare case of a text-only session model.
