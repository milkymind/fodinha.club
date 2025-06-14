import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import styles from '../styles/Logo.module.css';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function Logo({ size = 'medium', className = '' }: LogoProps) {
  const { isDarkMode } = useTheme();

  // Logo paths for light and dark modes
  const lightModeLogo = '/logo-light.svg'; // For white background
  const darkModeLogo = '/logo-dark.svg';   // For black background

  const sizeClass = {
    small: styles.logoSmall,
    medium: styles.logoMedium,
    large: styles.logoLarge
  }[size];

  return (
    <div className={`${styles.logoContainer} ${sizeClass} ${className}`}>
      <img
        src={isDarkMode ? darkModeLogo : lightModeLogo}
        alt="Fodinha.Club"
        className={styles.logoImage}
      />
    </div>
  );
} 