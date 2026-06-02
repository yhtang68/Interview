import assert from 'assert';

export function requiredNumber(value: string | undefined, field: string): number {
    const number = Number(value);
    assert(value !== undefined && value !== '' && Number.isFinite(number), `Expected ${field} to be a number`);
    return number;
}
