import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { Eye, EyeOff, Loader2, AtSign, Mail } from "lucide-react"

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

import { useAuth } from "@/hooks/use-auth"

type LoginFormValues = {
  handle: string
  password: string
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>()
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const handleValue = useWatch({ control, name: "handle" })
  const isEmailLogin = handleValue?.includes("@") ?? false

  if (isAuthenticated) {
    return <Navigate to={APP_ROUTES.feed} replace />
  }

  async function onSubmit(values: LoginFormValues) {
    setFormError(null)
    try {
      await login(values.handle, values.password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? APP_ROUTES.feed, { replace: true })
    } catch (loginError) {
      const message =
        typeof loginError === "string" ? loginError : "Login failed"
      if (message.startsWith("No account found")) {
        setError("handle", { type: "server", message })
      } else if (message === "Invalid credentials") {
        setError("password", { type: "server", message })
      } else {
        setFormError(message)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Access your Freely account</CardDescription>
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
              {isEmailLogin ? (
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              ) : (
                <AtSign className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                id="handle"
                className="pl-9"
                autoComplete="username"
                aria-invalid={!!errors.handle || undefined}
                {...register("handle", {
                  required: "Handle is required",
                  onChange: () => clearErrors("handle"),
                })}
              />
            </div>
            {errors.handle && (
              <p className="text-xs text-destructive">
                {errors.handle.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                className="pr-9"
                autoComplete="current-password"
                aria-invalid={!!errors.password || undefined}
                {...register("password", {
                  required: "Password is required",
                  onChange: () => clearErrors("password"),
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
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? "Logging in…" : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link to={APP_ROUTES.register} className="underline">
              Sign up
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
