import React, { createContext, useContext, useState, ReactNode } from 'react';

interface GuestContextType {
  isGuest: boolean;
  setIsGuest: (isGuest: boolean) => void;
  guestName: string;
  setGuestName: (name: string) => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export const useGuest = () => {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
};

interface GuestProviderProps {
  children: ReactNode;
}

export const GuestProvider: React.FC<GuestProviderProps> = ({ children }) => {
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState('Guest');

  return (
    <GuestContext.Provider value={{ isGuest, setIsGuest, guestName, setGuestName }}>
      {children}
    </GuestContext.Provider>
  );
}; 