import { Toast } from "@base-ui/react/toast"
import {
  Check,
  CircleAlert,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react"

const toastManager = Toast.createToastManager()

export const toast = toastManager

function ToastIcon({ type }: { type?: string }) {
  const Icon =
    type === "success"
      ? Check
      : type === "error"
        ? CircleAlert
        : type === "warning"
          ? TriangleAlert
          : type === "loading"
            ? LoaderCircle
            : Info

  return (
    <Icon
      aria-hidden="true"
      className={`mt-0.5 size-4 shrink-0 ${
        type === "success"
          ? "text-emerald-600 dark:text-emerald-400"
          : type === "error"
            ? "text-destructive"
            : type === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : type === "loading"
                ? "animate-spin text-muted-foreground"
                : "text-muted-foreground"
      }`}
    />
  )
}

function ToastRenderer() {
  const { toasts } = Toast.useToastManager()

  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed top-0 right-0 z-50 flex max-h-svh w-full max-w-sm flex-col gap-2 p-4">
        {toasts.map((item) => (
          <Toast.Root
            key={item.id}
            toast={item}
            className="flex w-full items-start gap-3 rounded-md border bg-popover p-4 text-popover-foreground shadow-lg transition-all duration-200 data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0"
          >
            <ToastIcon type={item.type} />
            <Toast.Content className="min-w-0 flex-1 pr-2">
              {item.title && (
                <Toast.Title className="text-sm font-semibold">
                  {item.title}
                </Toast.Title>
              )}
              {item.description && (
                <Toast.Description className="text-sm text-muted-foreground">
                  {item.description}
                </Toast.Description>
              )}
            </Toast.Content>
            <Toast.Close
              aria-label="Dismiss notification"
              className="-mt-1 -mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={toast} timeout={5000}>
      <ToastRenderer />
    </Toast.Provider>
  )
}
