import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs'
import { ReactNode } from 'react'
import CustomUserMenu from './CustomUserMenu'
import { useGuest } from '../contexts/GuestContext'
import styles from '../styles/Home.module.css'

interface AuthWrapperProps {
  children: ReactNode
  gameId?: string
  playerId?: number
}

export default function AuthWrapper({ children, gameId, playerId }: AuthWrapperProps) {
  const { isGuest, setIsGuest } = useGuest()

  // If user is in guest mode, show the app with guest menu
  if (isGuest) {
    return (
      <>
        <div className={styles.userMenuContainer}>
          <CustomUserMenu gameId={gameId} playerId={playerId} isGuest={true} hideOnScroll={true} />
        </div>
        {children}
      </>
    )
  }

  return (
    <>
      {/* Show this when user is NOT signed in */}
      <SignedOut>
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
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: '#fff' }}>
            🃏 Fodinha Club
          </h1>
          <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#ccc' }}>
            Choose how you want to play
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', alignItems: 'center' }}>
            <SignInButton mode="modal">
              <button style={{
                backgroundColor: '#4f46e5',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                minWidth: '200px'
              }}>
                🚀 Sign In to Play
              </button>
            </SignInButton>
            
            <button
              onClick={() => setIsGuest(true)}
              style={{
                backgroundColor: 'transparent',
                color: '#ccc',
                padding: '12px 24px',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: '200px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2a2a2a'
                e.currentTarget.style.borderColor = '#444'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.borderColor = '#333'
                e.currentTarget.style.color = '#ccc'
              }}
            >
              👤 Continue as Guest
            </button>
          </div>
        </div>
      </SignedOut>

      {/* Show this when user IS signed in */}
      <SignedIn>
        <div className={styles.userMenuContainer}>
          <CustomUserMenu gameId={gameId} playerId={playerId} isGuest={false} hideOnScroll={true} />
        </div>
        {children}
      </SignedIn>
    </>
  )
} 