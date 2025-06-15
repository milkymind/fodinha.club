import { useState } from 'react';
import { useUser } from '@clerk/nextjs';

interface UsernameSetupProps {
  onUsernameSet: (username: string) => void;
  onSkip?: () => void;
}

export default function UsernameSetup({ onUsernameSet, onSkip }: UsernameSetupProps) {
  const { user } = useUser();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (username.trim().length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    if (username.trim().length > 20) {
      setError('Username must be less than 20 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/create-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        onUsernameSet(username.trim());
      } else {
        setError(data.error || 'Failed to set username');
      }
    } catch (error) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    const defaultUsername = user?.firstName || user?.username || `Player${Date.now()}`;
    onUsernameSet(defaultUsername);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '2rem',
        borderRadius: '12px',
        border: '1px solid #333',
        maxWidth: '400px',
        width: '90%',
        textAlign: 'center',
      }}>
        <h2 style={{ color: '#fff', marginBottom: '1rem' }}>
          🎮 Choose Your Username
        </h2>
        
        <p style={{ color: '#ccc', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          This will be your profile name. You can still use any name you want when playing games!
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username..."
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #444',
              backgroundColor: '#2a2a2a',
              color: '#fff',
              fontSize: '16px',
              marginBottom: '1rem',
              boxSizing: 'border-box',
            }}
            maxLength={20}
            autoFocus
          />

          {error && (
            <p style={{ color: '#ff6b6b', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                backgroundColor: '#4f46e5',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? 'Setting...' : 'Set Username'}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              disabled={isLoading}
              style={{
                backgroundColor: 'transparent',
                color: '#ccc',
                padding: '10px 20px',
                border: '1px solid #444',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              Skip for now
            </button>
          </div>
        </form>

        <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '1rem' }}>
          You can change your username later in your profile settings
        </p>
      </div>
    </div>
  );
} 