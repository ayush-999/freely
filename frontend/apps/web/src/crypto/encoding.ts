export function encode64(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decode64(text: string): Uint8Array {
  const binary = atob(text)
  return Uint8Array.from(binary, (value) => value.charCodeAt(0))
}

export function equalBytes(left: string, right: string): boolean {
  const a = decode64(left)
  const b = decode64(right)
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index++)
    difference |= a[index] ^ b[index]
  return difference === 0
}
