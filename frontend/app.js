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

const MAX_ROWS_DISPLAYED = 200;
const STOCK_COLUMNS = ["IMEI", "Device Type", "Sim No", "Status"];
const INCOMING_CANONICAL = ["IMEI", "Device Type", "Sim IMEI", "Sim No", "Status"];
const INSTALLED_COLUMNS = ["IMEI", "Vehicles", "Device", "Installation"];

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
    if (!incomingInput.files.length && !installedInput.files.length) {
      incomingData = [];
      installedData = [];
      stockData = [];
      renderViews();
      updateStatus("Waiting for files…", false);
      updateCounts();
      downloadStockBtn.disabled = true;
      return;
    }

    if (incomingInput.files.length) {
      updateStatus(`Reading ${incomingInput.files[0].name}…`);
      const rawIncoming = await readWorkbook(incomingInput.files[0]);
      const cleanedIncoming = sanitizeRows(rawIncoming);
      incomingData = normalizeDataset(
        cleanedIncoming,
        INCOMING_ALIASES,
        INCOMING_CANONICAL
      );
    } else {
      incomingData = [];
    }

    if (installedInput.files.length) {
      updateStatus(`Reading ${installedInput.files[0].name}…`);
      const rawInstalled = await readWorkbook(installedInput.files[0]);
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

    if (!incomingData.length || !installedData.length) {
      computeStock();
      renderViews();
      updateCounts();
      const message = warnings.length
        ? `Files loaded. Select the remaining spreadsheet to enable comparisons. ${warnings.join(
            " "
          )}`
        : "Files loaded. Select the remaining spreadsheet to enable comparisons.";
      updateStatus(message, warnings.length > 0);
      downloadStockBtn.disabled = !stockData.length;
      return;
    }

    computeStock();
    renderViews();
    updateCounts();
    downloadStockBtn.disabled = !stockData.length;
    const readyMessage = warnings.length
      ? `Ready! Use the buttons below to explore the data. ${warnings.join(" ")}`
      : "Ready! Use the buttons below to explore the data.";
    updateStatus(readyMessage, warnings.length > 0);
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

// Initialize UI state.
renderViews();
updateCounts();
showView("stock");
