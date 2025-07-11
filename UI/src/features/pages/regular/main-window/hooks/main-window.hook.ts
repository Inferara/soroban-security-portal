import { useState } from 'react';
import { subscribeEmailCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { showSuccess, showError } from '../../../../../features/dialog-handler/dialog-handler';

export const useMainWindow = () => {
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubscribe = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!email.trim()) {
      showError('Please enter your email address.');
      return;
    }

    if (!validateEmail(email)) {
      showError('Please enter a valid email address.');
      return;
    }

    setIsSubscribing(true);
    try {
      await subscribeEmailCall(email);
      showSuccess('Thank you! You have been successfully subscribed to our updates.');
      setEmail('');
    } catch (error) {
      console.error('Error subscribing:', error);
      showError('Failed to subscribe. Please try again later.');
    } finally {
      setIsSubscribing(false);
    }
  };

  return {
    email,
    setEmail,
    isSubscribing,
    handleSubscribe,
  };
}; 