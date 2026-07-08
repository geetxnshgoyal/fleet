/* ═══════════════════════════════════════════
   RC Scanner — Core Application Logic
   Gemini Vision API · Excel Handler
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  // ── State ──
  const state = {
    currentStep: 1,
    images: { front: null, back: null, form: null },
    extractedData: {},
    rawAIOutput: '',
    vehicles: [],
  };

  // ── Excel Column Order (matches user's template) ──
  const EXCEL_COLUMNS = [
    'SR_NO', 'DEVICE_IMEI', 'State', 'RTO', 'Registration Type',
    'Vehicle Make', 'Vehicle Model', 'Registration Year',
    '\u00A0ENGINE_NO', 'CHASSIS_NO', '\u00A0VIN/REG_NUMBER*',
    'NAME', 'Contact Number', 'Aadhar No.', 'Expiry Date',
    'SME Zone', 'ME District Office', 'Camp Location'
  ];

  // ── Indian State Codes ──
  const STATE_CODES = {
    'AN': 'Andaman and Nicobar', 'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh',
    'AS': 'Assam', 'BR': 'Bihar', 'CH': 'Chandigarh', 'CG': 'Chhattisgarh',
    'DD': 'Daman and Diu', 'DL': 'Delhi', 'GA': 'Goa', 'GJ': 'Gujarat',
    'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JK': 'Jammu and Kashmir',
    'JH': 'Jharkhand', 'KA': 'Karnataka', 'KL': 'Kerala', 'LA': 'Ladakh',
    'LD': 'Lakshadweep', 'MP': 'Madhya Pradesh', 'MH': 'Maharashtra',
    'MN': 'Manipur', 'ML': 'Meghalaya', 'MZ': 'Mizoram', 'NL': 'Nagaland',
    'OD': 'Odisha', 'OR': 'Odisha', 'PB': 'Punjab', 'PY': 'Puducherry',
    'RJ': 'Rajasthan', 'SK': 'Sikkim', 'TN': 'Tamil Nadu', 'TS': 'Telangana',
    'TR': 'Tripura', 'UK': 'Uttarakhand', 'UP': 'Uttar Pradesh', 'WB': 'West Bengal'
  };

  // ── RTO Districts ──
  const RTO_DISTRICTS = {
    'RJ01': 'Jaipur (Central)', 'RJ02': 'Alwar', 'RJ03': 'Kota', 'RJ04': 'Jodhpur',
    'RJ05': 'Ajmer', 'RJ06': 'Udaipur', 'RJ07': 'Bikaner', 'RJ08': 'Bhilwara',
    'RJ09': 'Chittorgarh', 'RJ10': 'Sikar', 'RJ11': 'Bharatpur', 'RJ12': 'Pali',
    'RJ13': 'Nagaur', 'RJ14': 'Jaipur', 'RJ15': 'Jhunjhunu', 'RJ16': 'Barmer',
    'RJ17': 'Tonk', 'RJ18': 'Bundi', 'RJ19': 'Sawai Madhopur', 'RJ20': 'Jalore',
    'RJ21': 'Jaisalmer', 'RJ22': 'Sirohi', 'RJ23': 'Banswara', 'RJ24': 'Dungarpur',
    'RJ25': 'Jhalawar', 'RJ26': 'Churu', 'RJ27': 'Sri Ganganagar', 'RJ28': 'Rajsamand',
    'RJ29': 'Baran', 'RJ30': 'Dholpur', 'RJ31': 'Hanumangarh', 'RJ32': 'Dausa',
    'RJ33': 'Karauli', 'RJ34': 'Pratapgarh', 'RJ35': 'Nimbahera',
  };

  // ── Gemini API Prompt ──
  const GEMINI_PROMPT = `You are analyzing Indian vehicle Registration Certificate (RC) card images. These can be:
- RC Card Front (blue/green card with vehicle specs)
- RC Card Back (green card with owner details, chassis/engine numbers)
- Form 24 (Motor Vehicle Register - full page document)

Extract ALL the following fields from the provided image(s). Combine information from all images into one result.

Return a JSON object with EXACTLY these keys:
{
  "regNumber": "Vehicle Registration Number (format: XX00XX0000, e.g. RJ09GE3784)",
  "engineNo": "Engine/Motor Number (alphanumeric code)",
  "chassisNo": "Chassis Number (17-character VIN code)",
  "ownerName": "Full Owner Name",
  "vehicleMake": "Vehicle Maker/Manufacturer (e.g. ASHOK LEYLAND LTD, TATA MOTORS)",
  "vehicleModel": "Model Name (e.g. NA5525N/34 TT CC)",
  "regYear": "Year only as 4-digit number (from Date of Registration or Month-Year of Mfg)",
  "expiryDate": "Registration Validity/Expiry date (keep original format like 14-Oct-2039)",
  "fuel": "Fuel type (DIESEL/PETROL/CNG/ELECTRIC)",
  "vehicleClass": "Vehicle Class (e.g. ARTICULATED VEHICLE (HGV))",
  "bodyType": "Body Type (e.g. MULTI AXLE TRAILER)",
  "financier": "Financier/Bank name",
  "address": "Owner's address",
  "emissionNorms": "Emission Norms (e.g. BHARAT STAGE VI)"
}

Rules:
- Read every single text element in the image carefully
- For Engine No and Chassis No, be extremely precise with each character
- Use null for fields genuinely not visible in any image
- Return ONLY the JSON object, no markdown, no backticks, no explanation`;

  // ═══════════════════════════════════════════
  //  DOM REFERENCES
  // ═══════════════════════════════════════════

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    stepItems: $$('.step-item'),
    connectors: $$('.step-connector'),
    panels: $$('.step-panel'),
    btnScan: $('#btn-scan'),
    btnAddRow: $('#btn-add-row'),
    btnBackUpload: $('#btn-back-upload'),
    btnScanMore: $('#btn-scan-more'),
    btnDownload: $('#btn-download'),
    btnToggleDebug: $('#btn-toggle-debug'),
    scanImg: $('#scan-current-img'),
    scanTitle: $('#scan-title'),
    scanStatus: $('#scan-status'),
    progressFill: $('#progress-fill'),
    progressText: $('#progress-text'),
    dataForm: $('#data-form'),
    dataTbody: $('#data-tbody'),
    emptyState: $('#empty-state'),
    vehicleCount: $('#vehicle-count'),
    dataTable: $('#data-table'),
    ocrDebug: $('#ocr-debug'),
    apiKeyInput: $('#gemini-api-key'),
    modeIndicator: $('#mode-indicator'),
    modeText: $('#mode-text'),
    toggleKeyVis: $('#toggle-key-vis'),
  };

  // ═══════════════════════════════════════════
  //  STEP NAVIGATION
  // ═══════════════════════════════════════════

  function goToStep(step) {
    state.currentStep = step;
    els.stepItems.forEach((el, i) => {
      const s = i + 1;
      el.classList.toggle('active', s === step);
      el.classList.toggle('completed', s < step);
    });
    els.connectors.forEach((el, i) => {
      el.classList.toggle('filled', (i + 1) < step);
    });
    els.panels.forEach((panel, i) => {
      panel.classList.toggle('active', i + 1 === step);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ═══════════════════════════════════════════
  //  API KEY MANAGEMENT
  // ═══════════════════════════════════════════

  function getApiKey() {
    return els.apiKeyInput.value.trim();
  }

  function setupApiKey() {
    // Check config.js first, then fallback to localStorage
    let configKey = '';
    if (typeof RC_SCANNER_CONFIG !== 'undefined' && RC_SCANNER_CONFIG.OCR_SPACE_API_KEY) {
      configKey = RC_SCANNER_CONFIG.OCR_SPACE_API_KEY;
    }

    let saved = '';
    try {
      saved = localStorage.getItem('rc_scanner_ocr_key') || '';
    } catch (e) {
      console.warn('localStorage is blocked by browser settings:', e);
    }
    const activeKey = configKey || saved;

    if (activeKey) {
      els.apiKeyInput.value = activeKey;
      updateModeIndicator(true);
    }

    // Save on change
    els.apiKeyInput.addEventListener('input', () => {
      const key = getApiKey();
      if (key.length > 5) {
        try {
          localStorage.setItem('rc_scanner_ocr_key', key);
        } catch (e) {
          console.warn('Failed to save to localStorage:', e);
        }
        updateModeIndicator(true);
      } else {
        updateModeIndicator(false);
      }
    });

    // Toggle visibility
    els.toggleKeyVis.addEventListener('click', () => {
      const input = els.apiKeyInput;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }

  function updateModeIndicator(hasKey) {
    const dot = els.modeIndicator.querySelector('.mode-dot');
    if (hasKey) {
      dot.className = 'mode-dot online';
      els.modeText.textContent = 'OCR.space ready — high-accuracy extraction enabled';
    } else {
      dot.className = 'mode-dot offline';
      els.modeText.textContent = 'No API key — enter key above for OCR.space extraction';
    }
  }

  // ═══════════════════════════════════════════
  //  IMAGE UPLOAD
  // ═══════════════════════════════════════════

  function setupUploadZones() {
    const types = ['front', 'back', 'form'];
    types.forEach(type => {
      const zone = $(`.upload-zone[data-type="${type}"]`);
      const input = $(`#file-${type}`);
      const card = $(`#card-${type}`);
      const preview = card.querySelector('.upload-preview');
      const previewImg = card.querySelector('.preview-img');
      const removeBtn = card.querySelector('.remove-btn');

      zone.addEventListener('click', () => input.click());
      input.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0], type, zone, preview, previewImg);
      });
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0], type, zone, preview, previewImg);
      });
      removeBtn.addEventListener('click', () => {
        state.images[type] = null;
        preview.hidden = true;
        zone.style.display = '';
        input.value = '';
        updateScanButton();
      });
    });
  }

  function handleFile(file, type, zone, preview, previewImg) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      state.images[type] = e.target.result;
      previewImg.src = e.target.result;
      zone.style.display = 'none';
      preview.hidden = false;
      updateScanButton();
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} image uploaded`, 'success');
    };
    reader.readAsDataURL(file);
  }

  function updateScanButton() {
    const hasAny = Object.values(state.images).some(v => v !== null);
    const key = getApiKey();
    const hasKey = key.length > 5;
    els.btnScan.disabled = !hasAny;

    if (hasAny && !hasKey) {
      els.btnScan.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 1h6v6H1z M17 1h6v6h-6z M1 17h6v6H1z M17 17h6v6h-6z" /><path d="M1 12h22" />
        </svg>
        Enter API Key First`;
      els.btnScan.disabled = true;
    } else if (hasAny && hasKey) {
      els.btnScan.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 1h6v6H1z M17 1h6v6h-6z M1 17h6v6H1z M17 17h6v6h-6z" /><path d="M1 12h22" />
        </svg>
        Start Scanning with OCR.space`;
      els.btnScan.disabled = false;
    }
  }

  // ═══════════════════════════════════════════
  //  SCAN COORDINATOR
  // ═══════════════════════════════════════════

  async function handleScan() {
    await scanWithOcrSpace();
  }

  // ═══════════════════════════════════════════
  //  OCR.SPACE FREE ENGINE
  // ═══════════════════════════════════════════

  async function scanWithOcrSpace() {
    const apiKey = getApiKey();
    if (!apiKey) {
      showToast('Please enter your OCR.space API key', 'error');
      return;
    }

    goToStep(2);
    const imagesToScan = Object.entries(state.images).filter(([, v]) => v !== null);
    const totalImages = imagesToScan.length;

    try {
      els.scanTitle.textContent = 'Analyzing with OCR.space...';
      const ocrTexts = {};

      for (let i = 0; i < imagesToScan.length; i++) {
        const [type, dataUrl] = imagesToScan[i];
        const label = type === 'form' ? 'Form 24' : `RC ${type.charAt(0).toUpperCase() + type.slice(1)}`;

        els.scanImg.src = dataUrl;
        els.scanTitle.textContent = `Scanning ${label}...`;
        const currentPct = Math.round((i / totalImages) * 100);
        els.progressFill.style.width = `${currentPct}%`;
        els.progressText.textContent = `${currentPct}%`;
        els.scanStatus.textContent = `Sending image ${i + 1} of ${totalImages} to OCR.space`;

        // OCR.space API call using multipart/form-data
        const formData = new FormData();
        formData.append('apikey', apiKey);
        formData.append('base64Image', dataUrl);
        formData.append('isOverlayRequired', 'false');
        formData.append('scale', 'true'); // Auto pre-process image for better contrast
        formData.append('OCREngine', '2'); // Engine 2 is much faster and reads small numbers better

        const response = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`OCR.space returned HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.IsErroredOnProcessing) {
          throw new Error(result.ErrorMessage || 'Processing error');
        }

        const parsedText = result.ParsedResults?.[0]?.ParsedText || '';
        ocrTexts[type] = parsedText;
        console.log(`[RC Scanner] OCR.space result for ${type}:`, parsedText);
      }

      state.rawAIOutput = JSON.stringify(ocrTexts, null, 2);

      // Mapped extraction logic using Regex patterns
      const parsedData = {};

      // Combine front and back OCR outputs into one text block to eliminate mismatch issues
      const combinedCardText = [ocrTexts.front || '', ocrTexts.back || ''].join('\n');
      const cardData = combinedCardText.trim() ? parseRCCard(combinedCardText) : {};
      const formData = ocrTexts.form ? parseForm24(ocrTexts.form) : {};

      // Combine extracted fields
      const merged = { ...cardData, ...formData };

      // Derive state and RTO from registration number
      if (merged.regNumber) {
        const regClean = merged.regNumber.replace(/\s+/g, '').toUpperCase();
        merged.regNumber = regClean;

        const stateCode = regClean.substring(0, 2);
        if (STATE_CODES[stateCode]) {
          merged.state = STATE_CODES[stateCode];
        }

        const rtoCode = regClean.substring(0, 4);
        if (RTO_DISTRICTS[rtoCode]) {
          merged.rto = RTO_DISTRICTS[rtoCode];
        }
      }

      // Determine registration type
      if (merged.regYear) {
        const year = parseInt(merged.regYear);
        if (year >= 2020) {
          merged.regType = 'New';
        } else {
          merged.regType = 'Old';
        }
      }

      state.extractedData = merged;

      els.progressFill.style.width = '100%';
      els.progressText.textContent = '100%';
      els.scanTitle.textContent = 'Scan Complete!';
      els.scanStatus.textContent = 'Data extracted successfully';

      await sleep(600);
      populateReviewForm();
      goToStep(3);

    } catch (err) {
      console.error('OCR.space Error:', err);
      showToast(err.message || 'OCR.space Scanning failed', 'error');
      goToStep(1);
    }
  }

  function parseRCCard(text) {
    const data = {};
    const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Registration Number
    for (let i = 0; i < lines.length; i++) {
      if (/Reg/i.test(lines[i])) {
        const sameLine = lines[i].match(/\b([A-Z]{2}\d{2}[A-Z0-9]{1,3}\d{4})\b/i);
        if (sameLine) { data.regNumber = sameLine[1].toUpperCase(); break; }
        if (i + 1 < lines.length) {
          const nextLine = lines[i+1].match(/\b([A-Z]{2}\d{2}[A-Z0-9]{1,3}\d{4})\b/i);
          if (nextLine) { data.regNumber = nextLine[1].toUpperCase(); break; }
        }
      }
    }
    if (!data.regNumber) {
      const generalMatch = clean.match(/\b([A-Z]{2}\s?\d{2}\s?[A-Z0-9]{1,3}\s?\d{4})\b/i);
      if (generalMatch) data.regNumber = generalMatch[1].replace(/\s/g, '').toUpperCase();
    }

    // 2. Chassis Number
    for (let i = 0; i < lines.length; i++) {
      if (/Chassis/i.test(lines[i])) {
        if (i + 1 < lines.length && /^[A-Z0-9]{15,20}$/i.test(lines[i+1])) {
          data.chassisNo = lines[i+1].toUpperCase();
          break;
        }
        const sameLine = lines[i].match(/\b([A-Z0-9]{15,20})\b/i);
        if (sameLine) { data.chassisNo = sameLine[1].toUpperCase(); break; }
      }
    }

    // 3. Engine Number
    for (let i = 0; i < lines.length; i++) {
      if (/Engine/i.test(lines[i]) || /Motor/i.test(lines[i])) {
        if (i + 1 < lines.length && /^[A-Z0-9]{5,20}$/i.test(lines[i+1]) && !/DIESEL|PETROL|CNG|ELECTRIC/i.test(lines[i+1])) {
          data.engineNo = lines[i+1].toUpperCase();
          break;
        }
        const sameLine = lines[i].match(/\b([A-Z0-9]{5,20})\b/i);
        if (sameLine && !/Engine/i.test(sameLine[1])) { data.engineNo = sameLine[1].toUpperCase(); break; }
      }
    }

    // 4. Owner Name
    for (let i = 0; i < lines.length; i++) {
      if (/Owner\s*Name/i.test(lines[i]) && i + 1 < lines.length) {
        data.ownerName = lines[i+1].toUpperCase();
        break;
      }
    }

    // 5. Fuel
    const fuelMatch = clean.match(/\b(DIESEL|PETROL|CNG|LPG|ELECTRIC|EV)\b/i);
    if (fuelMatch) data.fuel = fuelMatch[1].toUpperCase();

    // 6. Expiry / Validity
    for (let i = 0; i < lines.length; i++) {
      if (/Validity|Upto/i.test(lines[i]) && i + 1 < lines.length) {
        const dMatch = lines[i+1].match(/(\d{1,2}[-\/\s]\w{3,}[-\/\s]\d{4}|\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{4})/);
        if (dMatch) { data.expiryDate = dMatch[1].replace(/\s/g, '-'); break; }
      }
    }

    // 7. Reg Year (scan context lines near Mfg or Reg tags)
    for (let i = 0; i < lines.length; i++) {
      if (/Mfg|Manufacture|Reg/i.test(lines[i])) {
        let found = false;
        for (let offset = 0; offset <= 3; offset++) {
          if (i + offset < lines.length) {
            const match = lines[i+offset].match(/\b(\d{2}[-\/])?(\d{4})\b/);
            if (match && match[2] !== data.regNumber) {
              data.regYear = match[2];
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
    }

    // 8. Vehicle Make (Maker's name lookup)
    for (let i = 0; i < lines.length; i++) {
      if (/Maker/i.test(lines[i])) {
        for (let offset = 1; offset <= 3; offset++) {
          if (i + offset < lines.length) {
            const candidate = lines[i+offset];
            // Skip registration numbers and keyword headings
            if (!/\b([A-Z]{2}\d{2}[A-Z0-9]{1,3}\d{4})\b/i.test(candidate) && !/Model|Month|Class|Mfg/i.test(candidate)) {
              data.vehicleMake = candidate.toUpperCase();
              break;
            }
          }
        }
        break;
      }
    }

    // 9. Vehicle Model
    for (let i = 0; i < lines.length; i++) {
      if (/Model/i.test(lines[i])) {
        for (let offset = 1; offset <= 3; offset++) {
          if (i + offset < lines.length) {
            const candidate = lines[i+offset];
            // Skip pure dates (like 03/2021) and next section headings
            if (!/^\d{2}[-\/]\d{4}$/.test(candidate) && !/Laden|Colour|Body|Class/i.test(candidate)) {
              data.vehicleModel = candidate.toUpperCase();
              break;
            }
          }
        }
        break;
      }
    }

    return data;
  }

  function parseForm24(text) {
    const data = {};
    const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Registration Number
      if (/Registration\s*No/i.test(line)) {
        const match = line.match(/:\s*([A-Z0-9]{5,15})/i);
        if (match) data.regNumber = match[1].toUpperCase();
      }
      // Chassis Number
      if (/Chassis/i.test(line)) {
        const match = line.match(/:\s*([A-Z0-9]{15,20})/i);
        if (match) data.chassisNo = match[1].toUpperCase();
      }
      // Engine Number
      if (/Engine\s*No|Engine/i.test(line)) {
        const match = line.match(/:\s*([A-Z0-9]{5,20})/i);
        if (match) data.engineNo = match[1].toUpperCase();
      }
      // Owner Name
      if (/Owner\s*Name/i.test(line)) {
        const match = line.match(/:\s*([A-Z0-9\s,\/()&.-]{3,50})/i);
        if (match) data.ownerName = match[1].trim().toUpperCase();
      }
      // Maker's Name
      if (/Maker/i.test(line)) {
        const match = line.match(/:\s*([A-Z0-9\s,-]{3,50})/i);
        if (match) data.vehicleMake = match[1].trim().toUpperCase();
      }
      // Model Name
      if (/Model/i.test(line)) {
        const match = line.match(/:\s*([A-Z0-9\s\-\/]{3,50})/i);
        if (match) data.vehicleModel = match[1].trim().toUpperCase();
      }
      // Validity Expiry
      if (/Registration\s*valid\s*upto/i.test(line)) {
        const match = line.match(/(?:upto)\s*([0-9\-\/A-Za-z\s]{8,15})/i);
        if (match) data.expiryDate = match[1].trim().replace(/\s/g, '-');
      }
      // Mfg Year
      if (/Manufacture/i.test(line)) {
        const match = line.match(/:\s*(\d{1,2}\/\d{4})/);
        if (match) data.regYear = match[1].split('/')[1];
      }
    }

    return data;
  }

  // ═══════════════════════════════════════════
  //  REVIEW FORM
  // ═══════════════════════════════════════════

  function populateReviewForm() {
    const d = state.extractedData;

    // Show debug output
    els.ocrDebug.textContent = state.rawAIOutput || 'No raw output available';

    const fieldMap = {
      'f-regNumber': 'regNumber',
      'f-engineNo': 'engineNo',
      'f-chassisNo': 'chassisNo',
      'f-ownerName': 'ownerName',
      'f-vehicleMake': 'vehicleMake',
      'f-vehicleModel': 'vehicleModel',
      'f-regYear': 'regYear',
      'f-state': 'state',
      'f-rto': 'rto',
      'f-expiryDate': 'expiryDate',
    };

    let filledCount = 0;

    Object.entries(fieldMap).forEach(([inputId, key]) => {
      const input = $(`#${inputId}`);
      const srcEl = $(`#src-${key}`);
      const value = d[key];

      if (value && value !== 'null' && value !== null) {
        input.value = String(value);
        input.classList.add('auto-filled');
        if (srcEl) srcEl.textContent = '✓ Extracted by OCR.space';
        filledCount++;
      } else {
        input.value = '';
        input.classList.remove('auto-filled');
        if (srcEl) srcEl.textContent = '';
      }
    });

    // Registration Type
    const regTypeSelect = $('#f-regType');
    if (d.regType) {
      regTypeSelect.value = d.regType;
      const srcEl = $('#src-regType');
      if (srcEl) srcEl.textContent = '✓ Auto-determined';
    }

    // Clear manual fields
    ['f-deviceImei', 'f-contactNumber', 'f-aadharNo', 'f-smeZone', 'f-meDistrict', 'f-campLocation'].forEach(id => {
      $(`#${id}`).value = '';
    });

    showToast(`Extracted ${filledCount} fields from RC images!`, 'success');
  }

  function collectFormData() {
    return {
      srNo: state.vehicles.length + 1,
      regNumber: $('#f-regNumber').value.trim(),
      engineNo: $('#f-engineNo').value.trim(),
      chassisNo: $('#f-chassisNo').value.trim(),
      ownerName: $('#f-ownerName').value.trim(),
      vehicleMake: $('#f-vehicleMake').value.trim(),
      vehicleModel: $('#f-vehicleModel').value.trim(),
      regYear: $('#f-regYear').value.trim(),
      state: $('#f-state').value.trim(),
      rto: $('#f-rto').value.trim(),
      regType: $('#f-regType').value,
      expiryDate: $('#f-expiryDate').value.trim(),
      deviceImei: $('#f-deviceImei').value.trim(),
      contactNumber: $('#f-contactNumber').value.trim(),
      aadharNo: $('#f-aadharNo').value.trim(),
      smeZone: $('#f-smeZone').value.trim(),
      meDistrict: $('#f-meDistrict').value.trim(),
      campLocation: $('#f-campLocation').value.trim(),
    };
  }

  // ═══════════════════════════════════════════
  //  VEHICLE TABLE
  // ═══════════════════════════════════════════

  function addVehicleToTable(vehicle) {
    state.vehicles.push(vehicle);
    renderTable();
    updateExportUI();
    showToast(`Vehicle ${vehicle.regNumber || '#' + vehicle.srNo} added!`, 'success');
  }

  function removeVehicle(index) {
    state.vehicles.splice(index, 1);
    state.vehicles.forEach((v, i) => v.srNo = i + 1);
    renderTable();
    updateExportUI();
  }

  function renderTable() {
    const tbody = els.dataTbody;
    tbody.innerHTML = '';

    if (state.vehicles.length === 0) {
      els.emptyState.hidden = false;
      els.dataTable.querySelector('thead').style.display = 'none';
      return;
    }

    els.emptyState.hidden = true;
    els.dataTable.querySelector('thead').style.display = '';

    state.vehicles.forEach((v, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${v.srNo}</td>
        <td title="${v.regNumber}">${v.regNumber || '—'}</td>
        <td title="${v.engineNo}">${v.engineNo || '—'}</td>
        <td title="${v.chassisNo}">${v.chassisNo || '—'}</td>
        <td title="${v.ownerName}">${v.ownerName || '—'}</td>
        <td title="${v.vehicleMake}">${v.vehicleMake || '—'}</td>
        <td title="${v.vehicleModel}">${v.vehicleModel || '—'}</td>
        <td>${v.state || '—'}</td>
        <td>${v.rto || '—'}</td>
        <td>
          <button class="row-action-btn" data-index="${i}" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.row-action-btn').forEach(btn => {
      btn.addEventListener('click', () => removeVehicle(parseInt(btn.dataset.index)));
    });
  }

  function updateExportUI() {
    const count = state.vehicles.length;
    els.vehicleCount.textContent = count;
    els.btnDownload.disabled = count === 0;
  }

  // ═══════════════════════════════════════════
  //  EXCEL EXPORT
  // ═══════════════════════════════════════════

  function downloadExcel() {
    if (state.vehicles.length === 0) {
      showToast('No vehicles to export', 'error');
      return;
    }

    const rows = state.vehicles.map(v => ({
      'SR_NO': v.srNo,
      'DEVICE_IMEI': v.deviceImei,
      'State': v.state,
      'RTO': v.rto,
      'Registration Type': v.regType,
      'Vehicle Make': v.vehicleMake,
      'Vehicle Model': v.vehicleModel,
      'Registration Year': v.regYear,
      '\u00A0ENGINE_NO': v.engineNo,
      'CHASSIS_NO': v.chassisNo,
      '\u00A0VIN/REG_NUMBER*': v.regNumber,
      'NAME': v.ownerName,
      'Contact Number': v.contactNumber,
      'Aadhar No.': v.aadharNo,
      'Expiry Date': v.expiryDate,
      'SME Zone': v.smeZone,
      'ME District Office': v.meDistrict,
      'Camp Location': v.campLocation,
    }));

    const ws = XLSX.utils.json_to_sheet(rows, { header: EXCEL_COLUMNS });
    ws['!cols'] = EXCEL_COLUMNS.map(col => ({ wch: Math.max(col.length + 2, 15) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `RC_Vehicle_Data_${timestamp}.xlsx`);
    showToast(`Downloaded Excel with ${state.vehicles.length} vehicle(s)`, 'success');
  }

  // ═══════════════════════════════════════════
  //  RESET
  // ═══════════════════════════════════════════

  function resetForNewScan() {
    state.images = { front: null, back: null, form: null };
    state.extractedData = {};
    state.rawAIOutput = '';

    ['front', 'back', 'form'].forEach(type => {
      const card = $(`#card-${type}`);
      card.querySelector('.upload-zone').style.display = '';
      card.querySelector('.upload-preview').hidden = true;
      $(`#file-${type}`).value = '';
    });

    els.progressFill.style.width = '0%';
    els.progressText.textContent = '0%';
    els.ocrDebug.classList.remove('visible');

    updateScanButton();
    goToStep(1);
  }

  function setupApiKey() {
    function updateActiveKey() {
      let activeKey = '';

      // Check config.js
      if (typeof RC_SCANNER_CONFIG !== 'undefined' && RC_SCANNER_CONFIG.OCR_SPACE_API_KEY) {
        activeKey = RC_SCANNER_CONFIG.OCR_SPACE_API_KEY;
      }

      // Fallback to localStorage
      if (!activeKey) {
        try {
          activeKey = localStorage.getItem('rc_scanner_ocrspace_key') || '';
        } catch (e) {
          console.warn('localStorage is blocked:', e);
        }
      }

      els.apiKeyInput.value = activeKey;
      updateModeIndicator(activeKey.length > 5);
      updateScanButton();
    }

    // Bind text input change event
    els.apiKeyInput.addEventListener('input', () => {
      const key = getApiKey();
      if (key.length > 5) {
        try {
          localStorage.setItem('rc_scanner_ocrspace_key', key);
        } catch (e) {
          console.warn('Failed to save to localStorage:', e);
        }
        updateModeIndicator(true);
      } else {
        updateModeIndicator(false);
      }
      updateScanButton();
    });

    // Toggle visibility
    els.toggleKeyVis.addEventListener('click', () => {
      const input = els.apiKeyInput;
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Run once on load
    updateActiveKey();
  }

  function updateModeIndicator(hasKey) {
    const dot = els.modeIndicator.querySelector('.mode-dot');
    if (hasKey) {
      dot.className = 'mode-dot online';
      els.modeText.textContent = 'OCR.space ready — key loaded successfully';
    } else {
      dot.className = 'mode-dot offline';
      els.modeText.textContent = 'No API key — enter key above for OCR.space extraction';
    }
  }

  function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ═══════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════

  function init() {
    setupApiKey();
    setupUploadZones();

    els.btnScan.addEventListener('click', handleScan);

    els.btnAddRow.addEventListener('click', () => {
      const vehicle = collectFormData();
      if (!vehicle.regNumber && !vehicle.engineNo && !vehicle.chassisNo) {
        showToast('Please fill at least Registration, Engine, or Chassis number', 'error');
        return;
      }
      addVehicleToTable(vehicle);
      goToStep(4);
    });

    els.btnBackUpload.addEventListener('click', resetForNewScan);
    els.btnScanMore.addEventListener('click', resetForNewScan);
    els.btnDownload.addEventListener('click', downloadExcel);

    // Debug toggle
    els.btnToggleDebug.addEventListener('click', () => {
      els.ocrDebug.classList.toggle('visible');
      els.btnToggleDebug.textContent = els.ocrDebug.classList.contains('visible')
        ? 'Hide Raw AI Output' : 'Show Raw AI Output';
    });

    renderTable();
    updateExportUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
