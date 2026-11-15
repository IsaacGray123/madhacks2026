import { app, dialog, safeStorage } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { createServer, type Server, type Socket, type AddressInfo } from 'node:net'
import { join } from 'node:path'
import { Client } from 'ssh2'
import type { BoardConnectionStatus, BoardSshSettings, Settings } from '@shared/types'
import { DeviceLink, testConnection } from './deviceLink'

interface SavedLogin {
  host: string
  port: number
  username: string
  fingerprint: string
  password: string
}

function loginPath(): string {
  return join(app.getPath('userData'), 'board-login.json')
}

export function forgetBoardLogin(): void {
  if (existsSync(loginPath())) unlinkSync(loginPath())
}

function readLogin(): SavedLogin | null {
  if (!existsSync(loginPath())) return null
  try {
    const login = JSON.parse(readFileSync(loginPath(), 'utf8')) as SavedLogin
    if (typeof login.host !== 'string' || typeof login.username !== 'string' || typeof login.port !== 'number' ||
        typeof login.fingerprint !== 'string' || typeof login.password !== 'string') return null
    return login
  } catch {
    return null
  }
}

function sameBoard(login: SavedLogin, settings: BoardSshSettings): boolean {
  return login.host === settings.host && login.port === settings.port && login.username === settings.username
}

export function validateBoardSsh(settings: BoardSshSettings): void {
  if (!settings.host || !/^[a-zA-Z0-9_.:-]+$/.test(settings.host)) throw new Error('Enter the board Wi-Fi IP or hostname.')
  if (!settings.username.trim()) throw new Error('Enter the board Linux username.')
  for (const port of [settings.port, settings.remotePort]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Ports must be between 1 and 65535.')
  }
}

async function connectSsh(
  settings: BoardSshSettings,
  password: string,
  verify: (fingerprint: string) => Promise<boolean>,
  client: Client,
  readyTimeout = 10000,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let ready = false
    client.on('error', reject)
    client.once('close', () => {
      if (!ready) reject(new Error('SSH connection closed before login completed.'))
    })
    client.once('ready', () => {
      ready = true
      resolve()
    })
    client.connect({
      host: settings.host,
      port: settings.port,
      username: settings.username,
      password,
      readyTimeout,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
      hostVerifier: (key: Buffer, callback: (valid: boolean) => void) => {
        const fingerprint = 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '')
        void verify(fingerprint).then(callback, () => callback(false))
      },
    })
  })
}

/** Authenticate once and store the login using the OS-backed encryption service. */
export async function saveBoardLogin(settings: BoardSshSettings, password: string): Promise<void> {
  validateBoardSsh(settings)
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential encryption is unavailable. Use a direct connection for now.')
  const previous = readLogin()
  const saved = previous && sameBoard(previous, settings) ? previous : null
  const secret = password || (saved ? safeStorage.decryptString(Buffer.from(saved.password, 'base64')) : '')
  if (!secret) throw new Error('Enter the Arduino Linux account password.')
  let fingerprint = ''
  const client = new Client()
  try {
    await connectSsh(settings, secret, async (received) => {
      fingerprint = received
      if (saved?.fingerprint === received) return true
      const result = await dialog.showMessageBox({
        type: 'question',
        title: 'Pair Arduino board',
        message: saved ? 'The board identity has changed. Trust this board?' : 'Trust this Arduino board?',
        detail: `${settings.host}\n${received}\nConfirm this is your board. The identity will be checked on future connections.`,
        buttons: ['Cancel', 'Trust board'],
        defaultId: 0,
        cancelId: 0,
      })
      return result.response === 1
    }, client, 60000)
    const login: SavedLogin = {
      host: settings.host, port: settings.port, username: settings.username, fingerprint,
      password: safeStorage.encryptString(secret).toString('base64'),
    }
    mkdirSync(app.getPath('userData'), { recursive: true })
    const temporary = loginPath() + '.tmp'
    writeFileSync(temporary, JSON.stringify(login), { mode: 0o600 })
    renameSync(temporary, loginPath())
  } catch (error) {
    if ((error as { level?: string }).level === 'client-authentication') throw new Error('Incorrect board Linux username or password.')
    throw error
  } finally {
    client.destroy()
  }
}

