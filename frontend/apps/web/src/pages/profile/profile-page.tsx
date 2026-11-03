import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { Link } from "react-router-dom"
import {
  Calendar,
  Camera,
  ExternalLink,
  Globe,
  Languages,
  Loader2,
  Mail,
  Trash2,
  Upload,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
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
import { toast } from "@workspace/ui/components/toast"
import { formatDate, getApiErrorMessage } from "@workspace/utils"

import { ProfilePosts } from "@/components/profile-posts"
import { useAuth } from "@/hooks/use-auth"
import { identityService } from "@/services/identity.service"
import { DEFAULT_AVATAR, DEFAULT_COVER, getMediaUrl } from "@/utils/media"

type ProfileFormValues = {
  full_name: string
  bio: string
  website_url: string
  preferred_language: string
}

export function ProfilePage() {
  const { user, updateProfile, setUser } = useAuth()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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

  if (!user) {
    return null
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const updatedUser = await identityService.uploadAvatar(file)
      setUser(updatedUser)
      toast.add({
        title: "Profile photo updated",
        description: "Your new avatar has been saved.",
        type: "success",
      })
    } catch (err) {
      toast.add({
        title: "Avatar upload failed",
        description: getApiErrorMessage(err, "Failed to upload avatar image"),
        type: "error",
      })
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) {
        avatarInputRef.current.value = ""
      }
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true)
    try {
      const updatedUser = await identityService.deleteAvatar()
      setUser(updatedUser)
      toast.add({
        title: "Profile photo removed",
        description: "Reverted to default profile avatar.",
        type: "success",
      })
    } catch (err) {
      toast.add({
        title: "Action failed",
        description: getApiErrorMessage(err, "Failed to remove avatar"),
        type: "error",
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCover(true)
    try {
      const updatedUser = await identityService.uploadCover(file)
      setUser(updatedUser)
      toast.add({
        title: "Cover photo updated",
        description: "Your new cover banner has been saved.",
        type: "success",
      })
    } catch (err) {
      toast.add({
        title: "Cover upload failed",
        description: getApiErrorMessage(err, "Failed to upload cover image"),
        type: "error",
      })
    } finally {
      setUploadingCover(false)
      if (coverInputRef.current) {
        coverInputRef.current.value = ""
      }
    }
  }

  async function handleRemoveCover() {
    setUploadingCover(true)
    try {
      const updatedUser = await identityService.deleteCover()
      setUser(updatedUser)
      toast.add({
        title: "Cover photo removed",
        description: "Reverted to default cover image.",
        type: "success",
      })
    } catch (err) {
      toast.add({
        title: "Action failed",
        description: getApiErrorMessage(err, "Failed to remove cover"),
        type: "error",
      })
    } finally {
      setUploadingCover(false)
    }
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

  const coverUrl = getMediaUrl(user.cover_storage_key, DEFAULT_COVER)
  const avatarUrl = getMediaUrl(user.avatar_storage_key, DEFAULT_AVATAR)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-12">
      {/* Hidden file inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleAvatarChange}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleCoverChange}
      />

      {/* Main Profile Header Card */}
      <Card className="overflow-hidden border-border/80 shadow-xs">
        {/* Cover Photo Banner */}
        <div className="group relative h-48 w-full overflow-hidden bg-muted sm:h-60">
          <img
            src={coverUrl}
            alt="Profile cover banner"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
          />

          {uploadingCover && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
              <span className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-1.5 text-xs font-medium text-foreground shadow-sm">
                <Loader2 className="size-4 animate-spin" />
                Uploading cover photo…
              </span>
            </div>
          )}

          {/* Cover Action Buttons */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
              className="h-8 gap-1.5 bg-background/85 text-xs font-medium shadow-xs backdrop-blur-md hover:bg-background dark:bg-background/85 dark:hover:bg-background"
            >
              <Camera className="size-3.5" />
              <span>
                {user.cover_storage_key ? "Change cover" : "Add cover"}
              </span>
            </Button>
            {user.cover_storage_key && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingCover}
                onClick={handleRemoveCover}
                className="size-8 h-8 bg-background/85 p-0 text-destructive shadow-xs backdrop-blur-md hover:bg-destructive/10 hover:text-destructive"
                title="Remove custom cover photo"
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only">Remove cover</span>
              </Button>
            )}
          </div>
        </div>

        {/* Profile Avatar & Info Header */}
        <div className="relative px-6 pt-0 pb-6">
          <div className="-mt-16 flex flex-col gap-4 sm:-mt-20 sm:flex-row sm:items-end sm:justify-between">
            {/* Avatar with edit overlay */}
            <div className="group relative size-28 shrink-0 overflow-hidden rounded-full bg-background shadow-md ring-4 ring-background sm:size-36">
              <img
                src={avatarUrl}
                alt={user.full_name}
                className="size-full rounded-full object-cover"
              />

              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs">
                  <Loader2 className="size-5 animate-spin text-white" />
                </div>
              )}

              {/* Hover actions overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex items-center gap-1 text-[11px] font-medium text-white hover:underline focus:outline-none"
                >
                  <Camera className="size-3.5" />
                  <span>Change</span>
                </button>
                {user.avatar_storage_key && (
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={handleRemoveAvatar}
                    className="flex items-center gap-1 text-[10px] text-red-300 hover:text-red-200 hover:underline focus:outline-none"
                  >
                    <Trash2 className="size-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>

            {/* Top Right Quick Actions */}
            <div className="flex items-center gap-2 self-start sm:mb-2 sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 gap-1.5 text-xs"
              >
                <Link to={APP_ROUTES.user(user.user_handle)}>
                  <ExternalLink className="size-3.5" />
                  <span>View public profile</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* User Bio and Meta */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {user.full_name}
              </h1>
              {user.is_verified && <Badge variant="default">Verified</Badge>}
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              @{user.user_handle}
            </p>

            {user.bio ? (
              <p className="max-w-2xl pt-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {user.bio}
              </p>
            ) : (
              <p className="pt-1 text-xs text-muted-foreground italic">
                No bio added yet. Tell the world about yourself below.
              </p>
            )}

            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground/70" />
                Joined {formatDate(user.created_at)}
              </span>

              {user.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground/70" />
                  {user.email}
                </span>
              )}

              {user.website_url && (
                <a
                  href={
                    user.website_url.startsWith("http")
                      ? user.website_url
                      : `https://${user.website_url}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Globe className="size-3.5" />
                  {user.website_url.replace(/^https?:\/\//, "")}
                </a>
              )}

              {user.preferred_language && (
                <span className="flex items-center gap-1.5">
                  <Languages className="size-3.5 text-muted-foreground/70" />
                  Language: {user.preferred_language}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <ProfilePosts handle={user.user_handle} isOwn />

      {/* Edit Profile Form Card */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg">Edit Profile Details</CardTitle>
          <CardDescription>
            Update your public profile details, bio, and social links.
          </CardDescription>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="bio">Bio</Label>
                <span className="text-[11px] text-muted-foreground">
                  Max 500 characters
                </span>
              </div>
              <Textarea
                id="bio"
                rows={3}
                aria-invalid={!!errors.bio || undefined}
                placeholder="Share a short bio with your network…"
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

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  placeholder="https://example.com"
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
                <Label htmlFor="language">Preferred Language</Label>
                <Input
                  id="language"
                  placeholder="en, hi, es, etc."
                  aria-invalid={!!errors.preferred_language || undefined}
                  {...register("preferred_language", {
                    maxLength: {
                      value: 20,
                      message:
                        "Preferred language must be at most 20 characters",
                    },
                  })}
                />
                {errors.preferred_language && (
                  <p className="text-xs text-destructive">
                    {errors.preferred_language.message}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Photo Management Summary within Edit Form */}
            <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-4">
              <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Photo Storage & Management
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Your profile photo and cover photo are stored securely under{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  uploads/profile/{user.id}/
                </code>
                . When replaced or removed, old files are automatically cleaned
                up to prevent clutter.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Upload className="size-3" />
                  Change Profile Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => coverInputRef.current?.click()}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Upload className="size-3" />
                  Change Cover Photo
                </Button>
              </div>
            </div>

            {message && <p className="text-sm text-destructive">{message}</p>}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-32"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
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
    </div>
  )
}
