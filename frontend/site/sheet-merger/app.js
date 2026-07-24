/* ═══════════════════════════════════════════
   Sheet Merger — combine Excel sheets & flag duplicates
   Runs entirely in the browser (xlsx-js-style).
   ═══════════════════════════════════════════ */

(function () {
  "use strict";

  /* ---------- State ---------- */
  const state = {
    files: [],          // { id, name, headers, rows, error }  rows = array of {colName: value}
    canonical: [],      // ordered master column list (union)
    combined: [],       // [{ __file, __idx, cells:{}, key, isDup, isFirst }]
    keyCols: [],        // selected columns used for duplicate detection
    options: { normalize: true, source: true, flag: true, renumber: true, onlyDupes: false },
    stats: { total: 0, dupes: 0, unique: 0 },
  };

  let fileSeq = 0;

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const dropZone = $("drop-zone");
  const fileInput = $("file-input");
  const fileListWrap = $("file-list-wrap");
  const fileListEl = $("file-list");
  const fileCountEl = $("file-count");
  const totalsRow = $("totals-row");
  const btnToReview = $("btn-to-review");

  /* ═══════════ STEP NAV ═══════════ */
  function goToStep(n) {
    document.querySelectorAll(".step-panel").forEach((p) => p.classList.remove("active"));
    $("panel-" + n).classList.add("active");
    document.querySelectorAll(".step-item").forEach((el) => {
      const s = +el.dataset.step;
      el.classList.toggle("active", s === n);
      el.classList.toggle("completed", s < n);
    });
    document.querySelectorAll(".step-connector").forEach((c, i) => c.classList.toggle("filled", i < n - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ═══════════ TOAST ═══════════ */
  let toastTimer;
  function toast(msg, kind) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast show " + (kind || "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("show"); }, 3200);
  }

  /* ═══════════ FILE READING ═══════════ */
  const HEADER_TOKENS = ["SR_NO", "CHASSIS", "REG_NUMBER", "ENGINE_NO", "VEHICLE_MAKE", "DEVICE_IMEI", "ICCID"];

  function looksLikeHeader(row) {
    const joined = row.map((c) => String(c == null ? "" : c).toUpperCase()).join("|");
    let hits = 0;
    HEADER_TOKENS.forEach((tok) => { if (joined.includes(tok)) hits++; });
    return hits >= 2;
  }

  function cleanCell(v) {
    if (v == null) return "";
    if (v instanceof Date) {
      // yyyy-mm-dd, avoids timezone drift on export
      const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, "0"), d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return String(v).trim();
  }

  function isBlankRow(cellsArr) {
    return cellsArr.every((c) => c === "" || c == null);
  }

  function ensureCanonical(headers) {
    headers.forEach((h) => {
      if (h !== "" && state.canonical.indexOf(h) === -1) state.canonical.push(h);
    });
  }

  function parseWorkbook(arrayBuffer, fileName) {
    const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("No sheet found");
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false, defval: "" });
    if (!aoa.length) throw new Error("Sheet is empty");

    let headers, dataRows;
    if (looksLikeHeader(aoa[0])) {
      headers = aoa[0].map((h) => cleanCell(h));
      dataRows = aoa.slice(1);
    } else {
      // headerless: align by position to the canonical template if we have one
      headers = null;
      dataRows = aoa;
    }

    // Resolve the column names for this file
    let colNames;
    if (headers) {
      colNames = headers.map((h, i) => (h === "" ? `Column ${i + 1}` : h));
    } else {
      // Use canonical positions if available, otherwise generic
      const width = Math.max.apply(null, dataRows.map((r) => r.length));
      colNames = [];
      for (let i = 0; i < width; i++) {
        colNames.push(state.canonical[i] || `Column ${i + 1}`);
      }
    }
    ensureCanonical(colNames);

    const rows = [];
    dataRows.forEach((r) => {
      const cellsArr = colNames.map((_, i) => cleanCell(r[i]));
      if (isBlankRow(cellsArr)) return;
      const obj = {};
      colNames.forEach((name, i) => { obj[name] = cellsArr[i]; });
      rows.push(obj);
    });

    return { headers: colNames, rows };
  }

  function readFile(file) {
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const { headers, rows } = parseWorkbook(fr.result, file.name);
          resolve({ id: ++fileSeq, name: file.name, headers, rows, error: null });
        } catch (e) {
          resolve({ id: ++fileSeq, name: file.name, headers: [], rows: [], error: e.message || "Could not read file" });
        }
      };
      fr.onerror = () => resolve({ id: ++fileSeq, name: file.name, headers: [], rows: [], error: "Could not read file" });
      fr.readAsArrayBuffer(file);
    });
  }

  async function addFiles(fileList) {
    const arr = Array.from(fileList).filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (!arr.length) { toast("Please choose .xlsx, .xls or .csv files", "err"); return; }
    for (const f of arr) {
      const parsed = await readFile(f);
      state.files.push(parsed);
    }
    renderFileList();
  }

  /* ═══════════ FILE LIST UI ═══════════ */
  function renderFileList() {
    fileListWrap.hidden = state.files.length === 0;
    fileListEl.innerHTML = "";
    let totalRows = 0, goodFiles = 0;

    state.files.forEach((f) => {
      const li = document.createElement("li");
      li.className = "file-item" + (f.error ? " bad" : "");
      const okIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      const errIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      const sub = f.error
        ? `<span class="file-sub err">${escapeHtml(f.error)}</span>`
        : `<span class="file-sub">${f.rows.length} row${f.rows.length === 1 ? "" : "s"} · ${f.headers.length} columns</span>`;
      li.innerHTML =
        `<span class="file-ic">${f.error ? errIcon : okIcon}</span>` +
        `<span class="file-meta"><span class="file-name">${escapeHtml(f.name)}</span>${sub}</span>` +
        `<button class="file-remove" data-id="${f.id}" title="Remove">` +
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
      fileListEl.appendChild(li);
      if (!f.error) { totalRows += f.rows.length; goodFiles++; }
    });

    fileCountEl.textContent = state.files.length;
    totalsRow.innerHTML = goodFiles
      ? `<strong>${totalRows}</strong> rows across <strong>${goodFiles}</strong> file${goodFiles === 1 ? "" : "s"} ready to combine`
      : "";
    btnToReview.disabled = totalRows === 0;
  }

  fileListEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".file-remove");
    if (!btn) return;
    const id = +btn.dataset.id;
    state.files = state.files.filter((f) => f.id !== id);
    // Rebuild canonical from remaining files
    rebuildCanonical();
    renderFileList();
  });

  function rebuildCanonical() {
    state.canonical = [];
    state.files.forEach((f) => { if (!f.error) ensureCanonical(f.headers); });
  }

  // Drop auto-generated ("Column N") columns that are empty everywhere — real
  // sheets often carry a stray trailing empty cell in the header row.
  function pruneCanonical() {
    state.canonical = state.canonical.filter((c) => {
      if (!/^Column \d+$/.test(c)) return true; // keep every real, named column
      for (const f of state.files) {
        if (f.error) continue;
        for (const r of f.rows) {
          if (r[c] != null && String(r[c]).trim() !== "") return true;
        }
      }
      return false;
    });
  }

  $("btn-clear-all").addEventListener("click", () => {
    state.files = [];
    state.canonical = [];
    renderFileList();
  });

  /* ═══════════ DROP ZONE ═══════════ */
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => { addFiles(e.target.files); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); }));
  dropZone.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  /* ═══════════ COMBINE + DEDUPE ═══════════ */
  const SR_TOKENS = ["SR_NO", "SR.NO", "SR NO", "S.NO", "SNO", "SERIAL"];
  function findSrColumn() {
    return state.canonical.find((c) => {
      const u = c.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return SR_TOKENS.some((t) => u === t.replace(/[^A-Z0-9]/g, ""));
    }) || null;
  }

  // Preferred default key columns, in priority order
  const DEFAULT_KEY_HINTS = ["VIN/REG_NUMBER", "REG_NUMBER", "REGISTRATION", "CHASSIS"];
  function pickDefaultKeys() {
    const found = [];
    DEFAULT_KEY_HINTS.forEach((hint) => {
      const col = state.canonical.find((c) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").includes(hint.replace(/[^A-Z0-9]/g, "")));
      if (col && found.indexOf(col) === -1) found.push(col);
    });
    // Default to just the registration number if present, else first found, else first data column
    if (found.length) return [found[0]];
    const firstData = state.canonical.find((c) => !SR_TOKENS.includes(c.toUpperCase()));
    return firstData ? [firstData] : state.canonical.slice(0, 1);
  }

  function normVal(v) {
    let s = String(v == null ? "" : v).trim();
    if (state.options.normalize) s = s.toUpperCase().replace(/\s+/g, "");
    return s;
  }

  function computeCombined() {
    const combined = [];
    let idx = 0;
    state.files.forEach((f) => {
      if (f.error) return;
      f.rows.forEach((row) => {
        const cells = {};
        state.canonical.forEach((c) => { cells[c] = row[c] != null ? row[c] : ""; });
        combined.push({ __file: f.name, __idx: idx++, cells: cells, key: "", isDup: false, isFirst: true });
      });
    });

    // Duplicate detection on selected key columns
    const groups = new Map();
    combined.forEach((r) => {
      const parts = state.keyCols.map((c) => normVal(r.cells[c]));
      const hasContent = parts.some((p) => p !== "");
      r.key = hasContent ? parts.join("‖") : null; // blank key => never a duplicate
      if (r.key == null) return;
      if (!groups.has(r.key)) groups.set(r.key, []);
      groups.get(r.key).push(r);
    });

    let dupes = 0;
    groups.forEach((members) => {
      if (members.length > 1) {
        members.forEach((m, i) => {
          m.isDup = true;
          m.isFirst = i === 0;
          if (i > 0) dupes++;
        });
      }
    });

    state.combined = combined;
    state.stats = { total: combined.length, dupes: dupes, unique: combined.length - dupes };
  }

  /* ═══════════ REVIEW UI ═══════════ */
  function renderKeyChips() {
    const wrap = $("key-chips");
    wrap.innerHTML = "";
    const srCol = findSrColumn();
    state.canonical.forEach((c) => {
      if (c === srCol) return; // serial number is meaningless as a key
      const chip = document.createElement("span");
      chip.className = "key-chip" + (state.keyCols.indexOf(c) !== -1 ? " on" : "");
      chip.textContent = c.replace(/\*$/, "");
      chip.dataset.col = c;
      chip.addEventListener("click", () => {
        const i = state.keyCols.indexOf(c);
        if (i === -1) state.keyCols.push(c); else state.keyCols.splice(i, 1);
        if (!state.keyCols.length) { state.keyCols.push(c); toast("Keep at least one match column", "err"); }
        chip.classList.toggle("on");
        refreshReview();
      });
      wrap.appendChild(chip);
    });
  }

  function refreshReview() {
    computeCombined();
    $("stat-total").textContent = state.stats.total;
    $("stat-files").textContent = state.files.filter((f) => !f.error).length;
    $("stat-dupes").textContent = state.stats.dupes;
    $("stat-unique").textContent = state.stats.unique;
    renderPreviewTable();
  }

  const PREVIEW_LIMIT = 300;
  function renderPreviewTable() {
    const thead = $("preview-thead");
    const tbody = $("preview-tbody");
    const srCol = findSrColumn();
    const cols = state.canonical;

    // header
    let th = "<tr><th>#</th>";
    if (state.options.source) th += "<th>Source File</th>";
    if (state.options.flag) th += "<th>Duplicate?</th>";
    cols.forEach((c) => { th += `<th>${escapeHtml(c.replace(/\*$/, ""))}</th>`; });
    th += "</tr>";
    thead.innerHTML = th;

    const rows = state.options.onlyDupes ? state.combined.filter((r) => r.isDup) : state.combined;
    const shown = rows.slice(0, PREVIEW_LIMIT);
    let html = "";
    let serial = 0;
    shown.forEach((r) => {
      serial++;
      const dupClass = r.isDup && !r.isFirst ? " class=\"dup\"" : "";
      let tr = `<tr${dupClass}>`;
      const srDisplay = state.options.renumber ? (state.combined.indexOf(r) + 1) : (r.cells[srCol] || serial);
      tr += `<td class="col-sr">${escapeHtml(String(srDisplay))}</td>`;
      if (state.options.source) tr += `<td>${escapeHtml(r.__file)}</td>`;
      if (state.options.flag) tr += `<td class="col-flag">${r.isDup && !r.isFirst ? '<span class="dup-tag">DUPLICATE</span>' : ""}</td>`;
      cols.forEach((c) => {
        const val = c === srCol && state.options.renumber ? (state.combined.indexOf(r) + 1) : r.cells[c];
        tr += `<td title="${escapeHtml(String(val))}">${escapeHtml(String(val))}</td>`;
      });
      tr += "</tr>";
      html += tr;
    });
    tbody.innerHTML = html;

    const note = $("table-note");
    if (rows.length > PREVIEW_LIMIT) {
      note.textContent = `Showing first ${PREVIEW_LIMIT} of ${rows.length} rows — the full set is included in the export.`;
    } else {
      note.textContent = rows.length ? `Showing all ${rows.length} row${rows.length === 1 ? "" : "s"}.` : "No rows to show.";
    }
  }

  // option switches
  ["opt-normalize", "opt-source", "opt-flag", "opt-renumber"].forEach((id) => {
    $(id).addEventListener("change", (e) => {
      state.options[id.replace("opt-", "")] = e.target.checked;
      refreshReview();
    });
  });
  $("opt-only-dupes").addEventListener("change", (e) => {
    state.options.onlyDupes = e.target.checked;
    renderPreviewTable();
  });

  /* ═══════════ NAVIGATION BUTTONS ═══════════ */
  btnToReview.addEventListener("click", () => {
    rebuildCanonical();
    pruneCanonical();
    if (!state.canonical.length) { toast("No readable columns found", "err"); return; }
    state.keyCols = pickDefaultKeys();
    renderKeyChips();
    refreshReview();
    goToStep(2);
  });
  $("btn-back-files").addEventListener("click", () => goToStep(1));
  $("btn-to-export").addEventListener("click", () => { renderExportSummary(); goToStep(3); });
  $("btn-back-review").addEventListener("click", () => goToStep(2));

  function renderExportSummary() {
    const s = state.stats;
    $("export-summary").innerHTML =
      `<div class="summary-item"><div class="num">${s.total}</div><div class="lbl">Total rows</div></div>` +
      `<div class="summary-item"><div class="num">${state.files.filter((f) => !f.error).length}</div><div class="lbl">Files merged</div></div>` +
      `<div class="summary-item warn"><div class="num">${s.dupes}</div><div class="lbl">Duplicates flagged</div></div>` +
      `<div class="summary-item"><div class="num">${s.unique}</div><div class="lbl">Unique rows</div></div>`;
  }

  /* ═══════════ EXPORT ═══════════ */
  const FILL_DUP = { patternType: "solid", fgColor: { rgb: "FFF2CC" } };      // soft yellow
  const FILL_HEADER = { patternType: "solid", fgColor: { rgb: "1F2937" } };   // slate
  const FONT_HEADER = { bold: true, color: { rgb: "FFFFFF" }, sz: 11 };
  const BORDER_THIN = { style: "thin", color: { rgb: "D9D9D9" } };
  const ALL_BORDERS = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };

  function buildExport() {
    const srCol = findSrColumn();
    const cols = state.canonical.slice();

    // Output column order: canonical columns first, then optional extras at the end
    const outCols = cols.slice();
    const extraSource = state.options.source ? "Source File" : null;
    const extraFlag = state.options.flag ? "Duplicate?" : null;
    if (extraFlag) outCols.push(extraFlag);
    if (extraSource) outCols.push(extraSource);

    const aoa = [outCols.map((c) => c.replace(/\*$/, ""))];
    state.combined.forEach((r, i) => {
      const line = cols.map((c) => {
        if (c === srCol && state.options.renumber) return i + 1;
        return r.cells[c];
      });
      if (extraFlag) line.push(r.isDup && !r.isFirst ? "DUPLICATE" : "");
      if (extraSource) line.push(r.__file);
      aoa.push(line);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.decode_range(ws["!ref"]);

    // Column widths + autofilter on the header row (lets the user filter to DUPLICATE)
    ws["!cols"] = outCols.map((c) => ({ wch: Math.min(Math.max(c.length + 2, 12), 40) }));
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: outCols.length - 1 } }) };

    for (let R = range.s.r; R <= range.e.r; R++) {
      const isHeader = R === 0;
      const combinedRow = isHeader ? null : state.combined[R - 1];
      const highlight = combinedRow && combinedRow.isDup && !combinedRow.isFirst;
      for (let C = range.s.c; C <= range.e.c; C++) {
        const ref = XLSX.utils.encode_cell({ r: R, c: C });
        let cell = ws[ref];
        if (!cell) { cell = { t: "s", v: "" }; ws[ref] = cell; }
        cell.s = {
          border: ALL_BORDERS,
          alignment: { vertical: "center", wrapText: false },
        };
        if (isHeader) {
          cell.s.fill = FILL_HEADER;
          cell.s.font = FONT_HEADER;
        } else if (highlight) {
          cell.s.fill = FILL_DUP;
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Combined");
    return wb;
  }

  $("btn-download").addEventListener("click", () => {
    if (!state.combined.length) { toast("Nothing to export", "err"); return; }
    try {
      const wb = buildExport();
      let name = ($("out-name").value || "Combined_Sheet").trim().replace(/\.xlsx$/i, "").replace(/[\\/:*?"<>|]/g, "_");
      if (!name) name = "Combined_Sheet";
      XLSX.writeFile(wb, name + ".xlsx", { bookType: "xlsx", cellStyles: true });
      toast("Excel downloaded — duplicates highlighted", "ok");
    } catch (e) {
      console.error(e);
      toast("Export failed: " + (e.message || e), "err");
    }
  });

  /* ═══════════ UTIL ═══════════ */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
})();
