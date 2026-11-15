import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createConnection, type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Server as SshServer, type Connection } from 'ssh2'
import { WebSocketServer } from 'ws'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, withDefaults } from '@shared/defaults'
import type { BoardSshSettings } from '@shared/types'
import { BoardConnection, forgetBoardLogin, saveBoardLogin } from './boardConnection'
import { DeviceLink } from './deviceLink'

const state = vi.hoisted(() => ({ directory: '', trust: true }))
vi.mock('electron', () => ({
  app: { getPath: () => state.directory },
  dialog: { showMessageBox: vi.fn(async () => ({ response: state.trust ? 1 : 0 })) },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const key = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
}).privateKey

describe('background board connection', () => {
  let server: SshServer
  let websocket: WebSocketServer
  let config: BoardSshSettings
  let device: DeviceLink
  let connection: BoardConnection
  let clients: Set<Connection>
  let previewRequests: boolean[]
  let sshConnections: number

  beforeEach(async () => {
    state.directory = mkdtempSync(join(tmpdir(), 'studylens-connection-'))
    state.trust = true
    clients = new Set()
    previewRequests = []
    sshConnections = 0
    websocket = new WebSocketServer({ host: '127.0.0.1', port: 0 })
    await new Promise<void>((resolve) => websocket.once('listening', resolve))
    websocket.on('connection', (socket) => {
      socket.send(JSON.stringify({ type: 'hello', device: 'unoq', version: 1 }))
      socket.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'preview') previewRequests.push(message.on)
      })
    })
    server = new SshServer({ hostKeys: [key] }, (client) => {
      sshConnections++
      clients.add(client)
      client.on('close', () => clients.delete(client))
      client.on('error', () => {})
      client.on('authentication', (authentication) => {
        if (authentication.method === 'password' && authentication.password === 'test-password') authentication.accept()
        else authentication.reject()
      })
      client.on('tcpip', (accept, _reject, request) => {
        const stream = accept()
        const socket = createConnection({ host: request.destIP, port: request.destPort })
        socket.on('error', () => stream.destroy())
        stream.on('error', () => socket.destroy())
        stream.once('close', () => socket.destroy())
        socket.once('close', () => stream.destroy())
        stream.pipe(socket).pipe(stream)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    config = {
      enabled: true, host: '127.0.0.1', port: (server.address() as AddressInfo).port,
      username: 'arduino', remotePort: (websocket.address() as { port: number }).port,
    }
    device = new DeviceLink()
    connection = new BoardConnection(device)
  })

  afterEach(async () => {
    connection.close()
    for (const client of clients) client.end()
    for (const client of websocket.clients) client.terminate()
    await Promise.all([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => websocket.close(() => resolve())),
    ])
    expect(dirname(resolve(state.directory))).toBe(resolve(tmpdir()))
    rmSync(state.directory, { recursive: true, force: true })
  })

  it('preserves defaults for settings saved before SSH support', () => {
    expect(withDefaults({ deviceAddress: '127.0.0.1:8766' }).boardSsh.enabled).toBe(false)
  })

  it('saves a login, forwards the existing protocol, and closes the listener', async () => {
    await saveBoardLogin(config, 'test-password')
    const stored = readFileSync(join(state.directory, 'board-login.json'), 'utf8')
    expect(stored).not.toContain('test-password')
    device.setPreview(true)
    const settings = { ...DEFAULT_SETTINGS, boardSsh: config }
    connection.configure(settings)
    await vi.waitFor(() => expect(device.connected).toBe(true), { timeout: 10000 })
    expect(await connection.test()).toBe(true)
    await vi.waitFor(() => expect(previewRequests).toContain(true))
    const count = sshConnections
    connection.configure({ ...settings, theme: 'dark' })
    expect(sshConnections).toBe(count)
    expect(device.connected).toBe(true)
    connection.close()
    connection.close()
    expect(device.connected).toBe(false)
    expect(await connection.test()).toBe(false)
  }, 15000)

  it('reuses the saved password when updating an existing login', async () => {
    await saveBoardLogin(config, 'test-password')
    await saveBoardLogin(config, '')
    connection.configure({ ...DEFAULT_SETTINGS, boardSsh: config })
    await vi.waitFor(() => expect(device.connected).toBe(true), { timeout: 10000 })
  }, 15000)

  it('rejects incorrect passwords without saving them', async () => {
    await expect(saveBoardLogin(config, 'incorrect')).rejects.toThrow()
    expect(existsSync(join(state.directory, 'board-login.json'))).toBe(false)
  })

  it('removes the saved credential when forgotten', async () => {
    await saveBoardLogin(config, 'test-password')
    forgetBoardLogin()
    expect(existsSync(join(state.directory, 'board-login.json'))).toBe(false)
    connection.configure({ ...DEFAULT_SETTINGS, boardSsh: config })
    expect(connection.status().message).toContain('Save the board login')
  })

  it('cancels an in-progress tunnel when switching back to a direct connection', async () => {
    await saveBoardLogin(config, 'test-password')
    connection.configure({ ...DEFAULT_SETTINGS, boardSsh: config })
    connection.configure({
      ...DEFAULT_SETTINGS, deviceAddress: `127.0.0.1:${config.remotePort}`,
    })
    await vi.waitFor(() => expect(device.connected).toBe(true), { timeout: 5000 })
    expect(await connection.test()).toBe(true)
    expect(connection.status().message).toContain('Connected')
  })

  it('recovers a damaged saved-login file through the pairing flow', async () => {
    writeFileSync(join(state.directory, 'board-login.json'), '{')
    await saveBoardLogin(config, 'test-password')
    connection.configure({ ...DEFAULT_SETTINGS, boardSsh: config })
    await vi.waitFor(() => expect(device.connected).toBe(true), { timeout: 10000 })
  }, 15000)

  it('rejects a board identity when the user cancels pairing', async () => {
    state.trust = false
    await expect(saveBoardLogin(config, 'test-password')).rejects.toThrow()
    expect(existsSync(join(state.directory, 'board-login.json'))).toBe(false)
  })

  it('reports changed host keys during background reconnect', async () => {
    await saveBoardLogin(config, 'test-password')
    const file = join(state.directory, 'board-login.json')
    const login = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify({ ...login, fingerprint: 'SHA256:changed' }))
    connection.configure({ ...DEFAULT_SETTINGS, boardSsh: config })
    await vi.waitFor(() => expect(connection.status().message).toContain('identity changed'), { timeout: 10000 })
    expect(device.connected).toBe(false)
  }, 15000)

  it('automatically reconnects after the SSH session drops', async () => {
    await saveBoardLogin(config, 'test-password')
    connection.configure({ ...DEFAULT_SETTINGS, boardSsh: config })
    await vi.waitFor(() => expect(device.connected).toBe(true), { timeout: 10000 })
    for (const client of clients) client.end()
    await vi.waitFor(() => expect(device.connected).toBe(false), { timeout: 5000 })
    await vi.waitFor(() => expect(device.connected).toBe(true), { timeout: 12000 })
  }, 25000)
})
