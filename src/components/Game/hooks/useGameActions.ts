import { useCallback, useState } from 'react';

export function useGameActions(gameId: string, playerId: number) {
  const [isSubmittingBet, setIsSubmittingBet] = useState(false);
  const [isPlayingCard, setIsPlayingCard] = useState(false);

  const playCard = useCallback(async (cardIndex: number) => {
    if (isPlayingCard) return;
    
    console.log('Playing card - to be implemented', { gameId, playerId, cardIndex });
    setIsPlayingCard(true);
    
    try {
      // TODO: Implement actual API call
      await new Promise(resolve => setTimeout(resolve, 500)); // Mock delay
    } catch (error) {
      console.error('Error playing card:', error);
      throw error;
    } finally {
      setIsPlayingCard(false);
    }
  }, [gameId, playerId, isPlayingCard]);

  const makeBet = useCallback(async (bet: number) => {
    if (isSubmittingBet) return;
    
    console.log('Making bet - to be implemented', { gameId, playerId, bet });
    setIsSubmittingBet(true);
    
    try {
      // TODO: Implement actual API call
      await new Promise(resolve => setTimeout(resolve, 500)); // Mock delay
    } catch (error) {
      console.error('Error making bet:', error);
      throw error;
    } finally {
      setIsSubmittingBet(false);
    }
  }, [gameId, playerId, isSubmittingBet]);

  const startRound = useCallback(async () => {
    console.log('Starting round - to be implemented', { gameId, playerId });
    // TODO: Implement actual API call
  }, [gameId, playerId]);

  return {
    playCard,
    makeBet,
    startRound,
    isSubmittingBet,
    isPlayingCard,
  };
} 