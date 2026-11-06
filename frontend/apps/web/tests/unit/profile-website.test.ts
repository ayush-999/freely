import { describe, expect, it } from "vitest"
import { getProfileWebsite } from "@/utils/profile"

describe("profile website links", () => {
  it("supports existing values with or without an HTTP scheme", () => {
    expect(getProfileWebsite(" example.com/about ")).toBe(
      "https://example.com/about"
    )
    expect(getProfileWebsite("https://example.com/about")).toBe(
      "https://example.com/about"
    )
    expect(getProfileWebsite("http://example.com")).toBe("http://example.com/")
  })

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///C:/private.txt",
    "https://username:password@example.com",
    "https://example.com\n.evil.example",
    "",
  ])("does not turn unsafe stored website %s into a link", (value) => {
    expect(getProfileWebsite(value)).toBeNull()
  })
})
