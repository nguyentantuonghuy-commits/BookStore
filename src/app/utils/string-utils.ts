/**
 * Utility to strip Vietnamese diacritics (accents) from a string,
 * enabling accent-insensitive searching (e.g., matching "Người" with "nguoi").
 */
export function removeAccents(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}
