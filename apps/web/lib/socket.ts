import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    // Priority 1: If we are on production domain, use it directly (bypass env stuck issues)
    if (window.location.hostname.includes('rxdesk.in')) {
      return 'https://rxdesk.in';
    }
    // Priority 2: Use current origin if API URL is relative or missing
    const envUrl = process.env.NEXT_PUBLIC_API_URL || '';
    if (!envUrl || envUrl.startsWith('/')) return window.location.origin;
    try {
      return new URL(envUrl).origin;
    } catch {
      return window.location.origin;
    }
  }
  return 'http://localhost:3000';
};
export const socket = io(getSocketUrl(), {
  path: '/api/v1/socket.io',
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 20000,
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
