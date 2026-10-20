import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  Mic,
  MicOff,
  Radio,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  Zap,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { useAuth } from "@/hooks/use-auth"
import type { Priority } from "@/types"

const VOICE_PRESETS = [
  {
    label: "💧 Contaminated Water",
    category_id: 2,
    title: "Drinking water contamination in Sector 4 residential sector",
    transcript:
      "For the past 4 days, the tap water supply in Sector 4 has had a foul sewage smell and yellowish tint. Multiple families reported skin rashes and stomach infections. We called municipal helpline but received no ticket. We demand immediate water quality testing and tanker supply.",
    urgency: 88,
    priority: "urgent" as Priority,
    sla: "24 Hours Guaranteed",
  },
  {
    label: "⚠️ Dangerous Road Potholes",
    category_id: 1,
    title: "Deep unbarricaded road craters causing daily two-wheeler accidents",
    transcript:
      "There are 3 severe potholes on the main junction right after the flyover. Due to unlit street lamps, two motorcycle riders fell yesterday night. Please repair and barricade this immediately before a fatal casualty occurs.",
    urgency: 74,
    priority: "high" as Priority,
    sla: "48 Hours Guaranteed",
  },
  {
    label: "⚖️ Retaliation / Whistleblower",
    category_id: 4,
    title: "Retaliatory suspension threat following safety audit disclosure",
    transcript:
      "After documenting fire safety violations in block C during internal inspections, department supervisor threatened demotion and punitive transfer. Filing anonymously to demand independent audit review.",
    urgency: 92,
    priority: "critical" as Priority,
    sla: "12 Hours Fast-Track",
  },
  {
    label: "🏥 Healthcare / Clinic Neglect",
    category_id: 5,
    title: "Primary healthcare center unstaffed during emergency hours",
    transcript:
      "The local PHC was completely locked during night emergency duty hours on Sunday. A senior citizen needing acute asthma nebulization was turned away. Urgent inspection and staffing accountability requested.",
    urgency: 82,
    priority: "urgent" as Priority,
    sla: "24 Hours Guaranteed",
  },
]

interface RaiseVoiceModalProps {
  isOpen: boolean
  onClose: () => void
}

