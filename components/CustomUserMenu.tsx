import { useState, useEffect } from 'react'
import { useUser, useClerk, SignInButton } from '@clerk/nextjs'
import { useLanguage } from '../contexts/LanguageContext'
import { useGuest } from '../contexts/GuestContext'
import BugReportModal from './BugReportModal'

interface CustomUserMenuProps {
  gameId?: string;
  playerId?: number;
  isGuest?: boolean;
}

export default function CustomUserMenu({ gameId, playerId, isGuest = false }: CustomUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isBugModalOpen, setIsBugModalOpen] = useState(false)
  const { user, isLoaded } = useUser()
  const { signOut, openUserProfile } = useClerk()
  const { t, toggleLanguage, language } = useLanguage()
  const { guestName, setIsGuest } = useGuest()

  // Automatically clear guest mode when user becomes authenticated
  useEffect(() => {
    if (isLoaded && user && isGuest) {
      setIsGuest(false)
    }
  }, [isLoaded, user, isGuest, setIsGuest])

  const displayName = isGuest ? guestName : (user?.firstName || user?.username || 'Player')

  const handleSignOut = () => {
    if (isGuest) {
      setIsGuest(false)
    } else {
      signOut()
    }
    setIsOpen(false)
  }

  const handleBugReport = () => {
    // Open the same bug report modal as the top-right button
    setIsBugModalOpen(true)
    setIsOpen(false)
  }

  const handleUserSettings = () => {
    if (!isGuest) {
      // Open Clerk user profile settings
      openUserProfile()
    }
    setIsOpen(false)
  }

  const handleLeaderboard = () => {
    // Open leaderboard - you can customize this
    console.log('Open leaderboard')
    setIsOpen(false)
  }

  const handleSignInClick = () => {
    setIsOpen(false)
    // The SignInButton will handle the sign-in process
    // The useEffect above will automatically clear guest mode when auth succeeds
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        {/* Profile Picture Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            backgroundColor: 'transparent',
            border: '2px solid #333',
            borderRadius: '50%',
            padding: '0',
            cursor: 'pointer',
            width: '40px',
            height: '40px',
            transition: 'border-color 0.2s, transform 0.2s',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#4f46e5'
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#333'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          {!isGuest && user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="Profile"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%'
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: isGuest ? '#6b7280' : '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '48px',
            right: '0',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '12px',
            minWidth: '220px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1001
          }}>
            {/* User Info */}
            <div style={{
              borderBottom: '1px solid #333',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}>
              <div style={{
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
                marginBottom: '4px'
              }}>
                {isGuest ? '👤 Guest User' : `👤 ${displayName}`}
              </div>
              {!isGuest && (
                <div style={{
                  color: '#888',
                  fontSize: '12px'
                }}>
                  {user?.primaryEmailAddress?.emailAddress}
                </div>
              )}
              {isGuest && (
                <div style={{
                  color: '#888',
                  fontSize: '12px'
                }}>
                  Playing without account
                </div>
              )}
            </div>

            {/* Menu Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Guest Sign In/Sign Up Options */}
              {isGuest && (
                <>
                  <SignInButton mode="modal">
                    <button
                      style={{
                        width: '100%',
                        backgroundColor: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
                      onClick={handleSignInClick}
                    >
                      🚀 Sign In
                    </button>
                  </SignInButton>
                </>
              )}

              {/* Leaderboard Button */}
              <button
                onClick={handleLeaderboard}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2a2a2a'
                  e.currentTarget.style.borderColor = '#444'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.borderColor = '#333'
                }}
              >
                🏆 Leaderboard
              </button>

              {/* Bug Report Button */}
              <button
                onClick={handleBugReport}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2a2a2a'
                  e.currentTarget.style.borderColor = '#444'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.borderColor = '#333'
                }}
              >
                🐛 Report Bug
              </button>

              {/* Language Toggle Button */}
              <button
                onClick={() => {
                  toggleLanguage()
                  setIsOpen(false)
                }}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2a2a2a'
                  e.currentTarget.style.borderColor = '#444'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.borderColor = '#333'
                }}
              >
                🌐 {language === 'en' ? 'Português' : 'English'}
              </button>

              {/* User Settings Button (only for authenticated users) */}
              {!isGuest && (
                <button
                  onClick={handleUserSettings}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    color: '#fff',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2a2a2a'
                    e.currentTarget.style.borderColor = '#444'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = '#333'
                  }}
                >
                  ⚙️ Settings
                </button>
              )}

              {/* Sign Out Button (only for authenticated users) */}
              {!isGuest && (
                <button
                  onClick={handleSignOut}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    color: '#ff6b6b',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2a2a2a'
                    e.currentTarget.style.borderColor = '#ff6b6b'
                    e.currentTarget.style.color = '#ff8a8a'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = '#333'
                    e.currentTarget.style.color = '#ff6b6b'
                  }}
                >
                  🚪 Sign Out
                </button>
              )}
            </div>
          </div>
        )}

        {/* Click outside to close */}
        {isOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>

      {/* Bug Report Modal */}
      {isBugModalOpen && (
        <BugReportModal
          gameId={gameId}
          playerId={playerId}
          isOpen={isBugModalOpen}
          onClose={() => setIsBugModalOpen(false)}
        />
      )}
    </>
  )
} 