import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app'
import '../styles/globals.css'
import '../src/App.css'
import io, { Socket } from 'socket.io-client';
import { SocketContext } from '../contexts/SocketContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { GuestProvider } from '../contexts/GuestContext';
import { ClerkProvider } from '@clerk/nextjs';

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

  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // Show error message if Clerk keys are not configured
  if (!clerkPublishableKey) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: '#0a0a0a',
        color: 'white'
      }}>
        <h1 style={{ color: '#ff6b6b', marginBottom: '1rem' }}>⚠️ Configuration Error</h1>
        <p style={{ color: '#ccc', marginBottom: '1rem' }}>
          Clerk authentication is not configured properly.
        </p>
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          padding: '1rem', 
          borderRadius: '8px',
          textAlign: 'left',
          fontSize: '0.9rem',
          marginBottom: '1rem'
        }}>
          <p style={{ color: '#ffd93d', marginBottom: '0.5rem' }}>To fix this:</p>
          <ol style={{ color: '#ccc', paddingLeft: '1.5rem' }}>
            <li>Create a <code style={{ color: '#4ecdc4' }}>.env.local</code> file in your project root</li>
            <li>Add your Clerk API keys:</li>
          </ol>
          <pre style={{ 
            backgroundColor: '#2a2a2a', 
            color: '#4ecdc4', 
            padding: '0.5rem',
            borderRadius: '4px',
            marginTop: '0.5rem',
            fontSize: '0.8rem'
          }}>
{`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...`}
          </pre>
        </div>
        <p style={{ color: '#ccc', fontSize: '0.9rem' }}>
          Get your keys from <a href="https://dashboard.clerk.com" style={{ color: '#4f46e5' }}>Clerk Dashboard</a>
        </p>
      </div>
    );
  }

  return (
    <ClerkProvider 
      publishableKey={clerkPublishableKey}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <GuestProvider>
        <LanguageProvider>
          <SocketContext.Provider value={socket}>
            <Component {...pageProps} />
          </SocketContext.Provider>
        </LanguageProvider>
      </GuestProvider>
    </ClerkProvider>
  );
} 