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
const sectionTabs = document.querySelectorAll(".tab-btn");
const sectionPanels = document.querySelectorAll("[data-section]");
const downloadTableEl = document.getElementById("downloadTable");
const downloadSearchInput = document.getElementById("downloadSearch");
const downloadCountEl = document.getElementById("downloadCount");
const downloadCopyBtn = document.getElementById("downloadCopy");
const downloadExcelBtn = document.getElementById("downloadExcel");
const downloadCsvBtn = document.getElementById("downloadCsv");
const downloadPdfBtn = document.getElementById("downloadPdf");
const downloadPrintBtn = document.getElementById("downloadPrint");
const downloadClearBtn = document.getElementById("downloadClear");

const MAX_ROWS_DISPLAYED = 200;
const STOCK_COLUMNS = ["IMEI", "Device Type", "Sim No", "Status"];
const INCOMING_CANONICAL = ["IMEI", "Device Type", "Sim IMEI", "Sim No", "Status"];
const INSTALLED_COLUMNS = ["IMEI", "Vehicles", "Device", "Installation"];
const HISTORY_STORAGE_KEY = "fleetfox:stockHistory";
const MAX_HISTORY_ENTRIES = 12;
const DOWNLOAD_COLUMNS = [
  "S.No",
  "Customer Name",
  "Device Imei",
  "Iccid Number",
  "Created Date",
  "Created By",
  "Action",
];

const DOWNLOAD_SAMPLE_ROWS = [

  {
    "S.No": 1,
    "Customer Name": "Sample Customer",
    "Device Imei": "000000000000000",
    "Iccid Number": "0000000000000000000",
    "Created Date": "01-01-2025 10:00:00",
    "Created By": "Fitment",
  },
];

const CERTIFICATES_STORAGE_KEY = "fleetfox:savedCertificates";
let savedCertificates = [];

const CERTIFICATE_COMPANY = {
  name: "YAAR IT SOLUTIONS",
  address: [
    "SHOP No. 70, Comercial market",
    "Hanumangarh Junction - 335512",
    "GSTIN - 08AGQPG4963Q1ZG",
  ],
  email: "info.fleetfox@gmail.com",
};

const CERTIFICATE_SAMPLE = {
  ownerName: "ARIHANT ENTERPRISES",
  vehicleNumber: "PB03BH8685",
  engineNumber: "B6.7B6A250D02112L64179609",
  chassisNumber: "MAT828022M3N26611",
  rtoDistrict: "HANUMANGARH",
  rtoState: "RAJASTHAN",
  deviceImei: "358980101880954",
  deviceModel: "We Track 140",
  vehicleType: "TRUCK",
  vehicleModel: "4018",
  manufacturingCompany: "Tata Motors",
  vehicleManufacturingDate: "2023-11-30",
  registrationDate: "2024-01-15",
  installationDate: "2024-02-10",
  fitnessDate: "2026-02-10",
  fitmentValidUpto: "2025-12-31",
  invoiceNumber: "INV-140-2024",
  invoiceDate: "2024-01-12",
  numberOfSos: "4",
  esimValidity: "2025-12-31",
  vtldNumber: "VTL-9981",
  vtldModel: "We Track 140",
  operator1: "JIO",
  operator2: "AIRTEL",
  esim1: "8912345678901234567",
  esim2: "8912345678901234568",
  customerName: "Mark Transport",
  customerAddress: "Near bus stand, Hanumangarh",
  dealerName: "YAAR IT SOLUTIONS",
  dealerAddress: "SHOP No. 70, Comercial market, Hanumangarh",
};

const certificateForm = document.getElementById("certificateForm");
const generateCertificateBtn = document.getElementById("generateCertificate");
const fillSampleCertificateBtn = document.getElementById("fillSampleCertificate");
const saveCertificateBtn = document.getElementById("saveCertificate");
const certificatePreviewCard = document.getElementById("certificatePreviewCard");
const certificatePreviewEl = document.getElementById("certificatePreview");
const certificateStatusEl = document.getElementById("certificateStatus");
const certificateQrEl = document.getElementById("certificateQr");
const printCertificateBtn = document.getElementById("printCertificate");

