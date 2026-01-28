# Cost Seg Report Builder

A template-driven web app to turn a cost segregation report PDF into reusable templates and create new property reports with editable sections, line items, and exportable PDFs.

## MVP workflow

1. Upload your existing cost segregation report PDF as a template.
2. Create a new report from the template.
3. Edit owner/address, toggle sections, update line items, and replace the cover photo.
4. Export a polished PDF and/or a JSON file for reuse.

## Tech stack

- Node.js + Express
- pdf-lib for PDF output
- Local JSON storage on disk (no external services required)

## Local setup

```bash
npm install
npm run start
```

Then open: `http://localhost:3000`

## Using the app

### 1) Upload a template PDF

- Provide a name and the PDF file.
- The PDF is stored locally under `data/templates`.

### 2) Create a new report

- Select a template, name your report, and create it.
- The report data is stored in `data/reports/<report-id>.json`.

### 3) Edit sections + line items

- Toggle sections to include/exclude content. The Table of Contents is regenerated on export.
- Update line item quantities and unit costs. Totals auto-recalculate, with optional manual override.

### 4) Replace the cover photo

- Upload a cover image to be used on the cover page in the exported PDF.

### 5) Export

- **Export Final PDF**: Generates a new PDF using the template cover + updated content.
- **Export Report JSON**: Downloads the report as JSON for later reuse.

## Template-driven approach

This MVP stores your template PDF and a structured report model (fields, narrative sections, line items, images). On export, a new PDF is generated from the model while preserving the template cover page for consistent branding. In a full build, you can expand the template setup screen to map sections and field positions more precisely.

## File storage

- `data/templates`: template PDFs
- `data/reports`: report JSON files
- `data/templates.json`: template catalog
- `data/reports.json`: report catalog

## Future enhancements

- Admin template setup screen for fine-grained PDF mapping
- Role-based access
- Report version history
- Diff view against template
