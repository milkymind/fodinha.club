import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import styles from '../styles/HeaderButton.module.css';

export default function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={styles.headerButton}
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
    >
      <span className={styles.buttonIcon}>
        {isDarkMode ? '☀️' : '🌙'}
      </span>
      <span className={styles.buttonText}>
        {isDarkMode ? 'Light' : 'Dark'}
      </span>
    </button>
  );
} 