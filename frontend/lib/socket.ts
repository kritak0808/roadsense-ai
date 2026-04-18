/**
 * Socket.IO client singleton.
 */
import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "https://roadsense-ai-2.onrender.com";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
