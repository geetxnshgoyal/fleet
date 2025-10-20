/* global XLSX */

const incomingInput = document.getElementById("incomingFile");
const installedInput = document.getElementById("installedFile");
const statusEl = document.getElementById("status");
const viewButtons = document.querySelectorAll(".view-btn");
const incomingTableEl = document.getElementById("incomingTable");
const installedTableEl = document.getElementById("installedTable");
const stockTableEl = document.getElementById("stockTable");
const downloadStockBtn = document.getElementById("downloadStock");
const filterInputs = document.querySelectorAll(".table-filter");
const incomingCountEl = document.getElementById("incomingCount");
const installedCountEl = document.getElementById("installedCount");
const stockCountEl = document.getElementById("stockCount");
const historyListEl = document.getElementById("historyList");
const historyTableEl = document.getElementById("historyTable");
const historyTableWrapper = document.getElementById("historyTableWrapper");
const historyTitleEl = document.getElementById("historyTitle");
const historyCountEl = document.getElementById("historyCount");
const clearHistoryBtn = document.getElementById("clearHistory");

const MAX_ROWS_DISPLAYED = 200;
const STOCK_COLUMNS = ["IMEI", "Device Type", "Sim No", "Status"];
const INCOMING_CANONICAL = ["IMEI", "Device Type", "Sim IMEI", "Sim No", "Status"];
const INSTALLED_COLUMNS = ["IMEI", "Vehicles", "Device", "Installation"];
const HISTORY_STORAGE_KEY = "fleetfox:stockHistory";
const MAX_HISTORY_ENTRIES = 12;

const INCOMING_ALIASES = {
  IMEI: ["imei", "imei no", "imei number", "device imei", "imei #"],
  "Device Type": [
    "device type",
    "device",
    "model",
    "device model",
    "unit type",
    "type",
  ],
  "Sim IMEI": ["sim imei", "sim imei no", "sim imei number", "sim imei1"],
  "Sim No": [
    "sim no",
    "sim no.",
    "sim number",
    "sim",
    "mobile no",
    "mobile number",
    "mobile num",
    "sim #",
    "phone no",
    "phone number",
    "contact",
  ],
  Status: ["status", "plan", "package", "subscription", "comment"],
};

const INSTALLED_ALIASES = {
  IMEI: ["imei", "imei no", "imei number", "device imei"],
  Vehicles: [
    "vehicles",
    "vehicle",
    "vehicle no",
    "vehicle number",
    "vehicle name",
    "registration",
    "reg no",
    "reg number",
    "vehicle reg no",
    "vehicle #",
    "vehicle id",
  ],
  Device: ["device", "device type", "model"],
  Installation: [
    "installation",
    "installation date",
    "install date",
    "installed on",
    "installation time",
    "installation datetime",
    "install datetime",
  ],
};

let incomingData = [];
let installedData = [];
let stockData = [];
let incomingFiltered = [];
let installedFiltered = [];
let stockFiltered = [];
let stockHistory = [];
let activeHistoryId = null;
let currentIncomingSignature = null;
let currentInstalledSignature = null;
let currentIncomingLabel = "";
let currentInstalledLabel = "";
let lastArchivedSignature = null;

const filters = {
  incoming: "",
  installed: "",
  stock: "",
};

function updateStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function showView(target) {
  document.querySelectorAll(".data-view").forEach((panel) => {
    if (panel.id === `view-${target}`) {
      panel.classList.remove("hidden");
    } else {
      panel.classList.add("hidden");
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderTable(element, rows, columns, { filterQuery = "" } = {}) {
  if (!rows || rows.length === 0) {
    const message = filterQuery
      ? "No records match your search."
      : "No records found.";
    element.innerHTML = `<tbody><tr><td colspan="${columns.length}" class="empty">${message}</td></tr></tbody>`;
    return;
  }

  const sliced = rows.slice(0, MAX_ROWS_DISPLAYED);
  const headerHtml = `<thead><tr>${columns
    .map((col) => `<th>${escapeHtml(col)}</th>`)
    .join("")}</tr></thead>`;

  const bodyHtml = sliced
    .map(
      (row) =>
        `<tr>${columns
          .map((col) => `<td>${escapeHtml(row[col] ?? "")}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const footerHtml =
    rows.length > MAX_ROWS_DISPLAYED
      ? `<tfoot><tr><td colspan="${columns.length}" class="truncate-note">Showing first ${MAX_ROWS_DISPLAYED} rows. Refine your search to narrow the list.</td></tr></tfoot>`
      : "";

  element.innerHTML = `${headerHtml}<tbody>${bodyHtml}</tbody>${footerHtml}`;
}

function updateCounts() {
  incomingCountEl.textContent = formatCount(
    incomingData.length,
    incomingFiltered.length
  );
  installedCountEl.textContent = formatCount(
    installedData.length,
    installedFiltered.length
  );
  stockCountEl.textContent = formatCount(stockData.length, stockFiltered.length);
}

function formatCount(total, shown) {
  if (total === 0) {
    return "No devices";
  }
  if (shown === total) {
    return `${pluralize(shown)}${shown > MAX_ROWS_DISPLAYED ? ` (showing first ${MAX_ROWS_DISPLAYED})` : ""}`;
  }
  return `${pluralize(shown)} of ${pluralize(total)}${shown > MAX_ROWS_DISPLAYED ? ` (showing first ${MAX_ROWS_DISPLAYED})` : ""}`;
}

function pluralize(count) {
  if (count === 0) {
    return "0 devices";
  }
  if (count === 1) {
    return "1 device";
  }
  return `${count} devices`;
}

function loadHistory() {
  try {
    if (!("localStorage" in window)) {
      return;
    }
    const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) {
      return;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return;
    }
    stockHistory = parsed
      .filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          Array.isArray(entry.rows) &&
          entry.id
      )
      .map((entry) => {
        const normalizedRows = entry.rows.map((row) => {
          const snapshotRow = {};
          STOCK_COLUMNS.forEach((column) => {
            snapshotRow[column] = row?.[column] ?? "";
          });
          return snapshotRow;
        });
        return {
          id: entry.id,
          timestamp: entry.timestamp || "",
          incomingFile: entry.incomingFile || "",
          installedFile: entry.installedFile || "",
          rows: normalizedRows,
          rowCount: Number(entry.rowCount) || normalizedRows.length,
        };
      });
    activeHistoryId =
      stockHistory.length && stockHistory[0]?.id
        ? stockHistory[0].id
        : null;
  } catch (error) {
    console.warn("Failed to load saved stock reports:", error);
    stockHistory = [];
    activeHistoryId = null;
  }
}

function persistHistory() {
  try {
    if (!("localStorage" in window)) {
      return;
    }
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(stockHistory)
    );
  } catch (error) {
    console.warn("Failed to persist stock history:", error);
  }
}

function formatTimestamp(isoString) {
  if (!isoString) {
    return "Unknown time";
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatHistoryCount(count) {
  if (!count) {
    return "No saved reports";
  }
  if (count === 1) {
    return "1 saved report";
  }
  return `${count} saved reports`;
}

function extractStockSnapshotRow(row) {
  const snapshotRow = {};
  STOCK_COLUMNS.forEach((column) => {
    snapshotRow[column] = row?.[column] ?? "";
  });
  return snapshotRow;
}

function archiveCurrentStock() {
  if (
    !stockData.length ||
    !incomingData.length ||
    !installedData.length
  ) {
    return;
  }

  const signature = `${currentIncomingSignature || "none"}|${currentInstalledSignature || "none"}`;
  if (signature === lastArchivedSignature) {
    return;
  }

  const snapshot = {
    id: `snapshot-${Date.now()}`,
    timestamp: new Date().toISOString(),
    incomingFile: currentIncomingLabel,
    installedFile: currentInstalledLabel,
    rows: stockData.map(extractStockSnapshotRow),
    rowCount: stockData.length,
  };

  stockHistory = [snapshot, ...stockHistory].slice(0, MAX_HISTORY_ENTRIES);
  activeHistoryId = snapshot.id;
  lastArchivedSignature = signature;
  persistHistory();
  renderHistory();
}

function renderHistory() {
  if (!historyListEl || !historyCountEl) {
    return;
  }

  historyCountEl.textContent = formatHistoryCount(stockHistory.length);

  if (!stockHistory.length) {
    historyListEl.innerHTML =
      '<p class="history-empty">Saved reports will appear here after you upload new files.</p>';
    if (historyTableWrapper) {
      historyTableWrapper.classList.add("hidden");
    }
    if (historyTitleEl) {
      historyTitleEl.textContent = "";
    }
    return;
  }

  if (
    !activeHistoryId ||
    !stockHistory.some((entry) => entry.id === activeHistoryId)
  ) {
    activeHistoryId = stockHistory[0].id;
  }

  historyListEl.innerHTML = stockHistory
    .map((snapshot) => {
      const isActive = snapshot.id === activeHistoryId;
      const timestamp = formatTimestamp(snapshot.timestamp);
      const fileSummary = [snapshot.incomingFile, snapshot.installedFile]
        .filter(Boolean)
        .map((name) => escapeHtml(name))
        .join(" &middot; ");
      const countLabel = pluralize(snapshot.rowCount || snapshot.rows.length);
      return `
        <article class="history-item${isActive ? " active" : ""}">
          <div class="history-item__summary">
            <h3>${escapeHtml(timestamp)}</h3>
            <p>${escapeHtml(countLabel)}${fileSummary ? ` · ${fileSummary}` : ""}</p>
          </div>
          <div class="history-item__actions">
            <button type="button" class="secondary" data-action="view" data-history-id="${escapeHtml(snapshot.id)}">
              View
            </button>
            <button type="button" data-action="download" data-history-id="${escapeHtml(snapshot.id)}">
              Download CSV
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  renderHistoryTable();
}

function renderHistoryTable() {
  if (!historyTableWrapper || !historyTableEl) {
    return;
  }

  if (!stockHistory.length || !activeHistoryId) {
    historyTableWrapper.classList.add("hidden");
    historyTableEl.innerHTML = "";
    if (historyTitleEl) {
      historyTitleEl.textContent = "";
    }
    return;
  }

  const snapshot = stockHistory.find((entry) => entry.id === activeHistoryId);
  if (!snapshot) {
    historyTableWrapper.classList.add("hidden");
    historyTableEl.innerHTML = "";
    if (historyTitleEl) {
      historyTitleEl.textContent = "";
    }
    return;
  }

  historyTableWrapper.classList.remove("hidden");
  renderTable(historyTableEl, snapshot.rows, STOCK_COLUMNS);
  if (historyTitleEl) {
    const timestamp = formatTimestamp(snapshot.timestamp);
    const countLabel = pluralize(snapshot.rowCount || snapshot.rows.length);
    const fileSummary = [snapshot.incomingFile, snapshot.installedFile]
      .filter(Boolean)
      .join(" · ");
    const parts = [`Saved ${timestamp}`, countLabel];
    if (fileSummary) {
      parts.push(fileSummary);
    }
    historyTitleEl.textContent = parts.join(" · ");
  }
}

function downloadHistorySnapshot(snapshot) {
  if (!snapshot || !snapshot.rows || !snapshot.rows.length) {
    return;
  }
  const csv = toCSV(snapshot.rows, STOCK_COLUMNS);
  const timestamp = snapshot.timestamp
    ? snapshot.timestamp.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fleetfox-stock-${timestamp}-saved.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function clearHistory() {
  if (!stockHistory.length) {
    return;
  }
  const shouldClear = window.confirm(
    "Clear all saved stock reports from this browser?"
  );
  if (!shouldClear) {
    return;
  }
  stockHistory = [];
  activeHistoryId = null;
  lastArchivedSignature = null;
  persistHistory();
  renderHistory();
}

function computeStock() {
  const installedIMEIs = new Set(
    installedData
      .map((row) => (row?.IMEI ? String(row.IMEI).trim() : ""))
      .filter(Boolean)
  );

  stockData = incomingData.filter((row) => {
    const imei = row?.IMEI ? String(row.IMEI).trim() : "";
    return imei && !installedIMEIs.has(imei);
  });
}

function applyFilter(rows, columns, query) {
  if (!query) {
    return rows;
  }
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return rows;
  }
  return rows.filter((row) =>
    columns.some((column) => {
      const value = row?.[column];
      return value && String(value).toLowerCase().includes(normalized);
    })
  );
}

function toCSV(rows, columns) {
  const lines = [
    columns.map((col) => csvCell(col)).join(","),
    ...rows.map((row) => columns.map((col) => csvCell(row[col] ?? "")).join(",")),
  ];
  return lines.join("\r\n");
}

function csvCell(value) {
  const stringValue = String(value ?? "");
  if (stringValue === "") {
    return "";
  }
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function downloadStock() {
  if (!stockData.length) {
    return;
  }
  const csv = toCSV(stockData, STOCK_COLUMNS);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fleetfox-stock-${timestamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function readWorkbook(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const [firstSheetName] = workbook.SheetNames;
  if (!firstSheetName) {
    throw new Error("No sheets found in workbook.");
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  return json;
}

async function processFiles() {
  try {
    const newIncomingFile = incomingInput.files[0] || null;
    const newInstalledFile = installedInput.files[0] || null;
    const newIncomingSignature = newIncomingFile
      ? `${newIncomingFile.name}:${newIncomingFile.lastModified}`
      : null;
    const newInstalledSignature = newInstalledFile
      ? `${newInstalledFile.name}:${newInstalledFile.lastModified}`
      : null;
    const incomingChanged =
      newIncomingSignature !== currentIncomingSignature;
    const installedChanged =
      newInstalledSignature !== currentInstalledSignature;

    if (incomingChanged || installedChanged) {
      archiveCurrentStock();
    }

    if (!newIncomingFile && !newInstalledFile) {
      incomingData = [];
      installedData = [];
      stockData = [];
      currentIncomingSignature = null;
      currentInstalledSignature = null;
      currentIncomingLabel = "";
      currentInstalledLabel = "";
      lastArchivedSignature = null;
      renderViews();
      updateStatus("Waiting for files…", false);
      updateCounts();
      downloadStockBtn.disabled = true;
      renderHistory();
      return;
    }

    if (newIncomingFile) {
      updateStatus(`Reading ${newIncomingFile.name}…`);
      const rawIncoming = await readWorkbook(newIncomingFile);
      const cleanedIncoming = sanitizeRows(rawIncoming);
      incomingData = normalizeDataset(
        cleanedIncoming,
        INCOMING_ALIASES,
        INCOMING_CANONICAL
      );
    } else {
      incomingData = [];
    }

    if (newInstalledFile) {
      updateStatus(`Reading ${newInstalledFile.name}…`);
      const rawInstalled = await readWorkbook(newInstalledFile);
      const cleanedInstalled = sanitizeRows(rawInstalled);
      installedData = normalizeDataset(
        cleanedInstalled,
        INSTALLED_ALIASES,
        INSTALLED_COLUMNS
      );
    } else {
      installedData = [];
    }

    const warnings = [];
    if (incomingData.length && !hasNonEmptyValue(incomingData, "IMEI")) {
      warnings.push(
        "Incoming file: IMEI column not detected. Check header spelling."
      );
    }
    if (installedData.length && !hasNonEmptyValue(installedData, "IMEI")) {
      warnings.push(
        "Installed file: IMEI column not detected. Check header spelling."
      );
    }

    computeStock();
    renderViews();
    updateCounts();
    downloadStockBtn.disabled = !stockData.length;

    currentIncomingSignature = newIncomingSignature;
    currentInstalledSignature = newInstalledSignature;
    currentIncomingLabel = newIncomingFile ? newIncomingFile.name : "";
    currentInstalledLabel = newInstalledFile ? newInstalledFile.name : "";

    if (!incomingData.length || !installedData.length) {
      const message = warnings.length
        ? `Files loaded. Select the remaining spreadsheet to enable comparisons. ${warnings.join(
            " "
          )}`
        : "Files loaded. Select the remaining spreadsheet to enable comparisons.";
      updateStatus(message, warnings.length > 0);
      renderHistory();
      return;
    }

    const readyMessage = warnings.length
      ? `Ready! Use the buttons below to explore the data. ${warnings.join(" ")}`
      : "Ready! Use the buttons below to explore the data.";
    updateStatus(readyMessage, warnings.length > 0);
    renderHistory();
    showView("stock");
  } catch (error) {
    console.error(error);
    updateStatus(`Failed to read files: ${error.message}`, true);
  }
}

function renderViews() {
  incomingFiltered = applyFilter(
    incomingData,
    STOCK_COLUMNS,
    filters.incoming
  );
  installedFiltered = applyFilter(
    installedData,
    INSTALLED_COLUMNS,
    filters.installed
  );
  stockFiltered = applyFilter(stockData, STOCK_COLUMNS, filters.stock);

  renderTable(incomingTableEl, incomingFiltered, STOCK_COLUMNS, {
    filterQuery: filters.incoming,
  });
  renderTable(installedTableEl, installedFiltered, INSTALLED_COLUMNS, {
    filterQuery: filters.installed,
  });
  renderTable(stockTableEl, stockFiltered, STOCK_COLUMNS, {
    filterQuery: filters.stock,
  });
}

function sanitizeRows(rows) {
  return rows.map((row) => {
    if (!row || typeof row !== "object") {
      return {};
    }
    const sanitized = {};
    Object.entries(row).forEach(([key, value]) => {
      if (!key) {
        return;
      }
      const trimmedKey = key.trim().replace(/\s+/g, " ");
      const processedValue =
        typeof value === "string" ? value.trim() : value ?? "";
      sanitized[trimmedKey] = processedValue;
    });
    return sanitized;
  });
}

function normalizeDataset(rows, aliasMap, canonicalColumns) {
  return rows.map((row) => {
    if (!row || typeof row !== "object") {
      return {};
    }

    const normalized = { ...row };
    const lookup = {};
    Object.entries(row).forEach(([key, value]) => {
      const lowerKey = key.trim().toLowerCase().replace(/\s+/g, " ");
      lookup[lowerKey] = value;
    });

    canonicalColumns.forEach((column) => {
      const currentValue = normalized[column];
      if (
        currentValue !== undefined &&
        currentValue !== null &&
        String(currentValue).trim() !== ""
      ) {
        if (typeof currentValue === "string") {
          normalized[column] = currentValue.trim();
        }
        return;
      }

      const aliases = aliasMap[column] || [];
      const match = aliases.find((alias) => {
        const normalizedAlias = alias.trim().toLowerCase().replace(/\s+/g, " ");
        return normalizedAlias in lookup;
      });
      if (match) {
        const normalizedAlias = match.trim().toLowerCase().replace(/\s+/g, " ");
        const value = lookup[normalizedAlias];
        normalized[column] =
          typeof value === "string" ? value.trim() : value ?? "";
      } else if (!(column in normalized)) {
        normalized[column] = "";
      }
    });

    return normalized;
  });
}

function hasNonEmptyValue(rows, column) {
  return rows.some((row) => {
    const value = row?.[column];
    return (
      value !== undefined &&
      value !== null &&
      String(value).trim().length > 0
    );
  });
}

incomingInput.addEventListener("change", processFiles);
installedInput.addEventListener("change", processFiles);

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.target;
    if (target) {
      showView(target);
    }
  });
});

downloadStockBtn.addEventListener("click", downloadStock);

filterInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const target = input.dataset.target;
    if (!target) {
      return;
    }
    filters[target] = input.value;
    renderViews();
    updateCounts();
  });
});

if (historyListEl) {
  historyListEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    const snapshotId = button.dataset.historyId;
    if (!action || !snapshotId) {
      return;
    }
    const snapshot = stockHistory.find((entry) => entry.id === snapshotId);
    if (!snapshot) {
      return;
    }
    if (action === "view") {
      activeHistoryId = snapshotId;
      renderHistory();
      showView("history");
    } else if (action === "download") {
      downloadHistorySnapshot(snapshot);
    }
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    clearHistory();
  });
}

loadHistory();
renderHistory();

// Initialize UI state.
renderViews();
updateCounts();
showView("stock");
