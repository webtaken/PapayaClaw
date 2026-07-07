const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function isSafeSlug(value: string): boolean {
  return SLUG_RE.test(value);
}