const certificatePreviewFields = {
  deviceModel: document.getElementById("previewDeviceModel"),
  rtoAddress: document.getElementById("previewRtoAddress"),
  fitmentDate: document.getElementById("previewFitmentDate"),
  fitmentValidTill: document.getElementById("previewFitmentValidTill"),
  vehicleNo: document.getElementById("previewVehicleNo"),
  vehicleType: document.getElementById("previewVehicleType"),
  chassis: document.getElementById("previewChassis"),
  engine: document.getElementById("previewEngine"),
  mfgCompany: document.getElementById("previewMfgCompany"),
  regDate: document.getElementById("previewRegDate"),
  vehicleModel: document.getElementById("previewVehicleModel"),
  fitnessDate: document.getElementById("previewFitnessDate"),
  mfgYear: document.getElementById("previewMfgYear"),
  ownerName: document.getElementById("previewOwnerName"),
  ownerAddress: document.getElementById("previewOwnerAddress"),
  dealerName: document.getElementById("previewDealerName"),
  dealerAddress: document.getElementById("previewDealerAddress"),
  sim1: document.getElementById("previewSim1"),
  sim2: document.getElementById("previewSim2"),
  vtsModel: document.getElementById("previewVtsModel"),
  deviceImei: document.getElementById("previewDeviceImei"),
  uniqueId: document.getElementById("previewUniqueId"),
  iccid: document.getElementById("previewIccid"),
  invoiceDate: document.getElementById("previewInvoiceDate"),
  invoiceNo: document.getElementById("previewInvoiceNo"),
  sos: document.getElementById("previewSos"),
  fitmentValid: document.getElementById("previewFitmentValid"),
  ackDate: document.getElementById("previewAckDate"),
  ackCustomer: document.getElementById("previewAckCustomer"),
  ackTime: document.getElementById("previewAckTime"),
  ackDl: document.getElementById("previewAckDl"),
  ackPlace: document.getElementById("previewAckPlace"),
  ackMobile: document.getElementById("previewAckMobile"),
  fitmentImage1: document.getElementById("previewFitmentImage1"),
  fitmentImage2: document.getElementById("previewFitmentImage2"),
  fitmentImage3: document.getElementById("previewFitmentImage3"),
};

const fitmentImageInputs = [
  document.getElementById("fitmentImage1"),
  document.getElementById("fitmentImage2"),
  document.getElementById("fitmentImage3"),
];

const fitmentImageData = {
  1: "",
  2: "",
  3: "",
};

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

function loadSavedCertificates() {
  try {
    if (!("localStorage" in window)) {
      savedCertificates = [];
      return;
    }
    const stored = window.localStorage.getItem(CERTIFICATES_STORAGE_KEY);
    if (!stored) {
      savedCertificates = [];
      return;
    }
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      savedCertificates = parsed;
    } else {
      savedCertificates = [];
    }
  } catch (error) {
    console.warn("Failed to load saved certificates", error);
    savedCertificates = [];
  }
}

function persistSavedCertificates() {
  try {
    if (!("localStorage" in window)) {
      return;
    }
    window.localStorage.setItem(
      CERTIFICATES_STORAGE_KEY,
      JSON.stringify(savedCertificates)
    );
  } catch (error) {
    console.warn("Failed to persist certificates", error);
  }
}

function switchSection(sectionName) {
  if (!sectionName) {
    return;
  }
  sectionPanels.forEach((panel) => {
    const isTarget = panel.dataset.section === sectionName;
    panel.classList.toggle("hidden", !isTarget);
  });
  sectionTabs.forEach((tab) => {
    const isActive = tab.dataset.sectionTarget === sectionName;
    tab.classList.toggle("active", isActive);
  });
}

function showCertificateStatus(message, isError = false) {
  if (!certificateStatusEl) {
    return;
  }
  certificateStatusEl.textContent = message;
  certificateStatusEl.classList.toggle("error", isError);
  certificateStatusEl.classList.remove("hidden");
}

