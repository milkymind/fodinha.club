import React, { createContext, useContext, useState, useEffect } from 'react';

interface ScrollContextType {
  isScrolledDown: boolean;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isClient, setIsClient] = useState(false);

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only run on client side after hydration
    if (!isClient || typeof window === 'undefined') return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Hide when scrolling down past 100px, show when scrolling up or near top
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsScrolledDown(true);
      } else if (currentScrollY < lastScrollY || currentScrollY <= 50) {
        setIsScrolledDown(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isClient]);

  return (
    <ScrollContext.Provider value={{ isScrolledDown: isClient ? isScrolledDown : false }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  const context = useContext(ScrollContext);
  if (context === undefined) {
    // Return a safe default instead of throwing during SSR
    return { isScrolledDown: false };
  }
  return context;
} 