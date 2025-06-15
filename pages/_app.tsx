import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app'
import '../styles/globals.css'
import io, { Socket } from 'socket.io-client';
import { SocketContext } from '../contexts/SocketContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { GuestProvider } from '../contexts/GuestContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ScrollProvider } from '../contexts/ScrollContext';
import { ClerkProvider } from '@clerk/nextjs';

export default function App({ Component, pageProps }: AppProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    // Prevent multiple socket connections in development mode
    if (socket) {
      return;
    }
    
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
          reconnectionAttempts: 3, // Reduced attempts to prevent spam
          reconnectionDelay: 2000, // Start with 2 second delay
          reconnectionDelayMax: 10000, // Max 10 seconds between attempts
          timeout: 20000, // 20 second timeout - reduced for faster failure detection
          transports: ['polling', 'websocket'], // Match server: polling first to avoid upgrade issues
          forceNew: false, // Don't force new connections - reuse existing ones
          autoConnect: true, // Auto connect on instantiation
          upgrade: false, // Disable transport upgrades to prevent binding errors
          // Add randomization to prevent thundering herd
          randomizationFactor: 0.3,
          // Remove connection state recovery to match server config
        });
        
        // Set up event listeners
        socketConnection.on('connect', () => {
          console.log('Socket connected:', socketConnection.id);
          setSocketConnected(true);
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
      // Cleanup will be handled by the socket variable change
    };
  }, []); // Empty dependency array - only run once on mount

  // Cleanup effect for socket disconnection
  useEffect(() => {
    return () => {
      if (socket) {
        console.log('Cleaning up socket connection');
        socket.disconnect();
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
      <ThemeProvider>
        <GuestProvider>
          <LanguageProvider>
            <SocketContext.Provider value={socket}>
              <ScrollProvider>
                <Component {...pageProps} />
              </ScrollProvider>
            </SocketContext.Provider>
          </LanguageProvider>
        </GuestProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
} 