function renderDownloadTable(rows) {
  if (!downloadTableEl) {
    return;
  }
  if (!rows.length) {
    downloadTableEl.querySelector("tbody").innerHTML =
      `<tr><td class="empty" colspan="${DOWNLOAD_COLUMNS.length}">No certificates yet. Submit one to see it here.</td></tr>`;
    if (downloadCountEl) {
      downloadCountEl.textContent = "No certificates";
    }
    return;
  }

  const bodyHtml = rows
    .map((row) => {
      const cells = DOWNLOAD_COLUMNS.map((col) => {
        if (col === "Action") {
          return '<button class="secondary download-print-row" data-cert-id="' + escapeHtml(row.id || "") + '">Print</button>';
        }
        return escapeHtml(row[col] ?? "");
      })
        .map((cell, idx) => (idx === DOWNLOAD_COLUMNS.length - 1 ? `<td class="action-cell">${cell}</td>` : `<td>${cell}</td>`))
        .join("");
      return `<tr data-cert-id="${escapeHtml(row.id || "")}">${cells}</tr>`;
    })
    .join("");

  downloadTableEl.querySelector("tbody").innerHTML = bodyHtml;
  if (downloadCountEl) {
    downloadCountEl.textContent = `${rows.length} certificate(s)`;
  }
}

function filterDownloadRows(query) {
  const normalized = (query || "").trim().toLowerCase();
  const rows = buildDownloadRows();
  if (!normalized) {
    return rows;
  }
  return rows.filter((row) =>
    DOWNLOAD_COLUMNS.some((col) => {
      if (col === "Action") return false;
      const value = row[col];
      return value && String(value).toLowerCase().includes(normalized);
    })
  );
}

function buildDownloadRows() {
  return savedCertificates.map((entry, index) => {
    const data = entry.data || {};
    return {
      id: entry.id,
      "S.No": index + 1,
      "Customer Name": data.customerName || data.ownerName || "—",
      "Device Imei": data.deviceImei || "—",
      "Iccid Number": data.esim1 || data.esim2 || data.iccid || "—",
      "Created Date": formatDisplayDateTime(entry.createdAt),
      "Created By": entry.createdBy || CERTIFICATE_COMPANY.name || "—",
      Action: "",
    };
  });
}

function downloadRowsToCsv(rows) {
  return toCSV(rows, DOWNLOAD_COLUMNS);
}

