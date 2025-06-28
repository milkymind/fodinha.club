import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@clerk/nextjs';
import AuthWrapper from '../components/AuthWrapper';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

interface LeaderboardEntry {
  rank: number;
  username: string;
  value: string;
  gamesPlayed: number;
  lastUpdated: string;
  percentile?: number;
}

interface LeaderboardData {
  metric: string;
  description: string;
  totalPlayers: number;
  leaderboard: LeaderboardEntry[];
  metricInfo?: {
    name: string;
    description: string;
    unit: string;
    betterWhen: 'higher' | 'lower';
  };
  rankings?: LeaderboardEntry[];
}

const getMetrics = (t: (key: string) => string) => [
  {
    key: 'perfectPredictionRate',
    name: t('perfect_prediction_rate'),
    icon: '🎯',
    description: t('perfect_prediction_desc')
  },
  {
    key: 'avgSurvivalRate',
    name: t('survival_rate'),
    icon: '💪',
    description: t('survival_rate_desc')
  },
  {
    key: 'multiplierEfficiency',
    name: t('multiplier_efficiency'),
    icon: '⚡',
    description: t('multiplier_efficiency_desc')
  },
  {
    key: 'lastPlayerWinRate',
    name: t('last_player_performance'),
    icon: '🎲',
    description: t('last_player_performance_desc')
  },
  {
    key: 'highPressureAccuracy',
    name: t('high_pressure_accuracy'),
    icon: '🔥',
    description: t('high_pressure_accuracy_desc')
  },
  {
    key: 'avgBetAccuracyScore',
    name: t('bet_accuracy_score'),
    icon: '📊',
    description: t('bet_accuracy_score_desc')
  }
];

