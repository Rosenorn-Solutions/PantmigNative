import { useEffect, useMemo, useState } from 'react';
import type { NotificationDto } from './notifications';

type Listener = () => void;

type StoreState = {
  items: NotificationDto[];
  unreadCount: number;
};

class NotificationsStoreImpl {
  private items: NotificationDto[] = [];
  private readonly seen = new Set<number>();
  private readonly listeners = new Set<Listener>();

  getState(): StoreState {
    return { items: this.items.slice(), unreadCount: this.items.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0) };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() { for (const l of this.listeners) l(); }

  add(n: NotificationDto) {
    if (this.seen.has(n.id)) return;
    this.seen.add(n.id);
    this.items = [n, ...this.items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.emit();
  }

  replaceAll(list: NotificationDto[]) {
    this.items = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.seen.clear();
    for (const n of this.items) this.seen.add(n.id);
    this.emit();
  }

  markRead(ids: number[]) {
    if (!ids?.length) return;
    const idSet = new Set(ids);
    this.items = this.items.map(n => (idSet.has(n.id) ? { ...n, isRead: true } : n));
    this.emit();
  }

  reset() {
    this.items = [];
    this.seen.clear();
    this.emit();
  }
}

export const notificationsStore = new NotificationsStoreImpl();

export function useNotifications() {
  const [{ items, unreadCount }, setState] = useState<StoreState>(() => notificationsStore.getState());
  useEffect(() => {
    const unsub = notificationsStore.subscribe(() => setState(notificationsStore.getState()));
    return () => { unsub(); };
  }, []);
  const unread = useMemo(() => items.filter(n => !n.isRead), [items]);
  return { items, unread, unreadCount };
}