async function downloadTableAsPdf() {
  if (!downloadTableEl) {
    return;
  }
  if (!window.html2canvas || !window.jspdf) {
    showCertificateStatus("PDF library not ready. Please retry.", true);
    return;
  }
  const wrapper = downloadTableEl.closest(".table-wrapper") || downloadTableEl;
  const canvas = await window.html2canvas(wrapper, { scale: 2, backgroundColor: "#ffffff" });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new window.jspdf.jsPDF("p", "pt", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
  const imgWidth = canvas.width * ratio;
  const imgHeight = canvas.height * ratio;
  const offsetX = (pageWidth - imgWidth) / 2;
  const offsetY = 24;
  pdf.addImage(imgData, "PNG", offsetX, offsetY, imgWidth, imgHeight);
  pdf.save("certificates.pdf");
}

function formatDisplayDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function formatDisplayDateTime(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return `${date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })} ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

function resetFitmentImages() {
  [1, 2, 3].forEach((idx) => {
    fitmentImageData[idx] = "";
    const input = fitmentImageInputs[idx - 1];
    if (input) {
      input.value = "";
    }
  });
}

function handleFitmentImageChange(input, index) {
  const file = input?.files?.[0];
  if (!file) {
    fitmentImageData[index] = "";
    updateCertificatePreview(getCertificateData());
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    fitmentImageData[index] = event.target.result;
    updateCertificatePreview(getCertificateData());
  };
  reader.readAsDataURL(file);
}

function withVisiblePreview(run) {
  if (!certificatePreviewCard) {
    return run();
  }
  const wasHidden = certificatePreviewCard.classList.contains("hidden");
  if (wasHidden) {
    certificatePreviewCard.classList.remove("hidden");
  }
  const prevDisplay = certificatePreviewCard.style.display;
  if (getComputedStyle(certificatePreviewCard).display === "none") {
    certificatePreviewCard.style.display = "block";
  }
  try {
    run();
  } finally {
    if (wasHidden) {
      certificatePreviewCard.classList.add("hidden");
    }
    certificatePreviewCard.style.display = prevDisplay;
  }
}

function formatDisplayTime(value) {
  if (!value || !/[T\s]\d{2}:\d{2}/.test(value)) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function safeField(value, fallback = "—") {
  if (!value) {
    return fallback;
  }
  const trimmed = String(value).trim();
  return trimmed || fallback;
}

function buildQrText(data) {
  const rto = [data.rtoState, data.rtoDistrict].filter(Boolean).join("/");
  return [
    `Owner:${safeField(data.ownerName, "NA")}`,
    `Vehicle: ${safeField(data.vehicleNumber, "NA")}`,
    `Engine: ${safeField(data.engineNumber, "NA")}`,
    ` Chasis: ${safeField(data.chassisNumber, "NA")}`,
    `RTO: ${safeField(rto, "NA")}`,
    `Imei : ${safeField(data.deviceImei, "NA")}`,
  ].join(",");
}

function getCertificateData() {
  if (!certificateForm) {
    return {};
  }
  const formData = new FormData(certificateForm);
  const data = {};
  formData.forEach((value, key) => {
    data[key] = typeof value === "string" ? value.trim() : value;
  });
  data.fitmentImage1 = fitmentImageData[1];
  data.fitmentImage2 = fitmentImageData[2];
  data.fitmentImage3 = fitmentImageData[3];
  data.qrText = buildQrText(data);
  return data;
}

function populateCertificateForm(data) {
  if (!certificateForm || !data) {
    return;
  }
  Object.entries(data).forEach(([key, value]) => {
    const control = certificateForm.elements[key];
    if (control) {
      control.value = value ?? "";
    }
  });
}

function updateCertificatePreview(data) {
  if (!certificatePreviewCard || !certificatePreviewEl) {
    return;
  }

  certificatePreviewCard.classList.remove("hidden");

  const rtoParts = [safeField(data.rtoDistrict, ""), safeField(data.rtoState, "")].filter((part) => part && part !== "—");
  const rtoAddress = rtoParts.length ? rtoParts.join(", ") : "—";

  const previewMap = {
    deviceModel: safeField(data.deviceModel || data.vtldModel),
    rtoAddress,
    fitmentDate: formatDisplayDate(data.installationDate),
    fitmentValidTill: formatDisplayDate(data.fitmentValidUpto),
    vehicleNo: safeField(data.vehicleNumber),
    vehicleType: safeField(data.vehicleType),
    chassis: safeField(data.chassisNumber),
    engine: safeField(data.engineNumber),
    mfgCompany: safeField(data.manufacturingCompany),
    regDate: formatDisplayDate(data.registrationDate),
    vehicleModel: safeField(data.vehicleModel),
    fitnessDate: formatDisplayDate(data.fitnessDate),
    mfgYear: data.vehicleManufacturingDate ? new Date(data.vehicleManufacturingDate).getFullYear() || "—" : "—",
    ownerName: safeField(data.ownerName),
    ownerAddress: safeField(data.customerAddress || data.ownerAddress),
    dealerName: safeField(data.dealerName),
    dealerAddress: safeField(data.dealerAddress),
    sim1: safeField(data.esim1 || data.operator1),
    sim2: safeField(data.esim2 || data.operator2),
    vtsModel: safeField(data.vtldModel || data.deviceModel),
    deviceImei: safeField(data.deviceImei),
    uniqueId: safeField(data.vtldNumber),
    iccid: safeField(data.esim1 || data.esim2),
    invoiceDate: formatDisplayDate(data.invoiceDate),
    invoiceNo: safeField(data.invoiceNumber),
    sos: safeField(data.numberOfSos),
    fitmentValid: formatDisplayDate(data.fitmentValidUpto),
    ackDate: formatDisplayDate(data.installationDate),
    ackCustomer: safeField(data.customerName || data.ownerName),
    ackTime: formatDisplayTime(data.installationDate),
    ackDl: safeField(data.drivingLicense),
    ackPlace: safeField(data.rtoDistrict || data.customerAddress),
    ackMobile: safeField(data.customerMobile || data.ownerMobile),
  };

  Object.entries(previewMap).forEach(([key, value]) => {
    const target = certificatePreviewFields[key];
    if (target) {
      target.textContent = value;
    }
  });

  [1, 2, 3].forEach((idx) => {
    const img = certificatePreviewFields[`fitmentImage${idx}`];
    if (!img) {
      return;
    }
    const src = data[`fitmentImage${idx}`] || fitmentImageData[idx];
    if (src) {
      img.src = src;
      img.closest(".cert-image-box")?.classList.add("has-image");
    } else {
      img.removeAttribute("src");
      img.closest(".cert-image-box")?.classList.remove("has-image");
    }
  });

  if (certificateQrEl && window.QRCode) {
    certificateQrEl.innerHTML = "";
    // Short delay avoids race when library is still parsing.
    window.requestAnimationFrame(() => {
      // eslint-disable-next-line no-new
      new window.QRCode(certificateQrEl, {
        text: data.qrText || buildQrText(data),
        width: 130,
        height: 130,
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    });
  }
}

async function generateCertificatePdf(event, dataOverride) {
  if (event) {
    event.preventDefault();
  }
  if (!certificatePreviewEl) {
    return;
  }

  const data = dataOverride || getCertificateData();

  withVisiblePreview(() => {
    updateCertificatePreview(data);
  });

  if (!window.html2canvas || !window.jspdf) {
    showCertificateStatus("Rendering libraries not loaded yet. Please retry.", true);
    return;
  }

  showCertificateStatus("Rendering PDF…");

  try {
    const canvas = await window.html2canvas(certificatePreviewEl, {
      scale: 2,
      backgroundColor: "#ffffff",
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new window.jspdf.jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const imgWidth = canvas.width * ratio;
    const imgHeight = canvas.height * ratio;
    const offsetX = (pageWidth - imgWidth) / 2;
    const offsetY = 24;
    pdf.addImage(imgData, "PNG", offsetX, offsetY, imgWidth, imgHeight);
    const slug = (data.vehicleNumber || data.ownerName || "certificate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "certificate";
    pdf.save(`fitment-certificate-${slug}.pdf`);
    showCertificateStatus("Certificate downloaded.");
  } catch (error) {
    console.error(error);
    showCertificateStatus("Could not generate the PDF. Please try again.", true);
  }
}

function printCertificateView(event, dataOverride) {
  if (event) {
    event.preventDefault();
  }
  if (!certificatePreviewEl) {
    return;
  }
  const data = dataOverride || getCertificateData();
  withVisiblePreview(() => {
    updateCertificatePreview(data);
  });
  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) {
    showCertificateStatus("Pop-up blocked. Allow pop-ups to print.", true);
    return;
  }
  const html = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Certificate Print</title>
        <link rel="stylesheet" href="styles.css" />
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { margin: 0; padding: 0; background: #fff; }
          .certificate-preview { width: 190mm; margin: 0 auto; }
        </style>
      </head>
      <body style="padding:16px; background:#fff;">
        ${certificatePreviewEl.outerHTML}
      </body>
    </html>`;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}

function saveCertificate(event) {
  if (event) {
    event.preventDefault();
  }
  // Refresh in-memory cache from storage to avoid overwriting when page stayed open.
  loadSavedCertificates();

  const data = getCertificateData();
  updateCertificatePreview(data);
  const entry = {
    id: `cert-${Date.now()}`,
    createdAt: new Date().toISOString(),
    createdBy: CERTIFICATE_COMPANY.name,
    data,
  };

  savedCertificates = [entry, ...savedCertificates];
  persistSavedCertificates();
  const filtered = filterDownloadRows(downloadSearchInput?.value || "");
  renderDownloadTable(filtered);
  showCertificateStatus("Certificate submitted to downloads list.");

  // Jump the user to the downloads tab so they can see it immediately.
  switchSection("download");
}

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

if (certificateForm) {
  updateCertificatePreview(getCertificateData());
  certificateForm.addEventListener("input", () => {
    updateCertificatePreview(getCertificateData());
  });
}

if (fitmentImageInputs.length) {
  fitmentImageInputs.forEach((input, idx) => {
    if (!input) {
      return;
    }
    input.addEventListener("change", () => handleFitmentImageChange(input, idx + 1));
  });
}

if (fillSampleCertificateBtn) {
  fillSampleCertificateBtn.addEventListener("click", () => {
    resetFitmentImages();
    populateCertificateForm(CERTIFICATE_SAMPLE);
    updateCertificatePreview(getCertificateData());
    showCertificateStatus("Sample data loaded.");
  });
}

if (saveCertificateBtn) {
  saveCertificateBtn.addEventListener("click", saveCertificate);
}

if (generateCertificateBtn) {
  generateCertificateBtn.addEventListener("click", generateCertificatePdf);
}

if (printCertificateBtn) {
  printCertificateBtn.addEventListener("click", printCertificateView);
}

if (sectionTabs.length) {
  sectionTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.sectionTarget;
      switchSection(target);
      if (target === "download") {
        renderDownloadTable(filterDownloadRows(downloadSearchInput?.value || ""));
      }
    });
  });
  // Default to generate section.
  switchSection("generate");
}