export default function LeaderboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  
  const [selectedMetric, setSelectedMetric] = useState('perfectPredictionRate');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const METRICS = getMetrics(t);

  // Fetch leaderboard data
  const fetchLeaderboard = async (metric: string, refresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        metric,
        limit: '50',
        format: 'comprehensive',
        refresh: refresh ? 'true' : 'false'
      });

      const response = await fetch(`/api/leaderboard-live?${params}`);
      const data = await response.json();

      if (data.status === 'success') {
        setLeaderboardData(data.leaderboard);
        setLastRefresh(new Date());
      } else {
        setError(data.error || t('error_loading_leaderboard'));
      }
    } catch (err) {
      setError(t('error_loading_leaderboard'));
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and metric changes
  useEffect(() => {
    fetchLeaderboard(selectedMetric);
  }, [selectedMetric]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLeaderboard(selectedMetric);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedMetric, autoRefresh]);

  // Manual refresh
  const handleRefresh = () => {
    fetchLeaderboard(selectedMetric, true);
  };

  // Handle back navigation - always go to home
  const handleBack = () => {
    router.push('/');
  };

  // Get current metric info
  const currentMetricInfo = METRICS.find(m => m.key === selectedMetric);

  // Get user's rank in current leaderboard
  const userRank = user && leaderboardData?.rankings ? 
    leaderboardData.rankings.find(entry => entry.username === (user.firstName || user.username))?.rank : null;

  // CSS variables for consistent theming
  const primaryColor = '#ff8400';
  const primaryHover = '#e67a00';
  const bgPrimary = isDarkMode ? '#1a1a1a' : '#ffffff';
  const bgSecondary = isDarkMode ? '#2d2d2d' : '#f8f9fa';
  const textPrimary = isDarkMode ? '#ffffff' : '#000000';
  const textSecondary = isDarkMode ? '#cccccc' : '#666666';
  const borderColor = isDarkMode ? '#444444' : '#e9ecef';
  const shadow = isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)';

  const containerStyle: React.CSSProperties = {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '1.125rem',
    minHeight: '100vh',
    backgroundColor: bgPrimary,
    color: textPrimary,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: bgSecondary,
    borderRadius: '6px',
    border: `1px solid ${borderColor}`,
    boxShadow: `0 1.5px 6px ${shadow}`,
    transition: 'all 0.3s ease',
    width: '100%',
    maxWidth: '100%'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 'bold',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: textPrimary
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.375rem 0.75rem',
    borderRadius: '3px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '500',
    transition: 'all 0.3s ease',
    margin: '0.375rem'
  };

  const statsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    fontSize: '0.675rem',
    flexWrap: 'wrap'
  };

  const sectionStyle: React.CSSProperties = {
    backgroundColor: bgSecondary,
    padding: '1rem',
    borderRadius: '6px',
    margin: '0.5rem 0',
    border: `1px solid ${borderColor}`,
    boxShadow: `0 1.5px 6px ${shadow}`,
    transition: 'all 0.3s ease',
    width: '100%',
    maxWidth: '100%'
  };

  return (
    <AuthWrapper>
      <div style={containerStyle}>
        {/* Header with stats - all in one line */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button 
              onClick={handleBack}
              style={{
                ...buttonStyle,
                backgroundColor: 'transparent',
                color: primaryColor,
                border: `1.5px solid ${primaryColor}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 132, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(-0.75px)';
                e.currentTarget.style.boxShadow = '0 3px 9px rgba(255, 132, 0, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              ← {t('back')}
            </button>
            <h1 style={titleStyle}>
              🏆 {t('leaderboard')}
            </h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Stats Display */}
            <div style={statsStyle}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: primaryColor }}>
                  {leaderboardData?.totalPlayers || 0}
                </div>
                <div style={{ color: textSecondary }}>{t('total_players')}</div>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold' }}>
                  {new Date(lastRefresh).toLocaleTimeString()}
                </div>
                <div style={{ color: textSecondary }}>{t('last_updated')}</div>
              </div>
              
              {userRank && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: '#10b981' }}>
                    #{userRank}
                  </div>
                  <div style={{ color: textSecondary }}>{t('your_rank')}</div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={loading}
              style={{
                ...buttonStyle,
                backgroundColor: loading ? textSecondary : primaryColor,
                color: '#fff',
                opacity: loading ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = primaryHover;
                  e.currentTarget.style.transform = 'translateY(-0.75px)';
                  e.currentTarget.style.boxShadow = '0 3px 9px rgba(255, 132, 0, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = primaryColor;
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              🔄 {loading ? t('refreshing') : t('refresh')}
            </button>
          </div>
        </div>

        {/* Metric Selector */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '15px', margin: '0 0 15px 0', color: textPrimary }}>{t('select_metric')}</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '10px'
          }}>
            {METRICS.map((metric) => (
              <button
                key={metric.key}
                onClick={() => setSelectedMetric(metric.key)}
                style={{
                  padding: '15px',
                  borderRadius: '6px',
                  border: selectedMetric === metric.key ? 
                    `2px solid ${primaryColor}` : 
                    `1px solid ${borderColor}`,
                  backgroundColor: selectedMetric === metric.key ? 
                    primaryColor : 
                    bgPrimary,
                  color: selectedMetric === metric.key ? '#fff' : textPrimary,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedMetric !== metric.key) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 132, 0, 0.1)';
                    e.currentTarget.style.borderColor = primaryColor;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedMetric !== metric.key) {
                    e.currentTarget.style.backgroundColor = bgPrimary;
                    e.currentTarget.style.borderColor = borderColor;
                    e.currentTarget.style.transform = 'none';
                  }
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{metric.icon}</div>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  {metric.name}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  {metric.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div style={{
            ...sectionStyle,
            backgroundColor: isDarkMode ? '#2d1b1b' : '#fef2f2',
            border: `1px solid ${isDarkMode ? '#7f1d1d' : '#fecaca'}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px 0' }}>{t('error_loading_leaderboard')}</h3>
            <p style={{ margin: '0 0 15px 0', opacity: 0.8 }}>{error}</p>
            <button 
              onClick={() => fetchLeaderboard(selectedMetric)} 
              style={{
                ...buttonStyle,
                backgroundColor: '#dc2626',
                color: '#fff'
              }}
            >
              {t('try_again')}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !leaderboardData && (
          <div style={{
            ...sectionStyle,
            textAlign: 'center',
            padding: '40px'
          }}>
            <div style={{
              width: '30px',
              height: '30px',
              border: `3px solid ${borderColor}`,
              borderTop: `3px solid ${primaryColor}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 15px auto'
            }}></div>
            <p>{t('loading_leaderboard')}</p>
          </div>
        )}

        {/* Leaderboard Table */}
        {leaderboardData && !error && (
          <div style={sectionStyle}>
            {/* Table Header - Hidden on mobile */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 80px 60px 100px',
              gap: '10px',
              padding: '15px',
              backgroundColor: isDarkMode ? '#3a3a3a' : '#e9ecef',
              borderRadius: '6px',
              marginBottom: '10px',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}>
              <div>{t('rank')}</div>
              <div>{t('player')}</div>
              <div>{t('value')}</div>
              <div>{t('games')}</div>
              <div style={{ display: window.innerWidth > 480 ? 'block' : 'none' }}>{t('percentile')}</div>
            </div>
            
            {/* Table Body */}
            <div>
              {leaderboardData.rankings && leaderboardData.rankings.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📊</div>
                  <h3 style={{ margin: '0 0 8px 0' }}>{t('no_data_available')}</h3>
                  <p style={{ margin: 0, opacity: 0.8 }}>{t('no_players_completed_games')}</p>
                </div>
              ) : (
                leaderboardData.rankings?.map((entry, index) => {
                  const isCurrentUser = user && (entry.username === user.firstName || entry.username === user.username);
                  
                  return (
                    <div 
                      key={`${entry.rank}-${entry.username}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '60px 1fr 80px 60px 100px',
                        gap: '10px',
                        padding: '12px 15px',
                        borderBottom: index < (leaderboardData.rankings?.length || 0) - 1 ? `1px solid ${borderColor}` : 'none',
                        backgroundColor: isCurrentUser ? 
                          (isDarkMode ? 'rgba(255, 132, 0, 0.2)' : 'rgba(255, 132, 0, 0.1)') : 
                          'transparent',
                        fontSize: '0.9rem',
                        borderRadius: isCurrentUser ? '3px' : '0',
                        border: isCurrentUser ? `1px solid ${primaryColor}` : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {entry.rank <= 3 && (
                          <span style={{ fontSize: '1rem' }}>
                            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                          </span>
                        )}
                        #{entry.rank}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        {isCurrentUser && (
                          <span style={{
                            backgroundColor: primaryColor,
                            color: '#fff',
                            padding: '1px 6px',
                            borderRadius: '8px',
                            fontSize: '0.6rem',
                            fontWeight: 'bold'
                          }}>
                            {t('you_badge')}
                          </span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.username}
                        </span>
                      </div>
                      
                      <div style={{ fontWeight: 'bold' }}>
                        {parseFloat(entry.value).toFixed(2)}
                        {leaderboardData.metricInfo?.unit && (
                          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            {leaderboardData.metricInfo.unit}
                          </span>
                        )}
                      </div>
                      
                      <div>{entry.gamesPlayed}</div>
                      
                      <div style={{ 
                        display: window.innerWidth > 480 ? 'flex' : 'none',
                        alignItems: 'center', 
                        gap: '6px' 
                      }}>
                        <div style={{
                          width: '50px',
                          height: '6px',
                          backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div 
                            style={{
                              width: `${entry.percentile || 0}%`,
                              height: '100%',
                              backgroundColor: primaryColor,
                              transition: 'width 0.3s'
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.8rem' }}>{entry.percentile || 0}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div style={{
          ...sectionStyle,
          fontSize: '0.8rem',
          opacity: 0.8,
          margin: '0.5rem 0 0 0'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            🎮 {t('only_authenticated_players')}
          </p>
          <p style={{ margin: 0 }}>
            📊 {t('metrics_calculated_automatically')}
          </p>
        </div>

        {/* CSS Animation for loading spinner */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Mobile responsive adjustments */
          @media (max-width: 480px) {
            .leaderboard-table-header div:nth-child(5),
            .leaderboard-table-row div:nth-child(5) {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </AuthWrapper>
  );
} 