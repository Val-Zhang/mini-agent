export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`);
  }

  return value;
}

export function requireNonEmptyString(value: unknown, name: string): string {
  const text = requireString(value, name);

  if (text.length === 0) {
    throw new Error(`${name} must not be empty`);
  }

  return text;
}
