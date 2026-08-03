# 0014 — oocr uses local OCR (Tesseract), not a hosted API

`oocr` needed a backend for scanned/image-based PDFs and standalone images. The choice was a real tradeoff, put directly to the user rather than picked by default: local OCR (Tesseract or equivalent) runs offline, no per-page cost, but is weaker on tables and handwriting than hosted options; a hosted OCR API is more accurate but means a local-first tool uploads document content — potentially sensitive, since this tool exists to edit users' own documents — to a third party.

Resolved: local. This keeps `oocr` consistent with `map.md`'s local-first, no-cloud-infrastructure stance, which every other document-handling tool in this codebase already honors (officecli, soffice, pdftotext/pdf-inspector all run against the local filesystem, nothing leaves the machine). A future reader wondering "why not just call a hosted OCR API for better accuracy" should read this as the answer: it was considered, and rejected specifically because of what this tool touches — arbitrary user documents, not disposable input.

## Considered options

- **Hosted OCR API**: rejected — meaningfully better accuracy, but requires sending document content off-machine, which no other part of this codebase does and which the user explicitly did not want to reopen.
- **Both, config-selectable**: not pursued for v1 — doubles the implementation and testing surface (two backends, two failure modes) for a choice that's already been made. Revisit only if local OCR quality proves insufficient in practice.
