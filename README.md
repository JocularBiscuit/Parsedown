# Parsedown

**Shrink PDFs, Word documents, PowerPoint presentations, Excel spreadsheets, and images into clean, token-efficient Markdown — entirely on your machine.**

Feeding a raw PDF, Word file, slide deck, or spreadsheet into an AI assistant (ChatGPT, Claude, etc.) wastes huge amounts of **tokens** — the units these models charge for and limit context by. Parsedown converts **PDFs, Word documents, PowerPoint presentations, Excel spreadsheets, and images** into lean Markdown that says the same thing in far fewer tokens, so you:

- **pay less** per request,
- **fit more** into the model's context window, and
- get cleaner, more reliable answers from tidy input.

Every conversion shows the original size, the Markdown size, the **percent reduction**, and an **estimated token count**, so you can see the savings at a glance. It runs fully offline — no external API calls, nothing ever leaves your computer — and remembers every conversion in a local searchable history.

## Requirements

- Python 3.10 or newer
- (Optional) Tesseract OCR, only if you want to convert images — see [Supported file types](#supported-file-types).

## Install

```bash
# 1. create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate          # on Windows: venv\Scripts\activate

# 2. install dependencies
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload
```

Then open **http://127.0.0.1:8000** in your browser.

## How to use

1. Drag a file onto the drop zone (or click it to browse). Drop **several at once** for batch mode.
2. The file is converted locally and a rendered Markdown preview appears, along with a stats strip (original size, Markdown size, percent reduction, estimated token count).
3. Toggle between **Preview** (rendered) and **Raw** (Markdown source).
4. Click **Download .md** to save the result, or **Copy** to put the raw Markdown on your clipboard.
5. Every conversion is saved in the **History** sidebar on the left — click any entry to reopen it, search by filename or text, delete entries, or clear everything.

## Supported file types

- **PDF** (`.pdf`) — the primary, rock-solid path (via `pymupdf4llm`). Needs nothing extra.
- **Word** (`.docx`) — converted with the pure-Python `mammoth` library.
- **PowerPoint** (`.pptx`) — each slide's text and tables become Markdown (via `python-pptx`).
- **Excel** (`.xlsx`) — each sheet becomes a Markdown table (via `openpyxl`).
- **Images** (`.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.bmp`, `.gif`, `.webp`) — text is extracted with OCR. This reads text that's visually present in the image (scanned pages, screenshots); it does not describe pictures. OCR requires the **Tesseract** binary installed on your system:
  - macOS: `brew install tesseract`
  - Linux: `apt install tesseract-ocr`
  - Windows: use the [official installer](https://github.com/UB-Mannheim/tesseract/wiki)

  If Tesseract isn't installed, the app shows a friendly hint instead of crashing. This does **not** affect any other file type.

**Batch mode:** drop several files at once. Each becomes its own entry in the History sidebar that you can view separately (its own preview, raw view, and stats), and a **Download all (.zip)** button bundles the whole batch. A file that fails to convert is reported by name and never sinks the rest of the batch.

## Memory / history

Conversions are stored in a local SQLite database file, **`history.db`**, created automatically next to `main.py` on first run. It persists across restarts and is fully offline. To wipe it, use the **Clear** button in the sidebar, or simply delete `history.db`.

## Troubleshooting

- **`uvicorn: command not found`** — your virtual environment isn't active. Re-run `source venv/bin/activate` (or `venv\Scripts\activate` on Windows).
- **Port 8000 already in use** — run on another port: `uvicorn main:app --reload --port 8001` and open that URL.
- **"Tesseract OCR isn't installed" when converting an image** — install the Tesseract binary (see above). This does **not** affect any other file type.
- **A PDF won't convert / "could not be opened"** — it may be password-protected or corrupt. Remove the password and try again.
- **Markdown preview looks unstyled** — the renderer is vendored at `static/marked.min.js`; make sure that file is present and you're loading the page through the server (`http://127.0.0.1:8000`), not by opening the HTML file directly.
- **History sidebar is empty after converting** — make sure the app can write `history.db` in its folder (a read-only location would prevent saving).

## Project layout

```
main.py              FastAPI backend + converters + history API
static/index.html    single-page UI (dropzone, history sidebar, preview)
static/styles.css    styling (light/dark, system fonts)
static/app.js        frontend logic (drag-drop, batch, history, preview)
static/marked.min.js vendored Markdown renderer (offline)
test_app.py          end-to-end smoke test (generates sample PDF/PPTX/XLSX)
requirements.txt
history.db           local conversion history (created on first run)
```

## Testing

A small smoke test generates sample files, runs them through every converter, and checks batch conversion, history search, zip export, and the unsupported-file path:

```bash
python test_app.py
```
