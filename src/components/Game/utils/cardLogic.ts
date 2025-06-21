import React from 'react';
import styles from '../../../../styles/Game.module.css';

// Card ordering constants - moved from Game.tsx
const ORDEM_CARTAS = {
  '4': 0, '5': 1, '6': 2, '7': 3, 'Q': 4, 'J': 5, 'K': 6, 'A': 7, '2': 8, '3': 9
};

const ORDEM_NAIPE_MANILHA = {'♦': 0, '♠': 1, '♥': 2, '♣': 3};

export function getCardValue(card: string): string {
  return card.substring(0, card.length - 1);
}

export function getCardSuit(card: string): string {
  return card.charAt(card.length - 1);
}

export function getCardStrength(card: string, manilha?: string): number {
  const value = getCardValue(card);
  const suit = getCardSuit(card);
  
  if (manilha && value === manilha) {
    return 100 + (ORDEM_NAIPE_MANILHA[suit as keyof typeof ORDEM_NAIPE_MANILHA] || 0);
  }
  
  return ORDEM_CARTAS[value as keyof typeof ORDEM_CARTAS] || 0;
}

// Get color class based on suit - moved from Game.tsx
export function getCardColorClass(card: string): string {
  if (!card || card.length < 2) return '';
  const naipe = card.charAt(card.length - 1);
  return naipe === '♥' || naipe === '♦' ? styles.redCard : styles.blackCard;
}

// Get suit symbol class - moved from Game.tsx
export function getSuitClass(card: string): string {
  if (!card || card.length < 2) return '';
  const naipe = card.charAt(card.length - 1);
  switch (naipe) {
    case '♣': return styles.clubSuit;
    case '♥': return styles.heartSuit;
    case '♠': return styles.spadeSuit;
    case '♦': return styles.diamondSuit;
    default: return '';
  }
}

// Format card for display - moved from Game.tsx
export function formatCard(card: string): { value: string; suit: string } {
  if (!card || card.length < 2) return { value: '', suit: '' };
  return { 
    value: card.substring(0, card.length - 1),
    suit: card.charAt(card.length - 1)
  };
}

// Card sorting utility for player hands
export function sortCardsByStrength(cards: string[], manilha?: string): string[] {
  return [...cards].sort((a, b) => {
    return getCardStrength(a, manilha) - getCardStrength(b, manilha);
  });
} 