if (downloadTableEl) {
  loadSavedCertificates();
  renderDownloadTable(filterDownloadRows(downloadSearchInput?.value || ""));
  downloadTableEl.addEventListener("click", (event) => {
    const button = event.target.closest(".download-print-row");
    if (!button) {
      return;
    }
    const certId = button.dataset.certId;
    const entry = savedCertificates.find((item) => item.id === certId);
    if (!entry) {
      showCertificateStatus("Saved certificate not found.", true);
      return;
    }
    printCertificateView(null, entry.data);
  });
}

if (downloadSearchInput) {
  downloadSearchInput.addEventListener("input", (event) => {
    const value = event.target.value;
    const filtered = filterDownloadRows(value);
    renderDownloadTable(filtered);
  });
}

function triggerDownloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

if (downloadCopyBtn) {
  downloadCopyBtn.addEventListener("click", async () => {
    const rows = filterDownloadRows(downloadSearchInput?.value || "");
    const text = toCSV(rows, DOWNLOAD_COLUMNS);
    try {
      await navigator.clipboard.writeText(text);
      showCertificateStatus("Table copied to clipboard.");
    } catch (err) {
      showCertificateStatus("Clipboard unavailable. Download CSV instead.", true);
    }
  });
}

if (downloadExcelBtn) {
  downloadExcelBtn.addEventListener("click", () => {
    const rows = filterDownloadRows(downloadSearchInput?.value || "");
    const csv = downloadRowsToCsv(rows);
    triggerDownloadFile(csv, "certificates.xls", "text/csv;charset=utf-8;");
  });
}

if (downloadCsvBtn) {
  downloadCsvBtn.addEventListener("click", () => {
    const rows = filterDownloadRows(downloadSearchInput?.value || "");
    const csv = downloadRowsToCsv(rows);
    triggerDownloadFile(csv, "certificates.csv", "text/csv;charset=utf-8;");
  });
}

if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", () => {
    downloadTableAsPdf();
  });
}

if (downloadPrintBtn) {
  downloadPrintBtn.addEventListener("click", () => {
    loadSavedCertificates();
    const entry = savedCertificates[0];
    if (entry) {
      printCertificateView(null, entry.data);
    } else {
      printCertificateView();
    }
  });
}

if (downloadClearBtn) {
  downloadClearBtn.addEventListener("click", () => {
    savedCertificates = [];
    persistSavedCertificates();
    renderDownloadTable(filterDownloadRows(downloadSearchInput?.value || ""));
    showCertificateStatus("Saved certificates cleared.");
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
