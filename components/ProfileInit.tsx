import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

export default function ProfileInit() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      // Call API to ensure profile exists
      fetch('/api/ensure-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log('Profile ensured:', data.message);
        } else {
          console.error('Failed to ensure profile:', data.error);
        }
      })
      .catch(error => {
        console.error('Error calling ensure-profile API:', error);
      });
    }
  }, [isLoaded, user]);

  // This component doesn't render anything visible
  return null;
} 