import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export interface PresenceViewer {
  userId: string
  email: string | null
}

let sharedSocket: Socket | null = null

function getSocket(): Socket {
  if (sharedSocket && sharedSocket.connected) return sharedSocket
  const token =
    (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
  sharedSocket = io('/', {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  })
  return sharedSocket
}

/**
 * Subscribe to a parameter's presence room. Returns the list of OTHER
 * viewers (current user filtered out client-side). Auto-emits
 * `parameter:viewing` on mount and `parameter:stop-viewing` on unmount
 * so the server can broadcast the updated viewer set.
 */
export function useParameterPresence(
  projectId: string | undefined,
  parameterId: string | null,
  selfUserId: string | undefined,
): PresenceViewer[] {
  const [viewers, setViewers] = useState<PresenceViewer[]>([])

  useEffect(() => {
    if (!projectId || !parameterId) {
      setViewers([])
      return
    }
    const socket = getSocket()
    const onViewers = (payload: {
      projectId: string
      parameterId: string
      viewers: PresenceViewer[]
    }) => {
      if (payload.projectId !== projectId || payload.parameterId !== parameterId) return
      setViewers(
        payload.viewers.filter((v) => v.userId !== selfUserId),
      )
    }
    socket.on('parameter:viewers', onViewers)

    const announce = () => {
      socket.emit('parameter:viewing', { projectId, parameterId })
    }
    if (socket.connected) announce()
    else socket.once('connect', announce)

    return () => {
      socket.off('parameter:viewers', onViewers)
      socket.emit('parameter:stop-viewing', { projectId, parameterId })
    }
  }, [projectId, parameterId, selfUserId])

  return viewers
}
