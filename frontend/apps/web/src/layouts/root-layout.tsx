import { useEffect, useState } from "react"
import { Outlet } from "react-router-dom"

import { AiTelemetryModal } from "@/components/ai/ai-telemetry-modal"
import { AiVoiceCopilot } from "@/components/ai/ai-voice-copilot"
import { ComingSoonModal } from "@/components/coming-soon-modal"
import { config } from "@/config/config"
import { Footer } from "@/layouts/footer"
import { Header } from "@/layouts/header"
import { healthService } from "@/services/health.service"

export function RootLayout() {
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false)
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false)

  function handleOpenTelemetry() {
    if (config.aiVoiceEnabled) setIsTelemetryOpen(true)
    else setIsComingSoonOpen(true)
  }

  useEffect(() => {
    healthService
      .liveness()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false))
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Header onOpenTelemetry={handleOpenTelemetry} />

      {/* Main Page Outlet */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      {/* Floating Interactive AI Voice Copilot Widget */}
      <AiVoiceCopilot />

      {/* AI Telemetry Diagnostics Modal */}
      <AiTelemetryModal
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
      />

      <ComingSoonModal
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
      />

      <Footer apiOk={apiOk} onOpenTelemetry={handleOpenTelemetry} />
    </div>
  )
}
