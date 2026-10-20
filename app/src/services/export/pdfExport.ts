// Single-customer PDF export via react-native-html-to-pdf.
//
// URDU SHAPING LIMITATION (read before shipping): the HTML is rendered to PDF
// by the platform WebView print pipeline (Android) / WKWebView (iOS). Complex
// scripts like Urdu/Arabic are NOT reliably shaped there — letters can appear
// disconnected or in the wrong visual order, and some devices substitute a
// fallback font that drops characters. The Urdu labels below are included so
// the layout can be eyeballed, but every PDF must be visually verified on a
// real device before release. If shaping is broken on the target devices,
// switch `locale` to 'en' (English-only PDF) until a proper fix lands — there
// is no in-app workaround today. A one-shot generation test could not be run
// here (no Android/iOS runtime in this environment); verify on-device.

import { generatePDF } from 'react-native-html-to-pdf';
import { readFile } from 'react-native-fs';
import type { Customer } from '../../types/customer';
import { MEASUREMENT_FIELDS, STITCHING_OPTIONS } from '../../core/constants/fields';
import { resolvePhoto } from '../images/imageService';

export type PdfLocale = 'en' | 'ur';

export interface PdfHtmlOptions {
  /** Base64 JPEG data (no data: prefix). Embedded as <img> when provided. */
  photoBase64?: string;
  /** Label language. Default 'en'. See the Urdu-shaping note above. */
  locale?: PdfLocale;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Build the printable HTML for a customer. Pure — safe to unit test. */
export function buildCustomerPdfHtml(customer: Customer, options: PdfHtmlOptions = {}): string {
  const locale: PdfLocale = options.locale ?? 'en';

  const measurementRows = MEASUREMENT_FIELDS.map(field => {
    const label = locale === 'ur' ? field.labelUr : field.labelEn;
    const value = customer.measurements[field.key] || '—';
    return `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`;
  }).join('');

  const selectedOptions = STITCHING_OPTIONS.filter(opt =>
    customer.stitchingOptions.includes(opt.key),
  );
  const stitchingHtml =
    selectedOptions.length > 0
      ? `<ul>${selectedOptions
          .map(opt => `<li>${escapeHtml(locale === 'ur' ? opt.labelUr : opt.labelEn)}</li>`)
          .join('')}</ul>`
      : `<p class="muted">—</p>`;

  const photoHtml = options.photoBase64
    ? `<img class="photo" src="data:image/jpeg;base64,${options.photoBase64}" alt="Customer photo" />`
    : '';

  const title = locale === 'ur' ? 'گاہک کا ریکارڈ' : 'Customer Record';
  const nameLabel = locale === 'ur' ? 'نام' : 'Name';
  const phoneLabel = locale === 'ur' ? 'موبائل نمبر' : 'Mobile';
  const measurementsLabel = locale === 'ur' ? 'پیمائش' : 'Measurements';
  const stitchingLabel = locale === 'ur' ? 'سلائی کے آپشن' : 'Stitching options';
  const notesLabel = locale === 'ur' ? 'نوٹس' : 'Notes';
  const dateLabel = locale === 'ur' ? 'تاریخ' : 'Date';

  const date = new Date(customer.updatedAt);
  const dateText = Number.isNaN(date.getTime()) ? customer.updatedAt : date.toLocaleDateString();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: sans-serif; color: #1c2420; margin: 0; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px 0; }
  .subtitle { color: #6b7570; font-size: 13px; margin-bottom: 16px; }
  .photo { width: 140px; height: 180px; object-fit: cover; border: 1px solid #e3e8e5; margin-bottom: 16px; }
  .field { margin-bottom: 6px; font-size: 15px; }
  .field .k { color: #6b7570; }
  h2 { font-size: 16px; margin: 20px 0 8px 0; border-bottom: 2px solid #0e5f4a; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  td { border: 1px solid #e3e8e5; padding: 8px 10px; }
  td.label { width: 45%; color: #6b7570; }
  td.value { font-weight: 600; }
  ul { margin: 4px 0; padding-left: 20px; font-size: 15px; }
  .muted { color: #6b7570; }
  .notes { font-size: 15px; white-space: pre-wrap; }
  .footer { margin-top: 24px; font-size: 12px; color: #6b7570; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="subtitle">Darzi Register</div>
  ${photoHtml}
  <div class="field"><span class="k">${escapeHtml(nameLabel)}:</span> <strong>${escapeHtml(customer.name)}</strong></div>
  <div class="field"><span class="k">${escapeHtml(phoneLabel)}:</span> ${escapeHtml(customer.phone)}</div>
  <h2>${escapeHtml(measurementsLabel)}</h2>
  <table>${measurementRows}</table>
  <h2>${escapeHtml(stitchingLabel)}</h2>
  ${stitchingHtml}
  <h2>${escapeHtml(notesLabel)}</h2>
  <div class="notes">${escapeHtml(customer.notes) || '—'}</div>
  <div class="footer">${escapeHtml(dateLabel)}: ${escapeHtml(dateText)}</div>
</body>
</html>`;
}

/**
 * Generate a PDF file for one customer and return its absolute file path.
 * The photo is embedded as base64 when the stored photo file still exists;
 * a missing photo is skipped silently (never fails the export).
 */
export async function generateCustomerPdf(
  customer: Customer,
  options: { locale?: PdfLocale } = {},
): Promise<string> {
  let photoBase64: string | undefined;
  const photoAbs = await resolvePhoto(customer.photoPath);
  if (photoAbs) {
    try {
      photoBase64 = await readFile(photoAbs, 'base64');
    } catch {
      // Photo unreadable (deleted externally, bad permissions) — export without it.
      photoBase64 = undefined;
    }
  }

  const html = buildCustomerPdfHtml(customer, {
    photoBase64,
    locale: options.locale,
  });

  const result = await generatePDF({
    html,
    fileName: `darzi-${customer.id}`,
    base64: false,
  });
  return result.filePath;
}
