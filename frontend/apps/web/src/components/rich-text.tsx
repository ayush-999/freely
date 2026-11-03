import { Link } from "react-router-dom"

import { APP_ROUTES } from "@workspace/constants"

const tokenPattern = /[@#][\p{L}\p{N}_]+/gu
const hashtagPattern = /#[\p{L}\p{N}_]+/gu

function isTokenBoundary(value: string, index: number) {
  if (index === 0) {
    return true
  }

  return !/[\p{L}\p{N}_@]/u.test(value[index - 1] ?? "")
}

export function hasHashtag(body: string, tag: string) {
  const normalizedTag = tag.replace(/^#/, "").toLowerCase()
  return Array.from(body.matchAll(hashtagPattern)).some(
    ([match]) => match.slice(1).toLowerCase() === normalizedTag
  )
}

type RichTextProps = {
  children: string
}

/** Render post text while keeping mentions and hashtags navigable. */
export function RichText({ children }: RichTextProps) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0

  for (const match of children.matchAll(tokenPattern)) {
    const token = match[0]
    const index = match.index ?? 0

    if (!isTokenBoundary(children, index)) {
      continue
    }

    if (index > lastIndex) {
      parts.push(children.slice(lastIndex, index))
    }

    const value = token.slice(1)
    parts.push(
      token.startsWith("@") ? (
        <Link
          key={`${index}-${token}`}
          to={APP_ROUTES.user(value)}
          className="font-medium text-primary hover:underline"
        >
          {token}
        </Link>
      ) : (
        <Link
          key={`${index}-${token}`}
          to={APP_ROUTES.hashtag(value)}
          className="font-medium text-primary hover:underline"
        >
          {token}
        </Link>
      )
    )
    lastIndex = index + token.length
  }

  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex))
  }

  return <>{parts}</>
}
