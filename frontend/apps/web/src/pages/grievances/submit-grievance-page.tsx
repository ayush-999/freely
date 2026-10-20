import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useLocation } from "react-router-dom"
import { Sparkles } from "lucide-react"

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
import { getApiErrorMessage } from "@workspace/utils"

import { grievanceService } from "@/services/grievance.service"
import type { Grievance, Priority } from "@/types"

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

type GrievanceFormValues = {
  category_id: number
  title: string
  description: string
  priority: Priority
  district: string
  state: string
  is_anonymous: boolean
}

interface LocationDraftState {
  title?: string
  description?: string
  priority?: Priority
  is_anonymous?: boolean
}

export function SubmitGrievancePage() {
  const location = useLocation()
  const storedDraftRaw =
    typeof window !== "undefined"
      ? sessionStorage.getItem("freely_grievance_draft")
      : null
  let storedDraft: LocationDraftState | null = null
  if (storedDraftRaw) {
    try {
      storedDraft = JSON.parse(storedDraftRaw) as LocationDraftState
    } catch {
      storedDraft = null
    }
  }
  const draftState = (location.state as LocationDraftState) || storedDraft || null

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GrievanceFormValues>({
    defaultValues: {
      title: draftState?.title || "",
      description: draftState?.description || "",
      priority: draftState?.priority || "medium",
      district: "",
      state: "",
      is_anonymous: draftState?.is_anonymous ?? false,
    },
  })
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Grievance | null>(null)

  async function onSubmit(values: GrievanceFormValues) {
    setError(null)
    try {
      const grievance = await grievanceService.submit({
        category_id: values.category_id,
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        is_anonymous: values.is_anonymous,
        ...(values.district ? { district: values.district } : {}),
        ...(values.state ? { state: values.state } : {}),
      })
      setCreated(grievance)
      sessionStorage.removeItem("freely_grievance_draft")
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "Could not submit grievance"))
    }
  }

  if (created) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Grievance submitted</CardTitle>
          <CardDescription>
            Save this tracking number to follow the progress publicly.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="rounded-md bg-muted px-3 py-2 text-center font-mono text-lg">
            {created.tracking_number}
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link to={APP_ROUTES.track}>Track it</Link>
            </Button>
            <Button asChild>
              <Link to={APP_ROUTES.grievances.mine}>My grievances</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Submit a grievance</CardTitle>
        <CardDescription>
          Your report is routed to the right department automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {draftState?.description && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary shrink-0" />
              <span>Pre-filled from Freely AI Voice Studio</span>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              AI Voice Draft
            </Badge>
          </div>
        )}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-2">
            <Label htmlFor="categoryId">Category ID</Label>
            <Input
              id="categoryId"
              type="number"
              aria-invalid={!!errors.category_id || undefined}
              {...register("category_id", {
                valueAsNumber: true,
                required: "Category ID is required",
                validate: (value) =>
                  (Number.isInteger(value) && value >= 1) ||
                  "Category ID must be a positive whole number",
              })}
            />
            {errors.category_id && (
              <p className="text-xs text-destructive">
                {errors.category_id.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              aria-invalid={!!errors.title || undefined}
              {...register("title", {
                required: "Title is required",
                maxLength: {
                  value: 250,
                  message: "Title must be at most 250 characters",
                },
              })}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              aria-invalid={!!errors.description || undefined}
              {...register("description", {
                required: "Description is required",
              })}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                className={selectClassName}
                {...register("priority")}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="district">District</Label>
              <Input id="district" {...register("district")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" {...register("state")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_anonymous")} />
            Submit anonymously
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit grievance"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
