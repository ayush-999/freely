import { useState, type FormEvent } from "react"
import { ShieldCheck, ShieldAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { PeerTrust } from "@/crypto/types"

function VerificationRow({
  trust,
  onVerify,
}: {
  trust: PeerTrust
  onVerify: (deviceId: string, number: string) => Promise<void>
}) {
  const [number, setNumber] = useState("")
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await onVerify(trust.public_device_id, number)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {trust.verified ? (
          <ShieldCheck className="size-4 text-emerald-600" />
        ) : (
          <ShieldAlert className="size-4 text-amber-600" />
        )}
        <span>@{trust.user_handle}</span>
        <span className="text-xs text-muted-foreground">
          {trust.verified ? "Verified" : "Needs verification"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Device {trust.public_device_id.slice(-8)}
      </p>
      <p
        className="rounded bg-muted p-2 font-mono text-sm break-all select-all"
        aria-label={`Safety number for ${trust.user_handle}`}
      >
        {trust.safety_number}
      </p>
      {!trust.verified && (
        <form
          onSubmit={(event) => {
            void submit(event)
          }}
          className="space-y-2"
        >
          <p className="text-xs text-muted-foreground">
            Compare this safety number with the person on this device through a
            trusted channel. Enter the matching number they see to verify it.
          </p>
          <label
            className="sr-only"
            htmlFor={`verify-${trust.public_device_id}`}
          >
            Matching safety number
          </label>
          <Input
            id={`verify-${trust.public_device_id}`}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="Matching safety number"
            autoComplete="off"
            inputMode="numeric"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={!number.trim() || busy}
          >
            {busy ? "Verifying…" : "Verify device"}
          </Button>
        </form>
      )}
    </div>
  )
}

export function DeviceVerification({
  trusts,
  onVerify,
}: {
  trusts: PeerTrust[]
  onVerify: (deviceId: string, number: string) => Promise<void>
}) {
  const pending = trusts.filter((trust) => !trust.verified).length
  return (
    <details
      className="border-b bg-muted/20 p-3"
      open={pending > 0 || undefined}
    >
      <summary className="cursor-pointer text-sm font-medium">
        {pending
          ? `Verify ${pending} ${pending === 1 ? "device" : "devices"} to start messaging`
          : "Device verification"}
      </summary>
      <div className="mt-3 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
        {trusts.map((trust) => (
          <VerificationRow
            key={trust.public_device_id}
            trust={trust}
            onVerify={onVerify}
          />
        ))}
      </div>
    </details>
  )
}
