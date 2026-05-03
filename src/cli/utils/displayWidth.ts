export function displayWidth(value: string): number {
  let width = 0;

  for (const char of value) {
    if (isControlCharacter(char)) {
      continue;
    }

    if (char === '\t') {
      width += 4;
      continue;
    }

    width += isWideCharacter(char) ? 2 : 1;
  }

  return width;
}

export function wrappedRowCount(value: string, columns: number): number {
  const safeColumns = Math.max(1, columns);
  const width = displayWidth(value);

  return Math.max(1, Math.ceil(width / safeColumns));
}

function isControlCharacter(char: string): boolean {
  const codePoint = char.codePointAt(0) ?? 0;
  return codePoint < 32 || (codePoint >= 0x7f && codePoint <= 0x9f);
}

function isWideCharacter(char: string): boolean {
  const codePoint = char.codePointAt(0) ?? 0;

  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  );
}
