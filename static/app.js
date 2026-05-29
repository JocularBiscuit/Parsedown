// Parsedown frontend — plain JS, no build step, no frameworks.

(() => {
  "use strict";

  // ---- Elements -----------------------------------------------------------
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const statusEl = document.getElementById("status");
  const results = document.getElementById("results");
  const resultName = document.getElementById("result-name");
  const resultType = document.getElementById("result-type");
  const renderedEl = document.getElementById("preview-rendered");
  const rawEl = document.querySelector("#preview-raw code");
  const rawPre = document.getElementById("preview-raw");
  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");
  const viewRendered = document.getElementById("view-rendered");
  const viewRaw = document.getElementById("view-raw");
  const themeToggle = document.getElementById("theme-toggle");

  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const historySearch = document.getElementById("history-search");
  const clearHistoryBtn = document.getElementById("clear-history");

  const batchBar = document.getElementById("batch-bar");
  const batchText = document.getElementById("batch-text");
  const downloadAllBtn = document.getElementById("download-all");

  // The conversion currently shown in the main pane.
  let current = { id: null, markdown: "", name: "output.md" };
  // Ids of the files from the most recent batch (for "Download all").
  let lastBatchIds = [];

  // ---- Theme toggle: auto -> light -> dark, persisted ---------------------
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("parsedown-theme");
  if (savedTheme) root.setAttribute("data-theme", savedTheme);

  themeToggle.addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    const cur = root.getAttribute("data-theme") || "auto";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    root.setAttribute("data-theme", next);
    localStorage.setItem("parsedown-theme", next);
  });

  // ---- Helpers ------------------------------------------------------------
  function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function shortTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleString([], {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  function showStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = `status ${kind || ""}`.trim();
    statusEl.hidden = false;
  }
  function clearStatus() {
    statusEl.hidden = true;
    statusEl.textContent = "";
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function setStats(stats) {
    document.getElementById("stat-orig").textContent = humanSize(stats.original_size);
    document.getElementById("stat-out").textContent = humanSize(stats.output_size);
    document.getElementById("stat-red").textContent = `${stats.reduction_pct}%`;
    document.getElementById("stat-tok").textContent =
      stats.est_tokens.toLocaleString();
  }

  // ---- Render a single conversion into the main pane ----------------------
  function renderResult(data) {
    current.id = data.id ?? null;
    current.markdown = data.markdown;
    current.name = (data.filename || "output").replace(/\.[^.]+$/, "") + ".md";

    resultName.textContent = data.filename || "Converted file";
    resultName.title = data.filename || "";
    resultType.textContent = data.filetype || "";
    setStats(data.stats);

    renderedEl.innerHTML = window.marked
      ? window.marked.parse(data.markdown)
      : `<pre>${escapeHtml(data.markdown)}</pre>`;
    rawEl.textContent = data.markdown;

    showRendered();
    results.hidden = false;
    markActive(current.id);
  }

  // ---- View toggle --------------------------------------------------------
  function showRendered() {
    renderedEl.hidden = false;
    rawPre.hidden = true;
    viewRendered.classList.add("active");
    viewRaw.classList.remove("active");
  }
  function showRaw() {
    renderedEl.hidden = true;
    rawPre.hidden = false;
    viewRaw.classList.add("active");
    viewRendered.classList.remove("active");
  }
  viewRendered.addEventListener("click", showRendered);
  viewRaw.addEventListener("click", showRaw);

  // ---- Copy / download ----------------------------------------------------
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(current.markdown);
      const orig = copyBtn.textContent;
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = orig), 1200);
    } catch {
      showStatus("Couldn't access the clipboard.", "error");
    }
  });

  downloadBtn.addEventListener("click", () => {
    triggerDownload(
      new Blob([current.markdown], { type: "text/markdown" }),
      current.name
    );
  });

  downloadAllBtn.addEventListener("click", async () => {
    if (!lastBatchIds.length) return;
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: lastBatchIds }),
      });
      if (!res.ok) throw new Error();
      triggerDownload(await res.blob(), "parsedown.zip");
    } catch {
      showStatus("Could not build the zip.", "error");
    }
  });

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- History sidebar ----------------------------------------------------
  async function loadHistory(query) {
    const url = "/api/history" + (query ? `?q=${encodeURIComponent(query)}` : "");
    try {
      const res = await fetch(url);
      const data = await res.json();
      renderHistory(data.items || []);
    } catch {
      // Sidebar is non-critical; fail quietly.
    }
  }

  function renderHistory(items) {
    historyList.innerHTML = "";
    historyEmpty.hidden = items.length > 0;
    for (const item of items) {
      const li = document.createElement("li");
      li.className = "history-item";
      li.dataset.id = item.id;
      li.innerHTML = `
        <div class="hi-top">
          <span class="hi-name" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</span>
          <span class="badge">${escapeHtml(item.filetype)}</span>
        </div>
        <div class="hi-meta">${shortTime(item.created_at)} · ~${item.stats.est_tokens.toLocaleString()} tokens</div>
        <button class="hi-del" title="Delete" aria-label="Delete">×</button>
      `;
      li.addEventListener("click", (e) => {
        if (e.target.classList.contains("hi-del")) return;
        openHistoryItem(item.id);
      });
      li.querySelector(".hi-del").addEventListener("click", (e) => {
        e.stopPropagation();
        deleteHistoryItem(item.id);
      });
      historyList.appendChild(li);
    }
    markActive(current.id);
  }

  function markActive(id) {
    historyList.querySelectorAll(".history-item").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.id) === Number(id));
    });
  }

  async function openHistoryItem(id) {
    try {
      const res = await fetch(`/api/history/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      clearStatus();
      batchBar.hidden = true;
      renderResult(data);
      results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch {
      showStatus("Could not load that item.", "error");
    }
  }

  async function deleteHistoryItem(id) {
    try {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (Number(current.id) === Number(id)) {
        results.hidden = true;
        current = { id: null, markdown: "", name: "output.md" };
      }
      lastBatchIds = lastBatchIds.filter((x) => x !== id);
      loadHistory(historySearch.value.trim());
    } catch {
      showStatus("Could not delete that item.", "error");
    }
  }

  clearHistoryBtn.addEventListener("click", async () => {
    if (!confirm("Delete all saved conversions? This cannot be undone.")) return;
    try {
      await fetch("/api/history/clear", { method: "POST" });
      results.hidden = true;
      batchBar.hidden = true;
      current = { id: null, markdown: "", name: "output.md" };
      lastBatchIds = [];
      loadHistory("");
    } catch {
      showStatus("Could not clear history.", "error");
    }
  });

  // Debounced search.
  let searchTimer = null;
  historySearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadHistory(historySearch.value.trim()), 200);
  });

  // ---- Conversion requests ------------------------------------------------
  async function convertSingle(file) {
    clearStatus();
    results.hidden = true;
    batchBar.hidden = true;
    showStatus(`Converting ${file.name}…`, "loading");

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/convert", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        showStatus(data.error || "Conversion failed.", "error");
        return;
      }
      clearStatus();
      lastBatchIds = [];
      renderResult(data);
      loadHistory(historySearch.value.trim());
      results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch {
      showStatus("Could not reach the local server.", "error");
    }
  }

  async function convertBatch(files) {
    clearStatus();
    results.hidden = true;
    batchBar.hidden = true;
    showStatus(`Converting ${files.length} files…`, "loading");

    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    try {
      const res = await fetch("/api/convert-batch", { method: "POST", body: fd });
      if (!res.ok) {
        showStatus("Batch conversion failed.", "error");
        return;
      }
      const data = await res.json();
      const items = data.results || [];
      const ok = items.filter((r) => !r.error);
      const failed = items.filter((r) => r.error);
      lastBatchIds = ok.map((r) => r.id);

      clearStatus();
      await loadHistory(historySearch.value.trim());

      // Show the first successful result, if any.
      if (ok.length) renderResult(ok[0]);
      else results.hidden = true;

      // Batch summary bar.
      let msg = `Converted ${ok.length} file${ok.length === 1 ? "" : "s"}.`;
      if (failed.length) {
        msg += ` ${failed.length} failed: ` +
          failed.map((f) => f.filename).join(", ") + ".";
      }
      msg += " Click any item in History to view it.";
      batchText.textContent = msg;
      downloadAllBtn.style.display = ok.length ? "" : "none";
      batchBar.hidden = false;
    } catch {
      showStatus("Could not reach the local server.", "error");
    }
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (files.length === 1) convertSingle(files[0]);
    else convertBatch(files);
  }

  // ---- Drag & drop + click ------------------------------------------------
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
    fileInput.value = ""; // allow re-selecting the same file
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === "dragleave" && dropzone.contains(e.relatedTarget)) return;
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // ---- Paste (⌘V) ---------------------------------------------------------
  // Paste a screenshot/image or a file copied in Finder straight into the app.
  const PASTE_EXT = {
    "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp",
    "image/tiff": "tiff", "application/pdf": "pdf",
  };

  function namedPasteFile(blob, idx) {
    // Keep a real filename if the clipboard gave one with an extension.
    if (blob.name && /\.[a-z0-9]+$/i.test(blob.name)) return blob;
    const ext = PASTE_EXT[blob.type] || "png";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const suffix = idx ? `-${idx}` : "";
    return new File([blob], `pasted-${stamp}${suffix}.${ext}`, { type: blob.type });
  }

  document.addEventListener("paste", (e) => {
    // Don't hijack paste while typing in the search box.
    if (document.activeElement === historySearch) return;

    const dt = e.clipboardData;
    if (!dt) return;

    let files = [];
    if (dt.files && dt.files.length) {
      files = Array.from(dt.files);
    } else if (dt.items && dt.items.length) {
      for (const item of dt.items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
    }

    if (!files.length) return; // plain text etc. — let the browser handle it
    e.preventDefault();
    handleFiles(files.map((f, i) => namedPasteFile(f, i)));
  });

  // ---- Init ---------------------------------------------------------------
  loadHistory("");
})();
