// Tracks the foreground window (app + title).
// Windows: one long-lived PowerShell process calling user32 via Add-Type — no native Node modules.
// macOS (dev only): osascript fallback so the app can be exercised on a Mac.
import { execFile, spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import type { WindowInfo } from '@shared/types'

const PS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class SLFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
while ($true) {
  $h = [SLFg]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 512
  [void][SLFg]::GetWindowText($h, $sb, 512)
  $procId = [uint32]0
  [void][SLFg]::GetWindowThreadProcessId($h, [ref]$procId)
  $name = ''
  try { $name = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}
  @{ app = $name; title = $sb.ToString(); pid = $procId } | ConvertTo-Json -Compress
  Start-Sleep -Milliseconds 2000
}
`

export class WindowWatcher {
  current: WindowInfo | null = null
  private proc: ChildProcess | null = null
  private timer: NodeJS.Timeout | null = null
  private stopped = true

  start(): void {
    this.stopped = false
    if (process.platform === 'win32') this.startWindows()
    else if (process.platform === 'darwin') this.startMac()
  }

  private startWindows(): void {
    const encoded = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64')
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true
    })
    this.proc = proc
    createInterface({ input: proc.stdout! }).on('line', (line) => {
      try {
        const j = JSON.parse(line) as { app: string; title: string; pid: number }
        // Ignore our own windows (main window, popup, edge bar) so they never count as "the screen".
        if (j.pid === process.pid || /studylens|electron/i.test(j.app)) return
        this.current = { app: j.app, title: j.title }
      } catch {
        /* partial line */
      }
    })
    proc.on('exit', () => {
      this.proc = null
      if (!this.stopped) setTimeout(() => !this.stopped && this.startWindows(), 3000)
    })
  }

  private startMac(): void {
    const script =
      'tell application "System Events" to set p to first application process whose frontmost is true\n' +
      'set n to name of p\nset t to ""\ntry\nset t to name of front window of p\nend try\nreturn n & "|||" & t'
    const poll = (): void => {
      execFile('osascript', ['-e', script], { timeout: 1500 }, (err, out) => {
        if (!err) {
          const [app, title = ''] = out.trim().split('|||')
          if (!/electron|studylens/i.test(app)) this.current = { app, title }
        }
      })
    }
    poll()
    this.timer = setInterval(poll, 2000)
  }

  stop(): void {
    this.stopped = true
    this.proc?.kill()
    this.proc = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
