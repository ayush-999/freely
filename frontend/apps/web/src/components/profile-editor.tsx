import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useForm } from "react-hook-form"
import { Loader2, Pencil, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { getApiErrorMessage } from "@workspace/utils"

import type { UserMe, UserUpdateRequest } from "@/types/identity"
import { getProfileWebsite } from "@/utils/profile"

type ProfileFormValues = {
  full_name: string
  bio: string
  website_url: string
  preferred_language: string
}

/** Mounted on demand as a modal; drafts reset from current data. */
export function ProfileEditor({
  user,
  onSave,
  onClose,
}: {
  user: UserMe
  onSave: (data: UserUpdateRequest) => Promise<unknown>
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      full_name: user.full_name,
      bio: user.bio ?? "",
      website_url: user.website_url ?? "",
      preferred_language: user.preferred_language ?? "",
    },
  })

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    panel.current
      ?.querySelector<HTMLInputElement>("#profile-full-name")
      ?.focus()
    return () => {
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", keyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", keyDown)
    }
  }, [isSubmitting, onClose])

  async function submit(values: ProfileFormValues) {
    setError(null)
    try {
      await onSave({
        full_name: values.full_name.trim(),
        bio: values.bio.trim() || null,
        website_url: getProfileWebsite(values.website_url),
        preferred_language: values.preferred_language.trim() || null,
      })
      onClose()
    } catch (saveError) {
      setError(
        typeof saveError === "string"
          ? saveError
          : getApiErrorMessage(saveError, "Could not update profile")
      )
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:py-16"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose()
      }}
    >
      <Card
        ref={panel}
        id="profile-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-editor-title"
        aria-describedby="profile-editor-description"
        aria-busy={isSubmitting}
        className="w-full max-w-2xl border-border/80 shadow-2xl"
      >
        <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border/60 bg-muted/30 py-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Pencil className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="profile-editor-title"
                className="font-semibold tracking-tight"
              >
                Edit Profile Details
              </h2>
              <CardDescription
                id="profile-editor-description"
                className="mt-1 text-xs"
              >
                Update your name, bio, website and preferred language.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close profile editor"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent className="pt-5">
          <form
            onSubmit={handleSubmit(submit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <fieldset
              disabled={isSubmitting}
              className="grid gap-4 disabled:opacity-70"
            >
              <div className="grid gap-2">
                <Label htmlFor="profile-full-name">Full name</Label>
                <Input
                  id="profile-full-name"
                  autoComplete="name"
                  aria-invalid={!!errors.full_name || undefined}
                  aria-describedby={
                    errors.full_name ? "profile-full-name-error" : undefined
                  }
                  {...register("full_name", {
                    validate: (value) =>
                      !!value.trim() || "Full name is required",
                    maxLength: {
                      value: 150,
                      message: "Full name must be at most 150 characters",
                    },
                  })}
                />
                {errors.full_name && (
                  <p
                    id="profile-full-name-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {errors.full_name.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="profile-bio">Bio</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Max 500 characters
                  </span>
                </div>
                <Textarea
                  id="profile-bio"
                  rows={3}
                  placeholder="Share a short bio with your network…"
                  aria-invalid={!!errors.bio || undefined}
                  aria-describedby={
                    errors.bio ? "profile-bio-error" : undefined
                  }
                  {...register("bio", {
                    maxLength: {
                      value: 500,
                      message: "Bio must be at most 500 characters",
                    },
                  })}
                />
                {errors.bio && (
                  <p
                    id="profile-bio-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {errors.bio.message}
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="profile-website">Website URL</Label>
                  <Input
                    id="profile-website"
                    type="url"
                    autoComplete="url"
                    placeholder="https://example.com"
                    aria-invalid={!!errors.website_url || undefined}
                    aria-describedby={
                      errors.website_url ? "profile-website-error" : undefined
                    }
                    {...register("website_url", {
                      maxLength: {
                        value: 500,
                        message: "Website URL must be at most 500 characters",
                      },
                      validate: (value) =>
                        !value.trim() ||
                        !!getProfileWebsite(value) ||
                        "Enter a valid http or https website URL",
                    })}
                  />
                  {errors.website_url && (
                    <p
                      id="profile-website-error"
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {errors.website_url.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-language">Preferred language</Label>
                  <Input
                    id="profile-language"
                    placeholder="en, hi, es, etc."
                    maxLength={20}
                    aria-invalid={!!errors.preferred_language || undefined}
                    aria-describedby={
                      errors.preferred_language
                        ? "profile-language-error"
                        : undefined
                    }
                    {...register("preferred_language", {
                      maxLength: {
                        value: 20,
                        message:
                          "Preferred language must be at most 20 characters",
                      },
                    })}
                  />
                  {errors.preferred_language && (
                    <p
                      id="profile-language-error"
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {errors.preferred_language.message}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-32"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>,
    document.body
  )
}
