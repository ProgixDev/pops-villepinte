/** Sentinel "no name yet" display string used before signup completes. */
export const GUEST_NAME = "Invité";

export function isGuestName(name: string): boolean {
  return name === GUEST_NAME || name.trim().length === 0;
}

/** Friendly form to use in greetings when we don't have a real name. */
export function displayNameOrFallback(name: string, fallback = "toi"): string {
  return isGuestName(name) ? fallback : name;
}
