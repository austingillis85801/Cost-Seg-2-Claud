const statusEl = document.getElementById("status");
const templateForm = document.getElementById("template-form");
const templateSelect = document.getElementById("template-select");
const refreshTemplatesBtn = document.getElementById("refresh-templates");
const createReportForm = document.getElementById("create-report-form");
const fieldsForm = document.getElementById("fields-form");
const sectionsList = document.getElementById("sections-list");
const narrativeInputs = {
  summary: document.querySelector("textarea[name='summary']"),
  methodology: document.querySelector("textarea[name='methodology']"),
  certifications: document.querySelector("textarea[name='certifications']"),
  taxClassification: document.querySelector("textarea[name='taxClassification']"),
};
const findText = document.getElementById("find-text");
const replaceText = document.getElementById("replace-text");
const findReplaceBtn = document.getElementById("find-replace");
const saveNarrativeBtn = document.getElementById("save-narrative");
const lineItemsBody = document.getElementById("line-items-body");
const lineItemsTotals = document.getElementById("line-item-totals");
const addLineItemBtn = document.getElementById("add-line-item");
const saveLineItemsBtn = document.getElementById("save-line-items");
const coverForm = document.getElementById("cover-form");
const coverPreview = document.getElementById("cover-preview");
const exportPdfBtn = document.getElementById("export-pdf");
const exportJsonBtn = document.getElementById("export-json");

let currentReport = null;
let templates = [];

const setStatus = (text) => {
  statusEl.textContent = text;
};

const fetchTemplates = async () => {
  const response = await fetch("/api/templates");
  templates = await response.json();
  templateSelect.innerHTML = templates
    .map((template) => `<option value="${template.id}">${template.name}</option>`)
    .join("");
};

const loadReport = async (reportId) => {
  const response = await fetch(`/api/reports/${reportId}`);
  currentReport = await response.json();
  hydrateForm();
};

const hydrateForm = () => {
  if (!currentReport) return;
  Object.entries(currentReport.fields).forEach(([key, value]) => {
    const input = fieldsForm.querySelector(`[name='${key}']`);
    if (input) input.value = value;
  });

  Object.entries(currentReport.narrative).forEach(([key, value]) => {
    if (narrativeInputs[key]) narrativeInputs[key].value = value;
  });

  sectionsList.innerHTML = currentReport.sections
    .map(
      (section) => `
      <label class="checkbox">
        <input type="checkbox" data-section="${section.key}" ${section.enabled ? "checked" : ""} />
        ${section.label}
      </label>
    `
    )
    .join("");

  renderLineItems();

  coverPreview.innerHTML = currentReport.coverImagePath
    ? `<p>Cover uploaded ✅</p>`
    : `<p>No cover image uploaded yet.</p>`;
};

const saveReport = async () => {
  if (!currentReport) return;
  await fetch(`/api/reports/${currentReport.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(currentReport),
  });
  setStatus("Saved");
};

const renderLineItems = () => {
  lineItemsBody.innerHTML = currentReport.lineItems
    .map(
      (item) => `
      <tr data-id="${item.id}">
        <td><input value="${item.category}" data-field="category" /></td>
        <td><input value="${item.description}" data-field="description" /></td>
        <td><input type="number" value="${item.qty}" data-field="qty" /></td>
        <td><input type="number" value="${item.unitCost}" data-field="unitCost" /></td>
        <td><input type="number" value="${item.totalOverride ?? ""}" placeholder="auto" data-field="totalOverride" /></td>
        <td><button type="button" class="remove" data-action="remove">Remove</button></td>
      </tr>
    `
    )
    .join("");

  updateTotals();
};

const updateTotals = () => {
  const totalsByCategory = {};
  let grandTotal = 0;

  currentReport.lineItems.forEach((item) => {
    const total = item.totalOverride ?? item.qty * item.unitCost;
    totalsByCategory[item.category] = (totalsByCategory[item.category] || 0) + total;
    grandTotal += total;
  });

  lineItemsTotals.innerHTML = `
    <strong>Totals:</strong>
    ${Object.entries(totalsByCategory)
      .map(([category, total]) => `<div>${category}: $${total.toLocaleString()}</div>`)
      .join("")}
    <div class="grand">Grand Total: $${grandTotal.toLocaleString()}</div>
  `;
};

refreshTemplatesBtn.addEventListener("click", fetchTemplates);

templateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(templateForm);
  setStatus("Uploading template...");
  const response = await fetch("/api/templates", { method: "POST", body: formData });
  if (response.ok) {
    setStatus("Template saved");
    await fetchTemplates();
  } else {
    setStatus("Template upload failed");
  }
});

createReportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const templateId = templateSelect.value;
  if (!templateId) return;
  setStatus("Creating report...");
  const reportName = createReportForm.reportName.value;
  const response = await fetch(`/api/templates/${templateId}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: reportName }),
  });
  if (response.ok) {
    const report = await response.json();
    await loadReport(report.id);
    setStatus("Report loaded");
  } else {
    setStatus("Report creation failed");
  }
});

fieldsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentReport) return;
  const formData = new FormData(fieldsForm);
  currentReport.fields = Object.fromEntries(formData.entries());
  await saveReport();
});

sectionsList.addEventListener("change", async (event) => {
  if (!currentReport) return;
  if (event.target.matches("input[type='checkbox']")) {
    const key = event.target.dataset.section;
    currentReport.sections = currentReport.sections.map((section) =>
      section.key === key ? { ...section, enabled: event.target.checked } : section
    );
    await saveReport();
  }
});

findReplaceBtn.addEventListener("click", () => {
  const findValue = findText.value;
  const replaceValue = replaceText.value;
  if (!findValue) return;

  Object.keys(narrativeInputs).forEach((key) => {
    narrativeInputs[key].value = narrativeInputs[key].value.split(findValue).join(replaceValue);
  });
});

saveNarrativeBtn.addEventListener("click", async () => {
  if (!currentReport) return;
  currentReport.narrative = {
    summary: narrativeInputs.summary.value,
    methodology: narrativeInputs.methodology.value,
    certifications: narrativeInputs.certifications.value,
    taxClassification: narrativeInputs.taxClassification.value,
  };
  await saveReport();
});

lineItemsBody.addEventListener("input", (event) => {
  if (!currentReport) return;
  const row = event.target.closest("tr");
  if (!row) return;
  const id = row.dataset.id;
  const field = event.target.dataset.field;
  const value = event.target.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value;

  currentReport.lineItems = currentReport.lineItems.map((item) =>
    item.id === id ? { ...item, [field]: field === "totalOverride" && value === "" ? null : value } : item
  );
  updateTotals();
});

lineItemsBody.addEventListener("click", (event) => {
  if (event.target.dataset.action === "remove") {
    const row = event.target.closest("tr");
    currentReport.lineItems = currentReport.lineItems.filter((item) => item.id !== row.dataset.id);
    renderLineItems();
  }
});

addLineItemBtn.addEventListener("click", () => {
  if (!currentReport) return;
  currentReport.lineItems.push({
    id: crypto.randomUUID(),
    category: "5-year",
    description: "New Item",
    qty: 1,
    unitCost: 0,
    totalOverride: null,
  });
  renderLineItems();
});

saveLineItemsBtn.addEventListener("click", saveReport);

coverForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentReport) return;
  const formData = new FormData(coverForm);
  const response = await fetch(`/api/reports/${currentReport.id}/cover`, {
    method: "POST",
    body: formData,
  });
  if (response.ok) {
    const data = await response.json();
    currentReport.coverImagePath = data.coverImagePath;
    coverPreview.innerHTML = `<p>Cover uploaded ✅</p>`;
    setStatus("Cover uploaded");
  } else {
    setStatus("Cover upload failed");
  }
});

exportPdfBtn.addEventListener("click", () => {
  if (!currentReport) return;
  window.location.href = `/api/reports/${currentReport.id}/export`;
});

exportJsonBtn.addEventListener("click", () => {
  if (!currentReport) return;
  window.location.href = `/api/reports/${currentReport.id}/export-json`;
});

fetchTemplates();
