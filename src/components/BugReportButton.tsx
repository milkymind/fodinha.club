import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from '../styles/BugReportButton.module.css';
import BugReportModal from '../../components/BugReportModal';

interface BugReportButtonProps {
  gameId?: string;
  playerId?: number;
}

const BugReportButton: React.FC<BugReportButtonProps> = ({ gameId, playerId }) => {
  const { language } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <button
        onClick={openModal}
        className={styles.bugReportButton}
        title={language === 'en' ? 'Report a Bug' : 'Reportar Bug'}
        aria-label={language === 'en' ? 'Report a Bug' : 'Reportar Bug'}
      >
        <span className={styles.bugIcon}>🐛</span>
        <span className={styles.buttonText}>
          {language === 'en' ? 'BUG' : 'BUG'}
        </span>
      </button>

      {isModalOpen && (
        <BugReportModal
          gameId={gameId}
          playerId={playerId}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </>
  );
};

export default BugReportButton; 