# Automatic connection plan

## Everyday experience

The intended routine is to power the UNO Q, open the installed StudyLens app, and press Start once the camera is ready. First-time setup handles the board's Wi-Fi, pairing, and Python environment. Later launches reuse that preparation.

The board and laptop still need a reachable local link. A saved home Wi-Fi network, a phone hotspot, or a laptop hotspot can supply it. StudyLens's normal inference and local connection can operate without an internet service after dependencies and models have been prepared. Windows hotspot availability depends on its connection-sharing setup and adapter support. The app should accurately show when a local link is unavailable. [Windows Mobile hotspot](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/use-your-windows-device-as-a-mobile-hotspot)

## Recommended transport

Use automatic, app-managed SSH forwarding for the paired device. The observed network already permitted SSH while direct TCP 8765 timed out. A managed connection reuses that demonstrated path and carries the existing WebSocket protocol.

The recommended product version uses `ssh2` in Electron's main process. It supports TCP forwarding, private-key authentication, host-key verification, and keepalives. A local listener bound to `127.0.0.1` forwards to the board's own `127.0.0.1:8765`. `DeviceLink` connects through that local listener and keeps its existing message parsing. [ssh2 documentation](https://github.com/mscdex/ssh2)

Keep the camera worker, App Lab image, Python versions, WebSocket message contract, and MCU Bridge unchanged during this transport work. This reduces the number of moving parts we need to retest.

| Route | Setup and tradeoff | Recommended role |
|---|---|---|
| App-managed OpenSSH process | Small code change if a usable SSH key and known host already exist. Needs installed `ssh.exe` and careful child lifecycle handling | Fast implementation for this laptop |
| Embedded `ssh2` | Adds a Node dependency and pairing work. Allows one onboarding flow, local dynamic ports, and integrated error messages | Product direction |
| Direct WebSocket | Requires reachable published port 8765 and a reliable device address. The server currently has no app-level pairing authentication | Manual/debug option on a controlled local network |
| Laptop Wi-Fi hotspot | Reduces dependence on venue Wi-Fi and phone battery. Still needs local discovery and a transport | Useful network option |
| USB/ADB forwarding | Requires a cable and available board USB arrangement | Optional recovery path after verification |

A Makefile could collect developer build commands. Startup, stored pairing, and transport lifecycle belong in the installed app and board startup configuration.

## One-time preparation on the board

These are proposed setup instructions. Check actual app IDs and connection profile names first.

1. Save the selected Wi-Fi network on the board. Use the normal App Lab configuration or NetworkManager. Verify reconnection after a power cycle.
2. Run `arduino-app-cli app list` to identify the app. The observed app folder was `hackathon-1`.
3. Set the app as the default using the identified ID. For the observed app, the intended command is shown below.

```sh
arduino-app-cli properties set default user:hackathon-1
arduino-app-cli properties get default
```

App Lab also exposes Run at startup beside the app name. The board then launches the default app when powered. Only one app can hold that role. [Arduino startup documentation](https://docs.arduino.cc/software/app-lab/apps/run), [App CLI](https://docs.arduino.cc/software/app-lab/cli/cli)

4. Verify `ports: [8765]` in the board app's `app.yaml` and the published mapping. The SSH tunnel reaches the board's localhost published port.
5. Prepare inference once from the running app container.

```sh
docker exec hackathon-1-main-1 python3 /app/python/setup_vision.py
```

6. Restart the app, verify model initialization and a fresh camera sample, then power-cycle the board and verify both again. A cached environment is a convenience, and a full cold-boot test is the evidence of readiness.

The setup script already stores its interpreter and environment under the mounted app cache. Provision it while internet access is available. A demo-day startup should reuse these installed dependencies.

## Pairing flow

Proposed onboarding has three short steps.

1. Find or enter the board's host address. Try the saved address first. Record a hostname if it resolves reliably on the user's network. mDNS discovery can be added after the basic transport is working.
2. Confirm the board identity once and authenticate with the board's Linux account. The UI can show a host-key fingerprint and an explanation. Host-key verification is performed on future launches as well.
3. Create and install a per-laptop SSH key, save the encrypted private material locally, and test the full WebSocket handshake. Record the board identity, SSH username, remote service port, and last known host.

The pairing operation must preserve existing `authorized_keys` entries. Give the new public key a unique StudyLens comment. If pairing is retried, detect that key instead of appending duplicates. Forgetting the device removes the laptop's saved credential. Revoking the key on the board is an explicit separate action.

Use Electron `safeStorage` in the main process for the local key. The pinned Electron 33 release supports the synchronous encryption methods. Check encryption availability, persist the encrypted result, and expose only connection status to the renderer. Current documentation also describes newer APIs, so verify an API against Electron 33 before copying it. Windows protection uses the logged-in user's OS facilities. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

Proposed settings representation follows. Secret material belongs in a separate encrypted file under `app.getPath('userData')`.

```ts
interface PairedBoard {
  id: string
  label: string
  host: string
  lastKnownAddress: string | null
  sshPort: number
  username: string
  hostKeySha256: string
  privateKeyReference: string
  remoteServicePort: number
}

type ConnectionPhase =
  | 'unpaired'
  | 'finding'
  | 'connecting'
  | 'auth-required'
  | 'board-starting'
  | 'camera-starting'
  | 'ready'
  | 'reconnecting'
  | 'unavailable'
```

## Connection controller

Proposed responsibilities for `app/src/main/connectionManager.ts` are listed below.

- Own one paired device, one SSH session, one local forwarding listener, and one retry timer.
- Give each connection attempt a generation number. Cancel an older attempt when settings change, the app quits, or a newer attempt succeeds.
- Resolve the saved host, connect to SSH, verify the saved host key, authenticate, and start forwarding.
- Bind a forwarding listener using local port 0 so the OS chooses a free port. Pass the resulting URL to `DeviceLink`. Keep this effective endpoint separate from the saved board identity.
- Treat SSH readiness, WebSocket readiness, and camera readiness as distinct conditions. A forwarded port alone does not establish a functioning camera.
- Apply a proposed bounded retry delay of 1, 2, 4, and 8 seconds, then cap around 15 seconds with small jitter. Reset after a stable connection. Authentication or host-identity failures become actionable UI states.
- On an SSH close, close forwarding sockets and invalidate the old WebSocket before retrying. Reconnect restores the current session status and preview preference using existing code.
- Ensure “Test connection” uses this same controller path rather than probing a saved stale loopback address.
- On app quit, close the WebSocket, forwarding sockets, server, SSH session, and retry timer.

The latest `DeviceLink` already resends preview preference on reconnect and `SessionManager` sends session state on a board reconnect. Preserve both behaviors.

## Code reference for an established SSH session

The following helper illustrates the forwarding layer. It assumes that `ssh` is already authenticated and verified. The owning controller must call `close()` on SSH loss, pairing changes, and app exit. This helper alone is not a full connection manager.

```ts
import { createServer, type Socket } from 'node:net'
import type { AddressInfo } from 'node:net'
import type { Client } from 'ssh2'

export async function openBoardForward(
  ssh: Client,
  onFailure: (error: Error) => void,
  remotePort = 8765,
) {
  if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) {
    throw new Error('Invalid board service port')
  }
  const sockets = new Set<Socket>()
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
    socket.on('error', () => socket.destroy())

    ssh.forwardOut('127.0.0.1', 0, '127.0.0.1', remotePort, (error, channel) => {
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
  server.on('error', onFailure)

  await new Promise<void>((resolve, reject) => {
    const fail = (error: Error) => reject(error)
    server.once('error', fail)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', fail)
      resolve()
    })
  })

  const address = server.address() as AddressInfo
  let closed = false
  return {
    address: `127.0.0.1:${address.port}`,
    close: async () => {
      if (closed) return
      closed = true
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}
```

The `onFailure` callback coordinates listener errors with the owning controller. The main controller must also enforce its lifecycle when `forwardOut` returns an error after a reconnect. A failed forwarded channel can mean the board app is still starting, which should produce a recoverable readiness state.

Host verification can hash the raw SSH key and compare it with the saved SHA-256 fingerprint. The `ssh2` `hostVerifier` callback defaults to accepting keys when omitted, so supply it explicitly. Configure keepalives, connection timeouts, and terminal error handling. [ssh2 client configuration](https://github.com/mscdex/ssh2#client-methods)

## Fast implementation using existing OpenSSH

If the board has already been paired with a working SSH key and known-host entry, an Electron-managed child is the quickest route. Launch with `spawn` using an argument array, `shell: false`, and `windowsHide: true`.

```ts
const args = [
  '-N', '-T',
  '-o', 'BatchMode=yes',
  '-o', 'ExitOnForwardFailure=yes',
  '-o', 'ServerAliveInterval=15',
  '-o', 'ServerAliveCountMax=3',
  '-o', 'StrictHostKeyChecking=yes',
  '-i', pairedKeyPath,
  '-L', `127.0.0.1:${localPort}:127.0.0.1:8765`,
  `${username}@${host}`,
]
```

This proposal requires key provisioning during first-time setup. A password prompt in a hidden process would stall the launch. First select a free local port, handle a bind race by retrying another port, and confirm the WebSocket handshake before marking Ready. Watch the child exit and stderr, hide technical output behind a details control, and stop the child on quit.

## File map

| File | Proposed change |
|---|---|
| `app/src/main/connectionManager.ts` | Own transport attempts, endpoint, readiness, retry, and cleanup |
| `app/src/main/pairing.ts` | Pair device, create/install key, verify identity, encrypt local secret |
| `app/src/main/deviceLink.ts` | Accept effective endpoint and preserve existing messages/preview reconnect |
| `app/src/main/index.ts` | Start/stop controller and route pairing IPC |
| `app/src/preload/index.ts` | Narrow pairing and connection-status IPC methods |
| `app/src/shared/types.ts` and `defaults.ts` | Connection mode and backward-compatible saved pairing settings |
| `app/src/renderer/src/pages/Settings.tsx` | Pair/change/forget device and readable connection states |
| `app/package.json` | Add transport dependency if the embedded approach is selected |

Keep old `deviceAddress` settings usable during migration. Infer manual mode for existing saved addresses unless the user pairs a board. Use the current default-merge mechanism for new nested settings.

## Acceptance checks

1. Cold boot the board, then open the installed Windows app. Observe SSH, WebSocket, camera, and session readiness.
2. Restart the board while the laptop app remains open. It reconnects once and restores session/preview state.
3. Turn the network off and back on. Confirm recovery without duplicate SSH processes or event handlers.
4. Quit the app and verify the forwarding listener is closed.
5. Start the app twice. The existing single-instance guard remains effective.
6. Use an occupied preferred local port. Dynamic allocation or retry succeeds.
7. Change the host IP and update the paired device once. A saved hostname resolves when available.
8. Enter a wrong password during pairing. The app gives a recoverable message and does not save a broken credential.
9. Change the host key in a controlled test. The app shows an identity-change state rather than silently accepting it.
10. Confirm the first-time flow works in the packaged app on the actual Windows account.
11. Verify optional preview and reminder/touch actions through the forwarded connection.

## Definition of simplicity achieved

A returning user powers the already provisioned board and opens StudyLens. The app connects without a terminal, an address entry, or a password prompt. A first-time user completes one guided pairing flow. A user who changes networks sees a specific reconnect instruction instead of a generic “Could not reach board.”
