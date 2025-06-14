import React, { useState } from 'react';
import BugReportModal from './BugReportModal';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from '../../styles/HeaderButton.module.css';

interface BugReportButtonProps {
  gameId?: string;
  playerId?: number;
}

export default function BugReportButton({ gameId, playerId }: BugReportButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={styles.headerButton}
        aria-label="Report a bug"
        title="Report a bug"
      >
        <span className={styles.buttonIcon}>🐛</span>
        <span className={styles.buttonText}>Bug</span>
      </button>
      
      {isModalOpen && (
        <BugReportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          gameId={gameId}
          playerId={playerId}
        />
      )}
    </>
  );
} 