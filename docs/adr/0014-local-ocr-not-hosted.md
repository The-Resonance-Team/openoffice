# 0014 — oocr reads scanned documents via a vision model, not Tesseract

`oocr` needed a backend for scanned/image-based PDFs and standalone images. The original decision was local OCR (Tesseract): offline, no per-page cost, but weak on tables, handwriting, and non-Latin scripts, and it required a separate binary install plus a language probe (`eng+vie`). Superseded during #23 implementation: the agent's own vision model reads the rasterized pages directly — the same model family that already handles everything else in the session.

Why the change: Tesseract's accuracy ceiling is a hard constraint no amount of tuning fixes, while a vision model reading the rasterized page does strictly better on tables and handwriting, with zero new dependencies (`pdftoppm` was already needed for rasterization) and zero new providers (the model comes from the same provider layer as the session model, see `llm/providers.ts`).

Privacy is now a deployment choice, not a property of the tool:

- **Default: the session model.** The document's extracted content already reaches that model via the normal `read` flow, so the OCR fallback adds no new exposure.
- **`ocr.model` override.** Deployments that must keep documents on-machine point it at a local vision model (e.g. `ollama/qwen2.5-vl`); end users and businesses that accept cloud models use the default. The daemon resolves `config.ocr?.model ?? config.model`.

## Considered options

- **Local OCR (Tesseract)**: rejected — separate binary install, language probing, weaker accuracy on tables/handwriting, and its only advantage (no upload) is recoverable by pointing `ocr.model` at a local vision model.
- **Hosted OCR API**: rejected — an extra third-party integration with its own privacy profile; the vision-model path already covers the accuracy case without a new dependency.
