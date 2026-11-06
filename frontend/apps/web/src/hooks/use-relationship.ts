import { useEffect, useRef, useState } from "react"
import axios from "axios"
import { tokenStorage } from "@workspace/auth"
import { getApiErrorMessage } from "@workspace/utils"
import { useAuth } from "./use-auth"
import { relationshipService } from "@/services/relationship.service"
import type { RelationshipSummary } from "@/types/relationship"

export const RELATIONSHIP_CHANGED = "freely:relationship-changed"

export function useRelationship(handle: string) {
  const { user, isAuthenticated } = useAuth()
  const viewer = isAuthenticated ? (user?.user_handle ?? "") : ""
  const key = `${viewer}:${handle}`
  const [resource, setResource] = useState<{
    key: string
    data: RelationshipSummary | null
    error: string | null
  }>({ key: "", data: null, error: null })
  const [revision, setRevision] = useState(0)
  const [pending, setPending] = useState<string | null>(null)
  const scope = useRef<{
    key: string
    abort: AbortController
    token: string | null
    pending: boolean
  } | null>(null)

  useEffect(() => {
    const current = {
      key,
      abort: new AbortController(),
      token: tokenStorage.get(),
      pending: false,
    }
    scope.current = current
    relationshipService
      .summary(handle, { signal: current.abort.signal, token: current.token })
      .then((data) => {
        if (!current.abort.signal.aborted)
          setResource({ key, data, error: null })
      })
      .catch((error: unknown) => {
        if (!current.abort.signal.aborted && !axios.isCancel(error))
          setResource({
            key,
            data: null,
            error: getApiErrorMessage(error, "Could not load this network."),
          })
      })
    return () => current.abort.abort()
  }, [handle, key, revision])

  useEffect(() => {
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ viewer: string; target: string }>)
        .detail
      if (
        detail?.viewer === viewer &&
        (handle === detail.target || handle === viewer)
      )
        setRevision((value) => value + 1)
    }
    window.addEventListener(RELATIONSHIP_CHANGED, changed)
    return () => window.removeEventListener(RELATIONSHIP_CHANGED, changed)
  }, [handle, viewer])

  async function toggle() {
    const current = scope.current
    const data = resource.key === key ? resource.data : null
    if (
      !isAuthenticated ||
      !data ||
      data.is_self ||
      !current ||
      current.key !== key ||
      current.pending
    )
      return
    current.pending = true
    setPending(key)
    try {
      const request = { signal: current.abort.signal, token: current.token }
      const updated = await (data.is_following
        ? relationshipService.unfollow(handle, request)
        : relationshipService.follow(handle, request))
      if (current.abort.signal.aborted) return
      setResource({ key, data: updated, error: null })
      window.dispatchEvent(
        new CustomEvent(RELATIONSHIP_CHANGED, {
          detail: { viewer, target: handle },
        })
      )
    } catch (error) {
      if (!current.abort.signal.aborted && !axios.isCancel(error))
        setResource({
          key,
          data,
          error: getApiErrorMessage(
            error,
            "Could not update this follow relationship."
          ),
        })
    } finally {
      current.pending = false
      setPending((value) => (value === key ? null : value))
    }
  }
  const current = resource.key === key ? resource : null
  return {
    summary: current?.data ?? null,
    error: current?.error ?? null,
    loading: !current || (!current.data && !current.error),
    busy: pending === key,
    toggle,
    retry: () => setRevision((value) => value + 1),
    isAuthenticated,
    viewer,
  }
}