export function RaiseVoiceModal({ isOpen, onClose }: RaiseVoiceModalProps) {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<"voice" | "form">("voice")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState(1)
  const [priority, setPriority] = useState<Priority>("high")
  const [isAnonymous, setIsAnonymous] = useState(true)

  // Voice AI simulation state
  const [isRecording, setIsRecording] = useState(false)
  const [isPolishing, setIsPolishing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [urgencyScore, setUrgencyScore] = useState(78)
  const [slaTarget, setSlaTarget] = useState("24 Hours Guaranteed")
  const [audioWaves, setAudioWaves] = useState([25, 45, 60, 35, 55, 75, 40, 30])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Wave visualizer effect during recording
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setAudioWaves([
          Math.floor(20 + Math.random() * 80),
          Math.floor(30 + Math.random() * 70),
          Math.floor(40 + Math.random() * 60),
          Math.floor(25 + Math.random() * 75),
          Math.floor(35 + Math.random() * 65),
          Math.floor(50 + Math.random() * 50),
          Math.floor(20 + Math.random() * 70),
          Math.floor(15 + Math.random() * 55),
        ])
      }, 100)
      return () => clearInterval(interval)
    }
  }, [isRecording])

  if (!isOpen) return null

  function handleToggleRecord() {
    if (!isRecording) {
      setIsRecording(true)
      const sample = VOICE_PRESETS[Math.floor(Math.random() * VOICE_PRESETS.length)]
      let currentIndex = 0
      const words = sample.transcript.split(" ")
      setDescription("")
      setTitle(sample.title)
      setCategoryId(sample.category_id)
      setPriority(sample.priority)
      setUrgencyScore(sample.urgency)
      setSlaTarget(sample.sla)

      const speechTimer = setInterval(() => {
        currentIndex += 2
        setDescription(words.slice(0, currentIndex).join(" "))
        if (currentIndex >= words.length) {
          clearInterval(speechTimer)
          setIsRecording(false)
        }
      }, 160)
    } else {
      setIsRecording(false)
    }
  }

  function handleSelectPreset(preset: (typeof VOICE_PRESETS)[0]) {
    setTitle(preset.title)
    setDescription(preset.transcript)
    setCategoryId(preset.category_id)
    setPriority(preset.priority)
    setUrgencyScore(preset.urgency)
    setSlaTarget(preset.sla)
  }

  function handlePolishWithAi() {
    if (!description.trim()) return
    setIsPolishing(true)
    setTimeout(() => {
      setDescription(
        (prev) =>
          `[AI Polished & Legally Structured]\n` +
          `SUMMARY: ${title || "Public Welfare & Civic Accountability Concern"}\n` +
          `FACTUAL STATEMENT: ${prev.replace(/^\[AI Polished.*?\n\n/s, "")}\n\n` +
          `REQUESTED RELIEF: Formal on-site inspection, immutable SLA timeline tracking, and mandated departmental remediation under public oversight.`
      )
      setIsPolishing(false)
    }, 600)
  }

  function handleCopy() {
    if (!description) return
    navigator.clipboard.writeText(`${title ? title + "\n\n" : ""}${description}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSubmit() {
    const draft = {
      title: title.trim() || description.slice(0, 60) + "...",
      description: description.trim(),
      category_id: categoryId,
      priority,
      is_anonymous: isAnonymous,
    }

    // Persist draft to sessionStorage so it survives login/redirect
    sessionStorage.setItem("freely_grievance_draft", JSON.stringify(draft))

    onClose()

    if (isAuthenticated) {
      navigate(APP_ROUTES.grievances.new, { state: draft })
    } else {
      navigate(APP_ROUTES.login, {
        state: {
          from: APP_ROUTES.grievances.new,
          draft,
        },
      })
    }
  }

  function handleOpenFloatingStudio() {
    onClose()
    window.dispatchEvent(new CustomEvent("freely:open-voice-studio"))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="raise-voice-title"
    >
      <Card className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border-primary/25 bg-background/98 shadow-2xl backdrop-blur-xl">
        {/* Modal Header */}
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-sm">
                <Sparkles className="size-5 animate-pulse text-amber-200" />
              </div>
              <div>
                <CardTitle
                  id="raise-voice-title"
                  className="flex items-center gap-2 text-lg font-bold sm:text-xl"
                >
                  Raise Your Voice
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-primary text-[11px]"
                  >
                    AI Powered
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Report civic hazards, organizational misconduct, or public grievances backed by
                  statutory SLAs.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close dialog"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
            <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 text-xs">
              <button
                type="button"
                onClick={() => setMode("voice")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all",
                  mode === "voice"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Mic className="size-3.5 text-primary" />
                <span>Voice & AI Dictation</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("form")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all",
                  mode === "form"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Direct Grievance Form</span>
              </button>
            </div>

            <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>256-Bit Whistleblower Shield</span>
            </div>
          </div>
        </CardHeader>

        {/* Modal Scrollable Body */}
        <CardContent className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {mode === "voice" ? (
            <div className="space-y-4">
              {/* Voice Dictation Card & Wave Visualizer */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleRecord}
                      className={cn(
                        "flex size-12 items-center justify-center rounded-full text-white shadow-md transition-all hover:scale-105",
                        isRecording
                          ? "animate-pulse bg-red-600 ring-4 ring-red-500/20"
                          : "bg-primary hover:bg-primary/90"
                      )}
                      title={isRecording ? "Stop dictation" : "Start speaking"}
                    >
                      {isRecording ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {isRecording ? "Listening to your voice..." : "Click microphone to dictate"}
                        </span>
                        {isRecording && (
                          <span className="flex size-2">
                            <span className="inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Speak freely in any language or select a common template below.
                      </p>
                    </div>
                  </div>

                  {/* Equalizer Visualizer */}
                  <div className="flex h-7 items-end gap-1 px-3 py-1">
                    {audioWaves.map((height, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full bg-primary transition-all duration-100"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="mt-4 border-t border-primary/10 pt-3">
                  <p className="mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Or select a real-world scenario to simulate:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {VOICE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <Label htmlFor="modal-title" className="text-xs font-semibold">
                  Grievance Summary / Title
                </Label>
                <Input
                  id="modal-title"
                  placeholder="e.g. Broken drainage pipe flooding main market street..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              {/* Transcript & Polish Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="modal-transcript" className="text-xs font-semibold">
                    Voice Transcript & Statement
                  </Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handlePolishWithAi}
                      disabled={isPolishing || !description.trim()}
                      className="gap-1 border-primary/30 text-primary text-[11px] hover:bg-primary/10"
                    >
                      <Wand2 className={cn("size-3", isPolishing && "animate-spin")} />
                      <span>{isPolishing ? "Structuring..." : "Polish with AI"}</span>
                    </Button>
                    {description && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={handleCopy}
                        className="gap-1 text-[11px]"
                      >
                        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        <span>{copied ? "Copied" : "Copy"}</span>
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  id="modal-transcript"
                  rows={4}
                  placeholder="Your voice transcription will appear here, or you can type directly..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>

              {/* AI Urgency & SLA Indicators */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-amber-500" />
                  <div>
                    <span className="text-muted-foreground block text-[10px]">AI Urgency Score</span>
                    <span className="font-semibold text-foreground">{urgencyScore}% (High Priority)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="size-4 text-primary" />
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Statutory SLA Target</span>
                    <span className="font-semibold text-foreground">{slaTarget}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Direct Form Mode */}
              <div className="space-y-1.5">
                <Label htmlFor="form-title" className="text-xs font-semibold">
                  Grievance Title
                </Label>
                <Input
                  id="form-title"
                  placeholder="Brief summary of the issue or violation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="form-category" className="text-xs font-semibold">
                    Category ID
                  </Label>
                  <select
                    id="form-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value={1}>1 - Civic Infrastructure & Roads</option>
                    <option value={2}>2 - Public Utilities & Water Works</option>
                    <option value={3}>3 - Municipal Sanitation & Waste</option>
                    <option value={4}>4 - Workplace Ethics & Whistleblower</option>
                    <option value={5}>5 - Healthcare & Public Safety</option>
                    <option value={6}>6 - Consumer Protection</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="form-priority" className="text-xs font-semibold">
                    Priority Level
                  </Label>
                  <select
                    id="form-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="low">Low (72h SLA)</option>
                    <option value="medium">Medium (48h SLA)</option>
                    <option value="high">High (24h SLA)</option>
                    <option value="critical">Critical (12h SLA)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="form-description" className="text-xs font-semibold">
                  Detailed Description & Evidence Context
                </Label>
                <Textarea
                  id="form-description"
                  rows={5}
                  placeholder="Provide facts, timeline, specific locations, personnel involved, and requested resolution..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-sm leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* Anonymity Shield Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
              <div>
                <label
                  htmlFor="anon-check"
                  className="cursor-pointer text-xs font-semibold text-foreground select-none"
                >
                  File as Anonymous Whistleblower
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Your identity is cryptographically sealed. Only your public tracking number is visible.
                </p>
              </div>
            </div>
            <input
              id="anon-check"
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="size-4 cursor-pointer accent-primary"
            />
          </div>

          {!isAuthenticated && (
            <div className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              💡 <strong>Notice:</strong> Submitting requires an authenticated session so you can track
              official resolution updates. Clicking submit will preserve your draft and guide you through
              login.
            </div>
          )}
        </CardContent>

        {/* Modal Action Footer */}
        <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleOpenFloatingStudio}
            className="flex cursor-pointer items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Bot className="size-3.5 text-primary" />
            <span>Switch to Floating Copilot Dock</span>
          </button>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!description.trim()}
              className="gap-1.5 bg-primary font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <span>{isAuthenticated ? "Proceed to Submit" : "Continue with Draft"}</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
