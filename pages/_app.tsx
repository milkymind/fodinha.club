import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app'
import '../styles/globals.css'
import io, { Socket } from 'socket.io-client';
import { SocketContext } from '../contexts/SocketContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function App({ Component, pageProps }: AppProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection only once
    const initializeSocket = async () => {
      try {
        // Make sure the socket server is running
        await fetch('/api/socket');
        
        // Connect to the socket server with stable reconnection settings
        const socketConnection = io({
          path: '/api/socket-io',
          addTrailingSlash: false,
          reconnection: true,
          reconnectionAttempts: 5, // Reduced attempts to prevent spam
          reconnectionDelay: 3000, // Start with 3 second delay
          reconnectionDelayMax: 15000, // Max 15 seconds between attempts
          timeout: 45000, // 45 second timeout - match server
          transports: ['websocket', 'polling'], // Try websocket first, fall back to polling
          forceNew: false, // Don't force new connections - reuse existing ones
          autoConnect: true, // Auto connect on instantiation
          upgrade: true, // Allow transport upgrade
          // Add randomization to prevent thundering herd
          randomizationFactor: 0.5,
          // Enable connection state recovery
          auth: {
            sessionId: typeof window !== 'undefined' ? localStorage.getItem('socket-session-id') : null
          }
        });
        
        // Set up event listeners
        socketConnection.on('connect', () => {
          console.log('Socket connected:', socketConnection.id);
          setSocketConnected(true);
          
          // Store session ID for connection state recovery
          if (typeof window !== 'undefined' && socketConnection.id) {
            localStorage.setItem('socket-session-id', socketConnection.id);
          }
        });
        
        socketConnection.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setSocketConnected(false);
          
          // Let socket.io handle reconnection automatically
          // Don't manually trigger reconnection to avoid conflicts
        });
        
        socketConnection.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          setSocketConnected(false);
        });
        
        socketConnection.on('reconnect', (attemptNumber) => {
          console.log(`Socket reconnected after ${attemptNumber} attempts`);
          setSocketConnected(true);
        });
        
        socketConnection.on('reconnect_attempt', (attemptNumber) => {
          console.log(`Socket reconnect attempt #${attemptNumber}`);
        });
        
        socketConnection.on('reconnect_error', (error) => {
          console.error('Socket reconnection error:', error);
        });
        
        socketConnection.on('reconnect_failed', () => {
          console.error('Socket reconnection failed after all attempts');
          setSocketConnected(false);
        });
        
        socketConnection.on('error', (error) => {
          console.error('Socket error:', error);
        });
        
        setSocket(socketConnection);
      } catch (error) {
        console.error('Failed to initialize socket:', error);
        // Try again after a delay
        setTimeout(initializeSocket, 5000);
      }
    };

    // Only initialize once - remove socket dependency to prevent recreation
      initializeSocket();

    // Clean up on unmount only
    return () => {
      if (socket) {
        console.log('Cleaning up socket connection');
        socket.disconnect();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  return (
    <ThemeProvider>
    <LanguageProvider>
    <SocketContext.Provider value={socket}>
      <Component {...pageProps} />
    </SocketContext.Provider>
    </LanguageProvider>
    </ThemeProvider>
  );
} 