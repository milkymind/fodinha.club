interface UserProfileDisplayProps {
  profile: {
    username: string;
    gamesPlayed: number;
    gamesWon: number;
  } | null;
}

export default function UserProfileDisplay({ profile }: UserProfileDisplayProps) {
  if (!profile) return null;

  const winRate = profile.gamesPlayed > 0 
    ? ((profile.gamesWon / profile.gamesPlayed) * 100).toFixed(1)
    : '0';

  return (
    <div style={{
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '0.75rem',
      color: '#fff',
      fontSize: '0.8rem',
      minWidth: '180px',
      zIndex: 100,
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
        👤 {profile.username}
      </div>
      <div style={{ color: '#ccc', fontSize: '0.7rem' }}>
        🎮 {profile.gamesPlayed} games • 🏆 {profile.gamesWon} wins
      </div>
      {profile.gamesPlayed > 0 && (
        <div style={{ color: '#4ade80', fontSize: '0.7rem' }}>
          📊 {winRate}% win rate
        </div>
      )}
    </div>
  );
} 