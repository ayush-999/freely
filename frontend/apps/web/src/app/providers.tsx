import type { ReactNode } from "react"
import { Toaster } from "@workspace/ui/components/toast"
import { Provider } from "react-redux"

import { ThemeProvider } from "@/components/theme-provider"
import { store } from "@/store"

/** App-wide providers (theme + Redux store). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <Provider store={store}>{children}</Provider>
      <Toaster />
    </ThemeProvider>
  )
}
