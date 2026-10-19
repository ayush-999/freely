import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { AtSign, Eye, EyeOff, Loader2 } from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
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
import { getApiErrorMessage } from "@workspace/utils"

import { identityService } from "@/services/identity.service"

const HANDLE_PATTERN = /^[a-zA-Z0-9_]{3,50}$/
const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_"

/** Builds candidate handles by appending random letters/numbers/underscores. */
function generateHandleCandidates(base: string): string[] {
  const trimmed = base.slice(0, 45) // keep the result within the 50-char limit
  return Array.from({ length: 6 }, () => {
    let suffix = "_"
    const length = 2 + Math.floor(Math.random() * 3) // 2-4 extra characters
    for (let index = 0; index < length; index++) {
      suffix += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)]
    }
    return `${trimmed}${suffix}`
  })
}

/** Returns the first generated candidate verified as available, or null. */
async function findAvailableHandle(base: string): Promise<string | null> {
  for (const candidate of generateHandleCandidates(base)) {
    try {
      const result = await identityService.checkHandleAvailability(candidate)
      if (result.available) {
        return candidate
      }
    } catch {
      // Skip candidates whose availability check fails.
    }
  }
  return null
}

type RegisterFormValues = {
  user_handle: string
  full_name: string
  email: string
  password: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    defaultValues: { user_handle: "", full_name: "", email: "", password: "" },
  })
  const [error, setError] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<{
    handle: string
    status: "available" | "taken"
    suggestion: string | null
  } | null>(null)
  const [checkingHandle, setCheckingHandle] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const watchedHandle = useWatch({ control, name: "user_handle" })

  // Debounced realtime availability check for the entered handle.
  useEffect(() => {
    const handle = watchedHandle
    if (!HANDLE_PATTERN.test(handle)) {
      return
    }
    const timer = setTimeout(() => {
      void (async () => {
        setCheckingHandle(handle)
        try {
          const result = await identityService.checkHandleAvailability(handle)
          if (result.available) {
            setCheckResult({ handle, status: "available", suggestion: null })
            return
          }
          const candidate = await findAvailableHandle(handle)
          setCheckResult({ handle, status: "taken", suggestion: candidate })
        } catch {
          setCheckingHandle((current) => (current === handle ? null : current))
        }
      })()
    }, 400)
    return () => clearTimeout(timer)
  }, [watchedHandle])

  // Results are keyed to the handle they belong to, so stale responses are
  // ignored automatically without resetting state inside the effect.
  const handleStatus: "idle" | "checking" | "available" | "taken" =
    checkResult?.handle === watchedHandle
      ? checkResult.status
      : checkingHandle === watchedHandle
        ? "checking"
        : "idle"
  const suggestion =
    checkResult?.handle === watchedHandle ? checkResult.suggestion : null

  function applySuggestion() {
    if (suggestion) {
      setValue("user_handle", suggestion, { shouldValidate: true })
    }
  }

  async function onSubmit(values: RegisterFormValues) {
    setError(null)
    try {
      await identityService.register({
        user_handle: values.user_handle,
        full_name: values.full_name,
        password: values.password,
        ...(values.email ? { email: values.email } : {}),
      })
      navigate(APP_ROUTES.login, { replace: true })
    } catch (registerError) {
      setError(getApiErrorMessage(registerError, "Registration failed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Join Freely in a few seconds</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-2">
            <Label htmlFor="handle">Handle</Label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="handle"
                className="pl-9"
                autoComplete="username"
                aria-invalid={
                  handleStatus === "taken" || !!errors.user_handle || undefined
                }
                {...register("user_handle", {
                  required: "Handle is required",
                  minLength: {
                    value: 3,
                    message: "Handle must be at least 3 characters",
                  },
                  maxLength: {
                    value: 50,
                    message: "Handle must be at most 50 characters",
                  },
                  pattern: {
                    value: /^[a-zA-Z0-9_]+$/,
                    message:
                      "Only letters, numbers, and underscores are allowed",
                  },
                })}
              />
            </div>
            {errors.user_handle ? (
              <p className="text-xs text-destructive">
                {errors.user_handle.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                (3-50 characters, letters, numbers, underscores)
              </p>
            )}
            {handleStatus === "checking" && (
              <p className="text-xs text-muted-foreground">
                Checking availability…
              </p>
            )}
            {handleStatus === "available" && (
              <p className="text-xs text-green-600 dark:text-green-500">
                @{watchedHandle} is available
              </p>
            )}
            {handleStatus === "taken" && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-destructive">
                  @{watchedHandle} is already taken
                </p>
                {suggestion && (
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="w-fit text-xs text-green-600 hover:underline dark:text-green-500"
                  >
                    Try @{suggestion} instead
                  </button>
                )}
              </div>
            )}
          </div>
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
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              aria-invalid={!!errors.email || undefined}
              {...register("email", {
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email address",
                },
              })}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                className="pr-9"
                autoComplete="new-password"
                aria-invalid={!!errors.password || undefined}
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                  maxLength: {
                    value: 128,
                    message: "Password must be at most 128 characters",
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link to={APP_ROUTES.login} className="underline">
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
