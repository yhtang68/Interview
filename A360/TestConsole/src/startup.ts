/**
 * Formats startup duration for the catalog-loading status displayed to the user.
 */

export const formatStartupElapsed = (milliseconds: number): string => {
  const totalTenths = Math.max(0, Math.floor(milliseconds / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
};