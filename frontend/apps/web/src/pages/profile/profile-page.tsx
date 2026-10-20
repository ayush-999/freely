import { useState } from "react"
import { useForm } from "react-hook-form"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { formatDate } from "@workspace/utils"

import { useAuth } from "@/hooks/use-auth"

type ProfileFormValues = {
  full_name: string
  bio: string
  website_url: string
  preferred_language: string
}

export function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      full_name: user?.full_name ?? "",
      bio: user?.bio ?? "",
      website_url: user?.website_url ?? "",
      preferred_language: user?.preferred_language ?? "",
    },
  })
  const [message, setMessage] = useState<string | null>(null)

  if (!user) {
    return null
  }

  async function onSubmit(values: ProfileFormValues) {
    setMessage(null)
    try {
      await updateProfile({
        full_name: values.full_name,
        bio: values.bio || undefined,
        website_url: values.website_url || undefined,
        preferred_language: values.preferred_language || undefined,
      })
    } catch (updateError) {
      setMessage(
        typeof updateError === "string"
          ? updateError
          : "Could not update profile"
      )
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>@{user.user_handle}</CardTitle>
            {user.is_verified && <Badge>Verified</Badge>}
          </div>
          <CardDescription>
            Member since {formatDate(user.created_at)}
            {user.email ? ` · ${user.email}` : ""}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                aria-invalid={!!errors.full_name || undefined}
                {...register("full_name", {
                  required: "Full name is required",
                  maxLength: {
                    value: 150,
                    message: "Full name must be at most 150 characters",
                  },
                })}
              />
              {errors.full_name && (
                <p className="text-xs text-destructive">
                  {errors.full_name.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                aria-invalid={!!errors.bio || undefined}
                {...register("bio", {
                  maxLength: {
                    value: 500,
                    message: "Bio must be at most 500 characters",
                  },
                })}
              />
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                aria-invalid={!!errors.website_url || undefined}
                {...register("website_url", {
                  maxLength: {
                    value: 500,
                    message: "Website URL must be at most 500 characters",
                  },
                })}
              />
              {errors.website_url && (
                <p className="text-xs text-destructive">
                  {errors.website_url.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="language">Preferred language</Label>
              <Input
                id="language"
                aria-invalid={!!errors.preferred_language || undefined}
                {...register("preferred_language", {
                  maxLength: {
                    value: 20,
                    message: "Preferred language must be at most 20 characters",
                  },
                })}
              />
              {errors.preferred_language && (
                <p className="text-xs text-destructive">
                  {errors.preferred_language.message}
                </p>
              )}
            </div>
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
