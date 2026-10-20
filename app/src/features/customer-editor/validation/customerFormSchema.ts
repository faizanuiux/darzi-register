import { z } from 'zod';
import { STITCHING_KEYS } from '../../../core/constants/fields';
import type { Strings } from '../../../localization/en/common';
import type { Measurements, StitchingOptionKey } from '../../../types/customer';

/**
 * Accepts digits plus the separators people actually type in phone numbers
 * (+, spaces, dashes, dots, parentheses). Requires at least 7 characters
 * so obviously-short input is rejected; detailed carrier validation is
 * intentionally out of scope.
 */
export const PHONE_PATTERN = /^[+()\-.\s\d]{7,20}$/;

const stitchingOptionsSchema = z.array(
  z.enum(STITCHING_KEYS as [StitchingOptionKey, ...StitchingOptionKey[]]),
);

const measurementsSchema = z.object({
  kameez_len: z.string(),
  bazu: z.string(),
  terah: z.string(),
  gala: z.string(),
  chati: z.string(),
  kamar: z.string(),
  gera: z.string(),
  salwar_len: z.string(),
  payencha: z.string(),
}) satisfies z.ZodType<Measurements>;

/**
 * Builds the customer form schema with localized error messages.
 * Pass the current Strings so name/phone errors read in the UI language.
 */
export function createCustomerFormSchema(s: Strings) {
  return z.object({
    name: z.string().trim().min(1, s.editor.errors.nameRequired),
    phone: z
      .string()
      .trim()
      .min(1, s.editor.errors.phoneRequired)
      .regex(PHONE_PATTERN, s.editor.errors.phoneInvalid),
    photoPath: z.string().nullable(),
    measurements: measurementsSchema,
    stitchingOptions: stitchingOptionsSchema,
    notes: z.string(),
  });
}

export type CustomerFormValues = z.infer<ReturnType<typeof createCustomerFormSchema>>;
