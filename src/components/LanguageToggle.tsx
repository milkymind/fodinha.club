import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from '../../styles/HeaderButton.module.css';

export default function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className={styles.headerButton}
      aria-label={`Switch to ${language === 'en' ? 'Portuguese' : 'English'}`}
      title={`Switch to ${language === 'en' ? 'Portuguese' : 'English'}`}
    >
      <span className={styles.buttonIcon}>
        {language === 'en' ? '🇧🇷' : '🇺🇸'}
      </span>
      <span className={styles.buttonText}>
        {language === 'en' ? 'PT' : 'EN'}
      </span>
    </button>
  );
} 