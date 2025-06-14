import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useScroll } from '../contexts/ScrollContext';
import styles from '../styles/Logo.module.css';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  hideOnScroll?: boolean;
}

export default function Logo({ size = 'medium', className = '', hideOnScroll = false }: LogoProps) {
  const { isDarkMode } = useTheme();
  const { isScrolledDown } = useScroll();

  // Logo paths for light and dark modes
  const lightModeLogo = '/logo-light.svg'; // For white background
  const darkModeLogo = '/logo-dark.svg';   // For black background

  const sizeClass = {
    small: styles.logoSmall,
    medium: styles.logoMedium,
    large: styles.logoLarge
  }[size];

  const hiddenClass = hideOnScroll && isScrolledDown ? 'hidden' : '';

  return (
    <div 
      className={`${styles.logoContainer} ${sizeClass} ${className} ${hiddenClass}`}
    >
      <img
        src={isDarkMode ? darkModeLogo : lightModeLogo}
        alt="Fodinha.Club"
        className={styles.logoImage}
      />
    </div>
  );
} 