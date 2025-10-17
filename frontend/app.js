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
const INSTALLED_COLUMNS = ["IMEI", "Vehicles", "Device", "Installation"];

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
      incomingData = await readWorkbook(incomingInput.files[0]);
    } else {
      incomingData = [];
    }

    if (installedInput.files.length) {
      updateStatus(`Reading ${installedInput.files[0].name}…`);
      installedData = await readWorkbook(installedInput.files[0]);
    } else {
      installedData = [];
    }

    if (!incomingData.length || !installedData.length) {
      computeStock();
      renderViews();
      updateStatus("Files loaded. Select the remaining spreadsheet to enable comparisons.");
      updateCounts();
      downloadStockBtn.disabled = !stockData.length;
      return;
    }

    computeStock();
    renderViews();
    updateCounts();
    downloadStockBtn.disabled = !stockData.length;
    updateStatus("Ready! Use the buttons below to explore the data.");
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
