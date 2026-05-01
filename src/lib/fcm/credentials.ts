const DECIMAL_INTEGER = /^\d+$/;
const EXTRA_FIELD_AFTER_VALUE = /^(\d+)(?=\s+[a-z_][a-z0-9_-]*\s*[:=])/i;

export function normalizeFcmNumericCredential(value: unknown, fieldName: string): string {
    const raw = typeof value === 'string' ? value.trim() : String(value ?? '').trim();

    if (DECIMAL_INTEGER.test(raw)) {
        return raw;
    }

    const leadingValue = raw.match(EXTRA_FIELD_AFTER_VALUE)?.[1];
    if (leadingValue) {
        return leadingValue;
    }

    throw new Error(`${fieldName} must be a decimal integer`);
}
