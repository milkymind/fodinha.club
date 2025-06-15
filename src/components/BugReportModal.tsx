import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from '../styles/BugReportModal.module.css';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId?: string;
  playerId?: number;
}

export default function BugReportModal({ isOpen, onClose, gameId, playerId }: BugReportModalProps) {
  const { t } = useLanguage();
  const [bugDescription, setBugDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDescription.trim()) return;

    setIsSubmitting(true);
    
    // Here you would typically send the bug report to your backend
    try {
      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bugDescription: bugDescription,
          gameId,
          playerId,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setBugDescription('');
        setContactInfo('');
        setTimeout(() => {
          setSubmitted(false);
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting bug report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>🐛 {t('report_bug')}</h2>
          <button onClick={onClose} className={styles.closeButton}>✕</button>
        </div>
        
        {submitted ? (
          <div className={styles.successMessage}>
            <h3>✅ {t('bug_report_sent')}</h3>
            <p>{t('bug_report_thanks')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.bugForm}>
            <div className={styles.inputGroup}>
              <label htmlFor="bugDescription">{t('describe_bug')}</label>
              <textarea
                id="bugDescription"
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                placeholder={t('bug_description_placeholder')}
                className={styles.textarea}
                rows={5}
                required
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label htmlFor="contactInfo">{t('contact_info_optional')}</label>
              <input
                type="text"
                id="contactInfo"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder={t('contact_placeholder')}
                className={styles.input}
              />
            </div>
            
            {(gameId || playerId) && (
              <div className={styles.gameInfo}>
                <p><strong>{t('game_info')}:</strong></p>
                {gameId && <p>Game ID: {gameId}</p>}
                {playerId && <p>Player ID: {playerId}</p>}
              </div>
            )}
            
            <div className={styles.buttonGroup}>
              <button 
                type="button" 
                onClick={onClose} 
                className={styles.cancelButton}
                disabled={isSubmitting}
              >
                {t('cancel')}
              </button>
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={!bugDescription.trim() || isSubmitting}
              >
                {isSubmitting ? t('sending') : t('send_report')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 