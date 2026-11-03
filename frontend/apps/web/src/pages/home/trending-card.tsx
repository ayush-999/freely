import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Hash, TrendingUp } from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Card } from "@workspace/ui/components/card"

import { socialService } from "@/services/social.service"
import type { TrendingHashtag } from "@/types"

export function TrendingCard() {
  const [tags, setTags] = useState<TrendingHashtag[] | null>(null)

  useEffect(() => {
    socialService
      .getTrendingHashtags()
      .then(setTags)
      .catch(() => setTags([]))
  }, [])

  return (
    <Card className="gap-0 overflow-hidden border-border/70 p-0 hover:shadow-sm">
      <div className="flex items-center gap-3 bg-gradient-to-br from-primary/10 to-transparent px-4 pt-4 pb-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <TrendingUp aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 className="text-base leading-tight font-semibold">Trending</h2>
          <p className="text-xs text-muted-foreground">Hashtags this week</p>
        </div>
      </div>

      {tags === null ? (
        <div aria-hidden="true" className="space-y-3 px-4 py-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <div className="size-6 animate-pulse rounded-md bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Hash aria-hidden="true" className="size-5" />
          </span>
          <p className="text-sm font-medium">Nothing trending yet</p>
          <p className="text-xs text-muted-foreground">
            Add a #hashtag to your post to start one.
          </p>
        </div>
      ) : (
        <ol className="p-2">
          {tags.map((item, index) => (
            <li key={item.tag}>
              <Link
                to={APP_ROUTES.hashtag(item.tag)}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    #{item.tag}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.post_count} {item.post_count === 1 ? "post" : "posts"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
