import { useEffect } from "react"
import { RouterProvider } from "react-router-dom"

import { router } from "@/routes"
import { bootstrapSession } from "@/store/auth-slice"
import { useAppDispatch } from "@/store/hooks"

export function App() {
  const dispatch = useAppDispatch()

  // Restore the session (stored JWT → current user) once on startup.
  useEffect(() => {
    void dispatch(bootstrapSession())
  }, [dispatch])

  return <RouterProvider router={router} />
}
