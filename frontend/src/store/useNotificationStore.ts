import { create } from 'zustand';
import type { ToastType } from '../components/ui/Toast';

interface Notification {
  id: string;
  type: ToastType;
  message: string;
}

interface NotificationState {
  notifications: Notification[];
  notify: (message: string, type?: ToastType) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  notify: (message, type = 'info') => {
    set((state) => {
      if (state.notifications.some((n) => n.message === message)) return state;
      const trimmed = state.notifications.length >= 3
        ? state.notifications.slice(1)
        : state.notifications;
      return {
        notifications: [
          ...trimmed,
          { id: Date.now().toString(), type, message },
        ],
      };
    });
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));
