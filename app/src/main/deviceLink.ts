// WebSocket client to the UNO Q. Reconnects automatically; the board is the server.
import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { DEFAULT_PORT, parseBoardMessage, type BoardMessage, type LaptopMessage } from '@shared/protocol'

export function toUrl(address: string): string {
  const a = address.trim().replace(/^wss?:\/\//, '')
  return `ws://${a.includes(':') ? a : `${a}:${DEFAULT_PORT}`}`
}

export declare interface DeviceLink {
  on(event: 'message', fn: (m: BoardMessage) => void): this
  on(event: 'status', fn: (connected: boolean) => void): this
}

export class DeviceLink extends EventEmitter {
  private ws: WebSocket | null = null
  private retry: NodeJS.Timeout | null = null
  private address = ''
  private previewOn = false
  connected = false

  /** Ask the board to stream (or stop streaming) camera preview frames. Re-sent after reconnects. */
  setPreview(on: boolean): void {
    if (this.previewOn === on) return
    this.previewOn = on
    this.send({ type: 'preview', on })
  }

  connect(address: string): void {
    if (address === this.address && this.ws) return
    this.address = address
    this.teardown()
    this.open()
  }

  private open(): void {
    if (!this.address) return
    let ws: WebSocket
    try {
      ws = new WebSocket(toUrl(this.address), { handshakeTimeout: 4000 })
    } catch {
      this.scheduleRetry()
      return
    }
    this.ws = ws
    ws.on('open', () => {
      this.setConnected(true)
      if (this.previewOn) this.send({ type: 'preview', on: true })
    })
    ws.on('message', (data) => {
      const msg = parseBoardMessage(data.toString())
      if (msg) this.emit('message', msg)
    })
    ws.on('close', () => {
      this.setConnected(false)
      this.ws = null
      this.scheduleRetry()
    })
    ws.on('error', () => {
      /* 'close' follows; handled there */
    })
  }

  private scheduleRetry(): void {
    if (this.retry) return
    this.retry = setTimeout(() => {
      this.retry = null
      this.open()
    }, 3000)
  }

  private setConnected(v: boolean): void {
    if (this.connected === v) return
    this.connected = v
    this.emit('status', v)
  }

  send(msg: LaptopMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  private teardown(): void {
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws.on('error', () => {})
      this.ws.terminate()
      this.ws = null
    }
    this.setConnected(false)
  }

  close(): void {
    this.address = ''
    this.teardown()
  }
}

/** One-shot connection test for the Settings page. */
export function testConnection(address: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean): void => {
      if (done) return
      done = true
      ws.removeAllListeners()
      ws.on('error', () => {})
      ws.terminate()
      resolve(ok)
    }
    const ws = new WebSocket(toUrl(address), { handshakeTimeout: 4000 })
    ws.on('open', () => finish(true))
    ws.on('error', () => finish(false))
    setTimeout(() => finish(false), 5000)
  })
}
