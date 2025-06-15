import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import styles from '../styles/HeaderLogo.module.css';

interface HeaderLogoProps {
  className?: string;
}

export default function HeaderLogo({ className = '' }: HeaderLogoProps) {
  const { isDarkMode } = useTheme();

  // Header logo paths for light and dark modes (square format)
  const lightModeHeaderLogo = '/header-logo-light.svg'; // For white background
  const darkModeHeaderLogo = '/header-logo-dark.svg';   // For black background

  return (
    <div className={`${styles.headerLogoContainer} ${className}`}>
      <img
        src={isDarkMode ? darkModeHeaderLogo : lightModeHeaderLogo}
        alt="Fodinha.Club"
        className={styles.headerLogoImage}
      />
    </div>
  );
} 