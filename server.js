const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { nanoid } = require("nanoid");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
const templatesDir = path.join(dataDir, "templates");
const reportsDir = path.join(dataDir, "reports");
const uploadsDir = path.join(dataDir, "uploads");

[templatesDir, reportsDir, uploadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const defaultSections = [
  { key: "cover", label: "Cover Page", enabled: true },
  { key: "toc", label: "Table of Contents", enabled: true },
  { key: "summary", label: "Summary Letter", enabled: true },
  { key: "narrative", label: "Narrative Sections", enabled: true },
  { key: "exhibits", label: "Exhibits", enabled: true },
  { key: "photos", label: "Photographs", enabled: true },
  { key: "depreciation", label: "Depreciation Tables", enabled: true }
];

const defaultLineItems = [
  { id: nanoid(), category: "5-year", description: "Carpeting", qty: 1200, unitCost: 8, totalOverride: null },
  { id: nanoid(), category: "5-year", description: "Millwork", qty: 1, unitCost: 12500, totalOverride: null },
  { id: nanoid(), category: "15-year", description: "Landscaping", qty: 1, unitCost: 18000, totalOverride: null },
  { id: nanoid(), category: "39-year", description: "Building Shell", qty: 1, unitCost: 325000, totalOverride: null }
];

const readJson = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const getTemplates = () => readJson(path.join(dataDir, "templates.json"), []);
const saveTemplates = (templates) => writeJson(path.join(dataDir, "templates.json"), templates);

const getReports = () => readJson(path.join(dataDir, "reports.json"), []);
const saveReports = (reports) => writeJson(path.join(dataDir, "reports.json"), reports);

app.get("/api/templates", (req, res) => {
  res.json(getTemplates());
});

app.post("/api/templates", upload.single("template"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Template PDF required." });
  }

  const templates = getTemplates();
  const id = nanoid();
  const templateName = req.body.name || req.file.originalname;
  const storedPath = path.join(templatesDir, `${id}.pdf`);

  fs.renameSync(req.file.path, storedPath);

  const template = {
    id,
    name: templateName,
    filePath: storedPath,
    sections: defaultSections,
    createdAt: new Date().toISOString()
  };

  templates.push(template);
  saveTemplates(templates);

  res.status(201).json(template);
});

app.post("/api/templates/:id/reports", (req, res) => {
  const templates = getTemplates();
  const template = templates.find((item) => item.id === req.params.id);

  if (!template) {
    return res.status(404).json({ error: "Template not found." });
  }

  const reports = getReports();
  const reportId = nanoid();

  const report = {
    id: reportId,
    templateId: template.id,
    name: req.body.name || `New Report ${new Date().toLocaleDateString()}`,
    fields: {
      owner: "",
      address: "",
      reportDate: new Date().toISOString().slice(0, 10),
      squareFootage: "",
      lotSize: "",
      placedInService: "",
      totalCostBasis: "",
      landValue: ""
    },
    sections: template.sections.map((section) => ({ ...section })),
    narrative: {
      summary: "We are pleased to provide this cost segregation summary letter.",
      methodology: "Our methodology follows IRS guidelines and industry best practices.",
      certifications: "We certify that this report was prepared by qualified professionals.",
      taxClassification: "Assets have been classified into appropriate recovery periods."
    },
    lineItems: defaultLineItems.map((item) => ({ ...item, id: nanoid() })),
    coverImagePath: "",
    photos: [],
    updatedAt: new Date().toISOString()
  };

  reports.push(report);
  saveReports(reports);

  writeJson(path.join(reportsDir, `${reportId}.json`), report);

  res.status(201).json(report);
});

app.get("/api/reports/:id", (req, res) => {
  const reportPath = path.join(reportsDir, `${req.params.id}.json`);
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: "Report not found." });
  }
  res.json(readJson(reportPath, {}));
});

app.put("/api/reports/:id", (req, res) => {
  const reportPath = path.join(reportsDir, `${req.params.id}.json`);
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: "Report not found." });
  }

  const report = { ...readJson(reportPath, {}), ...req.body, updatedAt: new Date().toISOString() };
  writeJson(reportPath, report);

  const reports = getReports().map((item) => (item.id === report.id ? report : item));
  saveReports(reports);

  res.json(report);
});

app.post("/api/reports/:id/cover", upload.single("cover"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Cover image required." });
  }

  const reportPath = path.join(reportsDir, `${req.params.id}.json`);
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: "Report not found." });
  }

  const ext = path.extname(req.file.originalname) || ".jpg";
  const coverPath = path.join(uploadsDir, `${req.params.id}-cover${ext}`);
  fs.renameSync(req.file.path, coverPath);

  const report = readJson(reportPath, {});
  report.coverImagePath = coverPath;
  report.updatedAt = new Date().toISOString();
  writeJson(reportPath, report);

  res.json({ coverImagePath: coverPath });
});

