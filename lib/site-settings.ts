/**
 * Site settings store boolean flags as the strings "true" / "false".
 * A missing or blank value defaults to ON so existing installs keep
 * the current live announcement countdown.
 */
export function isAnnouncementCountdownEnabled(
  value?: string | null
): boolean {
  return value?.trim().toLowerCase() !== "false";
}