/** Owns the tunnel lifecycle. DeviceLink continues to own the WebSocket protocol. */
export class BoardConnection {
  private signature = ''
  private settings: Settings | null = null
  private generation = 0
  private client: Client | null = null
  private server: Server | null = null
  private sockets = new Set<Socket>()
  private retry: NodeJS.Timeout | null = null
  private endpoint = ''
  private message = 'Choose a board connection in Settings.'

  constructor(private device: DeviceLink) {}

  status(): BoardConnectionStatus {
    return {
      connected: this.device.connected,
      message: this.device.connected ? 'Connected to StudyLens on the board.' : this.message,
    }
  }

  configure(settings: Settings, force = false): void {
    const signature = JSON.stringify([settings.deviceAddress, settings.boardSsh])
    if (!force && this.signature === signature) return
    this.close()
    this.settings = settings
    this.signature = signature
    if (!settings.boardSsh.enabled) {
      this.endpoint = settings.deviceAddress
      this.message = 'Connecting directly to the board…'
      this.device.connect(this.endpoint)
      return
    }
    void this.open(this.generation)
  }

  async test(): Promise<boolean> {
    return !!this.endpoint && testConnection(this.endpoint)
  }

  private async open(generation: number): Promise<void> {
    if (!this.settings || generation !== this.generation) return
    const settings = this.settings.boardSsh
    let client: Client | null = null
    try {
      validateBoardSsh(settings)
      const login = readLogin()
      if (!login || !sameBoard(login, settings)) throw new Error('Save the board login in Settings to enable background SSH.')
      if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential encryption is unavailable.')
      const password = safeStorage.decryptString(Buffer.from(login.password, 'base64'))
      client = new Client()
      this.client = client
      this.message = `Connecting securely to ${settings.host}…`
      let identityChanged = false
      await connectSsh(settings, password, async (fingerprint) => {
        identityChanged = fingerprint !== login.fingerprint
        return !identityChanged
      }, client).catch((error) => {
        if (identityChanged) throw new Error('Board identity changed. Review and save the board login again.')
        throw error
      })
      if (generation !== this.generation) return
      client.once('close', () => this.reconnect(generation, 'Board connection lost. Reconnecting…'))
      const readyClient = client
      const server = createServer((socket) => {
        this.sockets.add(socket)
        socket.on('error', () => socket.destroy())
        socket.once('close', () => this.sockets.delete(socket))
        readyClient.forwardOut('127.0.0.1', 0, '127.0.0.1', settings.remotePort, (error, channel) => {
          if (error || socket.destroyed) {
            channel?.destroy()
            socket.destroy()
            return
          }
          channel.on('error', () => socket.destroy())
          channel.once('close', () => socket.destroy())
          socket.once('close', () => channel.destroy())
          socket.pipe(channel).pipe(socket)
        })
      })
      this.server = server
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.once('close', () => reject(new Error('Forwarding listener closed.')))
        server.listen(0, '127.0.0.1', resolve)
      })
      if (generation !== this.generation) return
      const address = server.address() as AddressInfo
      this.endpoint = `127.0.0.1:${address.port}`
      this.message = 'SSH connected. Waiting for the board app…'
      server.on('error', (error) => this.reconnect(generation, error.message))
      this.device.connect(this.endpoint)
    } catch (error) {
      if (generation === this.generation) {
        const detail = error instanceof Error ? error.message : 'Connection failed.'
        this.reconnect(generation, detail)
      }
    } finally {
      if (generation !== this.generation) client?.destroy()
    }
  }

  private reconnect(generation: number, message: string): void {
    if (generation !== this.generation) return
    this.close()
    this.message = message
    const next = this.generation
    this.retry = setTimeout(() => {
      this.retry = null
      void this.open(next)
    }, 5000)
  }

  close(): void {
    this.generation++
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    this.device.close()
    this.endpoint = ''
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
    this.server?.close()
    this.server = null
    this.client?.destroy()
    this.client = null
  }
}
