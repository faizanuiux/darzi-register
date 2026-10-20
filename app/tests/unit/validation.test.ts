import { en } from '../../src/localization/en/common';
import { ur } from '../../src/localization/ur/common';
import {
  createCustomerFormSchema,
  type CustomerFormValues,
} from '../../src/features/customer-editor/validation/customerFormSchema';
import { EMPTY_MEASUREMENTS } from '../../src/types/customer';

function validForm(): CustomerFormValues {
  return {
    name: 'Ahmed Khan',
    phone: '+92 300 1234567',
    photoPath: null,
    measurements: { ...EMPTY_MEASUREMENTS, kameez_len: '42', bazu: '24½' },
    stitchingOptions: ['collar', 'cuff'],
    notes: 'Urgent delivery',
  };
}

describe('customerFormSchema', () => {
  const schema = createCustomerFormSchema(en);

  it('accepts a fully valid form', () => {
    const result = schema.safeParse(validForm());
    expect(result.success).toBe(true);
  });

  it('accepts an empty measurements/stitching/notes form', () => {
    const result = schema.safeParse({
      ...validForm(),
      measurements: { ...EMPTY_MEASUREMENTS },
      stitchingOptions: [],
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('preserves fractions and units in measurements as text', () => {
    const result = schema.safeParse(validForm());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurements.bazu).toBe('24½');
    }
  });

  it('rejects a missing name with the localized message', () => {
    const result = schema.safeParse({ ...validForm(), name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(en.editor.errors.nameRequired);
    }
  });

  it('rejects a whitespace-only name', () => {
    const result = schema.safeParse({ ...validForm(), name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(en.editor.errors.nameRequired);
    }
  });

  it('rejects a missing phone with the localized message', () => {
    const result = schema.safeParse({ ...validForm(), phone: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(en.editor.errors.phoneRequired);
    }
  });

  it.each(['abc', '12', '++--', 'not-a-number'])(
    'rejects invalid phone %p with the localized message',
    phone => {
      const result = schema.safeParse({ ...validForm(), phone });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(en.editor.errors.phoneInvalid);
      }
    },
  );

  it.each(['+92 300 1234567', '03001234567', '0300-1234567', '(0300) 1234567', '+1 555 123 4567'])(
    'accepts valid phone %p',
    phone => {
      const result = schema.safeParse({ ...validForm(), phone });
      expect(result.success).toBe(true);
    },
  );

  it('rejects an unknown stitching option key', () => {
    const result = schema.safeParse({
      ...validForm(),
      stitchingOptions: ['collar', 'not_a_real_option'],
    });
    expect(result.success).toBe(false);
  });

  it('uses Urdu error messages when built with Urdu strings', () => {
    const urSchema = createCustomerFormSchema(ur);
    const result = urSchema.safeParse({ ...validForm(), name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(ur.editor.errors.nameRequired);
    }
  });
});
