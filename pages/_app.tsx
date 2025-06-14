import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app'
import '../styles/globals.css'
import '../src/App.css'
import io, { Socket } from 'socket.io-client';
import { SocketContext } from '../contexts/SocketContext';
import { LanguageProvider } from '../contexts/LanguageContext';

export default function App({ Component, pageProps }: AppProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const initializeSocket = async () => {
      try {
        // Make sure the socket server is running
        await fetch('/api/socket');
        
        // Connect to the socket server with improved reconnection settings
        const socketConnection = io({
          path: '/api/socket-io',
          addTrailingSlash: false,
          reconnection: true,
          reconnectionAttempts: Infinity, // Never stop trying to reconnect
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          timeout: 60000, // Longer timeout
          transports: ['websocket', 'polling'], // Try websocket first, fall back to polling
          forceNew: true, // Create a new connection each time
          autoConnect: true, // Auto connect on instantiation
          upgrade: true, // Allow transport upgrade
        });
        
        // Set up event listeners
        socketConnection.on('connect', () => {
          console.log('Socket connected:', socketConnection.id);
          setSocketConnected(true);
        });
        
        socketConnection.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setSocketConnected(false);
          
          // Handle specific disconnect reasons
          if (reason === 'io server disconnect') {
            // Server has forcefully disconnected, try reconnecting manually
            setTimeout(() => {
              socketConnection.connect();
            }, 1000);
          }
          // For other reasons, socket.io will try to reconnect automatically
        });
        
        socketConnection.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          setSocketConnected(false);
        });
        
        socketConnection.on('reconnect', (attemptNumber) => {
          console.log(`Socket reconnected after ${attemptNumber} attempts`);
        });
        
        socketConnection.on('reconnect_attempt', (attemptNumber) => {
          console.log(`Socket reconnect attempt #${attemptNumber}`);
        });
        
        socketConnection.on('reconnect_error', (error) => {
          console.error('Socket reconnection error:', error);
        });
        
        socketConnection.on('reconnect_failed', () => {
          console.error('Socket reconnection failed, will reset connection');
          // Reset the socket state to trigger a fresh connection
          setSocket(null);
        });
        
        socketConnection.on('error', (error) => {
          console.error('Socket error:', error);
        });
        
        setSocket(socketConnection);
      } catch (error) {
        console.error('Failed to initialize socket:', error);
        // Try again after a delay with exponential backoff
        setTimeout(initializeSocket, 3000);
      }
    };

    // Only initialize if we don't have a socket yet
    if (!socket) {
      initializeSocket();
    }

    // Clean up on unmount
    return () => {
      if (socket) {
        console.log('Cleaning up socket connection');
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [socket]);

  return (
    <LanguageProvider>
    <SocketContext.Provider value={socket}>
      <Component {...pageProps} />
    </SocketContext.Provider>
    </LanguageProvider>
  );
} 