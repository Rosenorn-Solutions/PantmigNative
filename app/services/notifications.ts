import * as signalR from '@microsoft/signalr';
import { API_BASE } from '../config';
import { authorizedGetJson, authorizedPostJson, ensureFreshAccessToken } from './api';

// Types for notifications
export enum NotificationType {
  RecyclerApplied = 1,
  DonorAccepted = 2,
  ChatMessage = 3,
  MeetingSet = 4,
}

export interface NotificationDto {
  id: number;
  listingId: number;
  type: NotificationType;
  message?: string | null;
  createdAt: string; // ISO
  isRead?: boolean; // present on REST results; not present on push
}

// Build notifications hub URL similarly to chat hub
const hubBase = (API_BASE || process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:5001').replace(/\/$/, '');
const notificationsHubUrl = `${hubBase}/hubs/notifications`;

export function connectNotificationsHub(getAccessToken: () => string | null | undefined, onNotify: (n: NotificationDto) => void) {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(notificationsHubUrl, {
      accessTokenFactory: async () => (await ensureFreshAccessToken()) || getAccessToken() || '',
      transport: signalR.HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Information)
    .build();

  connection.on('Notify', (payload: { id: number; listingId: number; type: number; message?: string | null; createdAt: string; }) => {
    const n: NotificationDto = {
      id: payload.id,
      listingId: payload.listingId,
      type: payload.type as NotificationType,
      message: payload.message ?? null,
      createdAt: payload.createdAt,
      isRead: false,
    };
    onNotify(n);
  });

  async function start(attempt = 0) {
    try { await connection.start(); }
    catch (e: any) {
      const msg = String(e?.message || '');
      // If unauthorized/negotiate failed, try forced refresh once then retry
      if (attempt === 0 && (/401/.test(msg) || /Unauthorized/i.test(msg))) {
        await ensureFreshAccessToken();
        setTimeout(() => start(1), 500);
        return;
      }
      setTimeout(() => start(Math.min(attempt + 1, attempt)), 2000);
    }
  }

  start();
  return connection;
}

// REST helpers
export async function fetchRecentNotifications(take = 50): Promise<NotificationDto[]> {
  const data = await authorizedGetJson(`/notifications/recent?take=${take}`);
  if (!Array.isArray(data)) return [];
  return data.map((d: any) => ({
    id: d.id,
    listingId: d.listingId,
    type: d.type as NotificationType,
    message: d.message ?? null,
    createdAt: d.createdAt,
    isRead: !!d.isRead,
  } as NotificationDto));
}

export async function markNotificationsRead(ids: number[]): Promise<void> {
  await authorizedPostJson(`/notifications/mark-read`, { ids });
}
