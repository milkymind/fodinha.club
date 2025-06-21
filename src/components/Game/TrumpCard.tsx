import React from 'react';

interface TrumpCardProps {
  carta_meio?: string;
  manilha?: string;
}

export const TrumpCard: React.FC<TrumpCardProps> = ({
  carta_meio,
  manilha
}) => {
  return (
    <div>
      <h3>Trump Card - To be implemented</h3>
      <p>Middle card: {carta_meio}</p>
      <p>Manilha: {manilha}</p>
    </div>
  );
}; 