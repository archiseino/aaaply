import { useState, useCallback } from 'react';
import type { ToastType } from '../components/ui/Toast';

interface Notification {
  id: string;
  type: ToastType;
  message: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    setNotifications(prev => {
      if (prev.some(n => n.message === message)) return prev;
      const trimmed = prev.length >= 3 ? prev.slice(1) : prev;
      return [...trimmed, { id: Date.now().toString(), type, message }];
    });
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return { notifications, notify, removeNotification };
}