app.post("/api/reports/:id/export", async (req, res) => {
  const reportPath = path.join(reportsDir, `${req.params.id}.json`);
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: "Report not found." });
  }

  const report = readJson(reportPath, {});
  const template = getTemplates().find((item) => item.id === report.templateId);
  if (!template) {
    return res.status(404).json({ error: "Template not found." });
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (fs.existsSync(template.filePath)) {
    const templateBytes = fs.readFileSync(template.filePath);
    const templatePdf = await PDFDocument.load(templateBytes);
    const [coverPage] = await pdfDoc.copyPages(templatePdf, [0]);
    pdfDoc.addPage(coverPage);
  } else {
    pdfDoc.addPage();
  }

  const cover = pdfDoc.getPage(0);
  const { width, height } = cover.getSize();
  cover.drawText(report.fields.owner || "Owner", {
    x: 60,
    y: height - 140,
    size: 22,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1)
  });
  cover.drawText(report.fields.address || "Property Address", {
    x: 60,
    y: height - 170,
    size: 14,
    font,
    color: rgb(0.2, 0.2, 0.2)
  });

  if (report.coverImagePath && fs.existsSync(report.coverImagePath)) {
    const imageBytes = fs.readFileSync(report.coverImagePath);
    const embed = report.coverImagePath.toLowerCase().endsWith(".png")
      ? await pdfDoc.embedPng(imageBytes)
      : await pdfDoc.embedJpg(imageBytes);
    const imgDims = embed.scale(0.4);
    cover.drawImage(embed, {
      x: width - imgDims.width - 60,
      y: height - imgDims.height - 120,
      width: imgDims.width,
      height: imgDims.height
    });
  }

  const addSectionPage = (title) => {
    const page = pdfDoc.addPage();
    page.drawText(title, { x: 50, y: 760, size: 20, font: boldFont });
    return page;
  };

  const enabledSections = report.sections.filter((section) => section.enabled);

  if (enabledSections.some((section) => section.key === "toc")) {
    const page = addSectionPage("Table of Contents");
    let y = 710;
    enabledSections
      .filter((section) => section.key !== "toc")
      .forEach((section, index) => {
        page.drawText(`${section.label}`, { x: 60, y, size: 12, font });
        page.drawText(`${index + 2}`, { x: 500, y, size: 12, font });
        y -= 20;
      });
  }

  if (enabledSections.some((section) => section.key === "summary")) {
    const page = addSectionPage("Summary Letter");
    page.drawText(report.narrative.summary, { x: 60, y: 710, size: 12, font, maxWidth: 480 });
  }

  if (enabledSections.some((section) => section.key === "narrative")) {
    const page = addSectionPage("Narrative Sections");
    let y = 710;
    ["methodology", "certifications", "taxClassification"].forEach((key) => {
      page.drawText(report.narrative[key], { x: 60, y, size: 12, font, maxWidth: 480 });
      y -= 80;
    });
  }

  if (enabledSections.some((section) => section.key === "exhibits")) {
    const page = addSectionPage("Exhibits");
    page.drawText("Property Facts", { x: 60, y: 720, size: 14, font: boldFont });
    const facts = [
      ["Square Footage", report.fields.squareFootage],
      ["Lot Size", report.fields.lotSize],
      ["Placed in Service", report.fields.placedInService],
      ["Total Cost Basis", report.fields.totalCostBasis],
      ["Land Value", report.fields.landValue]
    ];
    let y = 690;
    facts.forEach(([label, value]) => {
      page.drawText(label, { x: 60, y, size: 12, font });
      page.drawText(value || "-", { x: 250, y, size: 12, font });
      y -= 20;
    });
  }

  if (enabledSections.some((section) => section.key === "photos")) {
    const page = addSectionPage("Photographs");
    page.drawText("Photos can be uploaded in the Photos section (MVP placeholder).", {
      x: 60,
      y: 710,
      size: 12,
      font
    });
  }

  if (enabledSections.some((section) => section.key === "depreciation")) {
    const page = addSectionPage("Depreciation Tables");
    let y = 710;
    page.drawText("Category", { x: 60, y, size: 12, font: boldFont });
    page.drawText("Description", { x: 160, y, size: 12, font: boldFont });
    page.drawText("Qty", { x: 360, y, size: 12, font: boldFont });
    page.drawText("Total", { x: 430, y, size: 12, font: boldFont });
    y -= 20;

    report.lineItems.forEach((item) => {
      const total = item.totalOverride ?? item.qty * item.unitCost;
      page.drawText(item.category, { x: 60, y, size: 11, font });
      page.drawText(item.description, { x: 160, y, size: 11, font, maxWidth: 180 });
      page.drawText(String(item.qty), { x: 360, y, size: 11, font });
      page.drawText(`$${total.toLocaleString()}`, { x: 430, y, size: 11, font });
      y -= 18;
    });
  }

  const pdfBytes = await pdfDoc.save();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=report-${report.id}.pdf`);
  res.send(Buffer.from(pdfBytes));
});

app.get("/api/reports/:id/export-json", (req, res) => {
  const reportPath = path.join(reportsDir, `${req.params.id}.json`);
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: "Report not found." });
  }
  res.download(reportPath, `report-${req.params.id}.json`);
});

app.post("/api/reports/import", upload.single("report"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Report JSON required." });
  }
  const data = JSON.parse(fs.readFileSync(req.file.path, "utf8"));
  const reportId = nanoid();
  const report = { ...data, id: reportId, updatedAt: new Date().toISOString() };
  writeJson(path.join(reportsDir, `${reportId}.json`), report);

  const reports = getReports();
  reports.push(report);
  saveReports(reports);

  fs.unlinkSync(req.file.path);

  res.status(201).json(report);
});

app.listen(PORT, () => {
  console.log(`Cost Seg Report Builder running on http://localhost:${PORT}`);
});
