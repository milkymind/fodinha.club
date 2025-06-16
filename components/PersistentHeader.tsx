import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useGuest } from '../contexts/GuestContext';
import CustomUserMenu from './CustomUserMenu';
import styles from '../styles/PersistentHeader.module.css';

interface PersistentHeaderProps {
  gameId?: string;
  playerId?: number;
}

export default function PersistentHeader({ gameId, playerId }: PersistentHeaderProps) {
  const { isDarkMode } = useTheme();
  const { isGuest } = useGuest();

  // Use the new rectangular logo files
  const lightModeLogo = '/header-logo-light.svg';
  const darkModeLogo = '/header-logo-dark.svg';

  return (
    <header className={styles.persistentHeader}>
      <div className={styles.headerContent}>
        <div className={styles.logoContainer}>
          <img
            src={isDarkMode ? darkModeLogo : lightModeLogo}
            alt="Fodinha.Club"
            className={styles.logoImage}
          />
        </div>
        
        <div className={styles.userMenuContainer}>
          <CustomUserMenu gameId={gameId} playerId={playerId} isGuest={isGuest} hideOnScroll={false} />
        </div>
      </div>
    </header>
  );
} 