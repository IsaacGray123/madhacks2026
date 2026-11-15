import type { CameraState, DeviceStatus } from '@shared/types'
import { useCameraFrame } from '../lib/hooks'

const STATE_LABEL: Record<CameraState, string> = {
  present: 'In frame',
  phone: 'Phone',
  away: 'Away',
  eating: 'Eating / drinking',
  sleeping: 'Sleeping',
  distracted: 'Looking down'
}

/** A frame older than this counts as a stalled feed. */
const STALE_MS = 3000

/**
 * Live view from the UNO Q camera, mirrored like a selfie view. Frames come in only while this card is
 * on screen and are never saved.
 */
export default function CameraPreview({
  device,
  enabled,
  onToggle,
  className = ''
}: {
  device: DeviceStatus
  enabled: boolean
  onToggle: (on: boolean) => void
  className?: string
}): JSX.Element {
  const frame = useCameraFrame(enabled && device.connected)
  const fresh = !!frame && Date.now() - frame.at < STALE_MS
  const live = device.connected && fresh

  return (
    <div className={`card pop-in overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span className="label-xs">Camera</span>
          {enabled && (
            <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
              <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-red-500' : 'bg-ink-faint'}`} />
              {live ? 'Live' : device.connected ? 'Waiting for video…' : 'Offline'}
            </span>
          )}
        </div>
        <button className="text-xs font-medium text-accent hover:underline" onClick={() => onToggle(!enabled)}>
          {enabled ? 'Hide' : 'Show camera'}
        </button>
      </div>

      {enabled && (
        <div className="relative mx-5 mb-5 aspect-[4/3] overflow-hidden rounded-xl bg-[#0d1013]">
          {frame && device.connected ? (
            <img
              src={frame.src}
              alt="Live view from the UNO Q camera"
              className={`h-full w-full -scale-x-100 object-cover transition-opacity duration-300 ${fresh ? '' : 'opacity-40'}`}
              draggable={false}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-xs text-white/60">
              <CameraIcon />
              {device.connected ? 'Starting the camera feed…' : 'Connect the UNO Q to see the camera.'}
            </div>
          )}
          {live && device.cameraState && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
              <span className={`h-1.5 w-1.5 rounded-full ${device.faceDetected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {device.faceDetected ? STATE_LABEL[device.cameraState] : 'No face detected'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CameraIcon(): JSX.Element {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}
