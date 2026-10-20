import type { MeasurementKey, StitchingOptionKey } from '../../types/customer';

export interface MeasurementFieldDef {
  key: MeasurementKey;
  labelEn: string;
  labelUr: string;
  /** Display order in forms and details. */
  order: number;
}

/** Exactly the nine measurement fields from the spec. Edit labels/order here only. */
export const MEASUREMENT_FIELDS: MeasurementFieldDef[] = [
  { key: 'kameez_len', labelEn: 'Length of Kameez', labelUr: 'لمبائی قمیض', order: 0 },
  { key: 'bazu', labelEn: 'Bazu', labelUr: 'بازو', order: 1 },
  { key: 'terah', labelEn: 'Terah', labelUr: 'تیراہ', order: 2 },
  { key: 'gala', labelEn: 'Gala', labelUr: 'گلہ', order: 3 },
  { key: 'chati', labelEn: 'Chati', labelUr: 'چھاتی', order: 4 },
  { key: 'kamar', labelEn: 'Kamar', labelUr: 'کمر', order: 5 },
  { key: 'gera', labelEn: 'Gera', labelUr: 'گیرا', order: 6 },
  { key: 'salwar_len', labelEn: 'Length of Salwar', labelUr: 'لمبائی شلوار', order: 7 },
  { key: 'payencha', labelEn: 'Payencha', labelUr: 'پائنچہ', order: 8 },
];

export interface StitchingOptionDef {
  key: StitchingOptionKey;
  labelEn: string;
  labelUr: string;
  order: number;
}

/** Exactly the eight stitching options from the spec. */
export const STITCHING_OPTIONS: StitchingOptionDef[] = [
  { key: 'front_jeeb', labelEn: 'Front pocket', labelUr: 'فرنٹ جیب', order: 0 },
  { key: 'single_jeeb', labelEn: 'Single-side pocket', labelUr: 'سنگل سائیڈ جیب', order: 1 },
  { key: 'double_jeeb', labelEn: 'Double-side pocket', labelUr: 'ڈبل سائیڈ جیب', order: 2 },
  { key: 'hip', labelEn: 'Hip', labelUr: 'ہپ', order: 3 },
  { key: 'collar', labelEn: 'Collar', labelUr: 'کالر', order: 4 },
  { key: 'bain', labelEn: 'Bain', labelUr: 'بین', order: 5 },
  { key: 'cuff', labelEn: 'Cuff', labelUr: 'کف', order: 6 },
  { key: 'plate', labelEn: 'Plate', labelUr: 'پلیٹ', order: 7 },
];

export const MEASUREMENT_KEYS = MEASUREMENT_FIELDS.map(f => f.key);
export const STITCHING_KEYS = STITCHING_OPTIONS.map(o => o.key);
