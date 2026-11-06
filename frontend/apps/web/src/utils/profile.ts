/** Existing stored website values can omit the scheme; only HTTP(S) is linked. */
export function getProfileWebsite(
  value: string | null | undefined
): string | null {
  const text = value?.trim()
  if (
    !text ||
    [...text].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  )
    return null
  if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text))
    return null
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
