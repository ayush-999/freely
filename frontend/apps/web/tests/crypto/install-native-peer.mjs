import { copyFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { spawn } from "node:child_process"

const source = fileURLToPath(new URL("./native-peer/", import.meta.url))
const destination = fileURLToPath(
  new URL("../../../../../.tools/chat-crypto/", import.meta.url)
)
await mkdir(destination, { recursive: true })
await copyFile(
  resolve(source, "package.json"),
  resolve(destination, "package.json")
)
await copyFile(
  resolve(source, "package-lock.json"),
  resolve(destination, "package-lock.json")
)
const windows = process.platform === "win32"
const args = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]
const child = spawn(
  windows ? process.env.ComSpec || "cmd.exe" : "npm",
  windows ? ["/d", "/c", "npm.cmd", ...args] : args,
  {
    cwd: destination,
    stdio: "inherit",
    windowsHide: true,
  }
)
const code = await new Promise((resolve, reject) => {
  child.on("exit", resolve)
  child.on("error", reject)
})
process.exitCode = code || 0
