import { io } from 'socket.io-client';

const getSocketUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (typeof window !== 'undefined') {
    // If running in browser and the API matches the same domain (or is relative)
    if (!envUrl || envUrl.startsWith('/')) return window.location.origin;
    try {
      return new URL(envUrl).origin;
    } catch {
      return window.location.origin;
    }
  }
  // Server-side fallback
  try {
    return new URL(envUrl).origin;
  } catch {
    return 'http://localhost:3000';
  }
};

export const socket = io(getSocketUrl(), {
  path: '/api/v1/socket.io',
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
});

// Helper to connect with auth token
export const connectSocket = (token: string) => {
  if (socket.connected) return;
  socket.auth = { token };
  socket.connect();
};

export const disconnectSocket = () => {
  if (socket.connected) socket.disconnect();
};
