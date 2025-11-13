import type * as signalR from '@microsoft/signalr';
import React, { useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { connectNotificationsHub, fetchRecentNotifications, markNotificationsRead, type NotificationDto, NotificationType } from './services/notifications';
import { notificationsStore } from './services/notificationsStore';

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  const { show } = useToast();
  const connRef = useRef<signalR.HubConnection | null>(null);
  const reconnectRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token) {
      // On logout cleanup
      notificationsStore.reset();
      if (connRef.current) {
        connRef.current.stop();
        connRef.current = null as any;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const hydrate = async () => {
      try {
        const list = await fetchRecentNotifications(50);
        if (!isMounted) return;
        notificationsStore.replaceAll(list);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to load notifications', e);
      }
    };

    const notifyText = (n: NotificationDto) => {
      switch (n.type) {
        case NotificationType.RecyclerApplied: return n.message || 'Ny ansøgning';
        case NotificationType.DonorAccepted: return n.message || 'Du er accepteret';
        case NotificationType.ChatMessage: return n.message || 'Ny chatbesked';
        case NotificationType.MeetingSet: return n.message || 'Mødested sat';
        default: return n.message || 'Ny notifikation';
      }
    };

    const onNotify = (n: NotificationDto) => {
      notificationsStore.add(n);
      show(notifyText(n), 'info');
    };

    const scheduleReconnect = (delayMs: number, connectFn: () => void) => {
      reconnectRef.current = setTimeout(() => connectFn(), delayMs) as any;
    };

    const connect = () => {
      try {
        const c = connectNotificationsHub(() => token, onNotify);
        c.onreconnected?.(() => { void hydrate(); });
        c.onclose?.(() => { if (token) scheduleReconnect(8000, connect); });
        connRef.current = c;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Notifications hub connection failed', e);
        scheduleReconnect(3000, connect);
      }
    };

    void hydrate();
    connect();

    return () => {
      isMounted = false;
      const c = connRef.current; if (c) { c.stop(); connRef.current = null as any; }
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    };
  }, [token]);

  return <>{children}</>;
};

// Convenience action for marking items read with optimistic update
export async function markAllNotificationsRead() {
  const ids = notificationsStore.getState().items.filter(n => !n.isRead).map(n => n.id);
  if (!ids.length) return;
  notificationsStore.markRead(ids);
  try { await markNotificationsRead(ids); } catch { /* ignore, server will reconcile later */ }
}
