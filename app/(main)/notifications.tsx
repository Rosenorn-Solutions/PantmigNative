import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Text, View } from 'react-native';
import PressableButton from '../../components/PressableButton';
import { useAuth } from '../providers/AuthContext';
import { markNotificationsRead } from '../services/notifications';
import { notificationsStore, useNotifications } from '../services/notificationsStore';

export default function NotificationsScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { items, unreadCount } = useNotifications();

  if (!token) return <Redirect href="/login" />;

  const openItem = async (id: number, listingId: number, type: number) => {
    // Navigate based on type; for ChatMessage deep-link to chat
    if (type === 3 /* ChatMessage */) {
      router.push({ pathname: '/chat/[listingId]', params: { listingId: String(listingId) } } as any);
    } else if (type === 4 /* MeetingSet */) {
      router.push({ pathname: '/meeting-point/[listingId]', params: { listingId: String(listingId) } } as any);
    } else {
      // Fallback: donor -> my-listings, recycler -> my-applications
      if (user?.role === 'Recycler') {
        router.push('/my-applications');
      } else {
        router.push('/my-listings');
      }
    }
    notificationsStore.markRead([id]);
    try { await markNotificationsRead([id]); } catch {}
  };

  const markAll = async () => {
    const ids = items.filter(n => !n.isRead).map(n => n.id);
    if (!ids.length) return;
    notificationsStore.markRead(ids);
    try { await markNotificationsRead(ids); } catch {}
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700' }}>Notifikationer</Text>
        <PressableButton title={unreadCount ? `Marker alle læst (${unreadCount})` : 'Alt læst'} onPress={markAll} disabled={!unreadCount} color="#6b7280" iconName="check-double" />
      </View>
      <FlatList
        contentContainerStyle={{ padding: 12 }}
        data={items}
        keyExtractor={i => String(i.id)}
        ListEmptyComponent={<Text style={{ padding: 16, textAlign: 'center', color: '#666' }}>Ingen notifikationer endnu.</Text>}
        renderItem={({ item }) => {
          const when = new Date(item.createdAt).toLocaleString('da-DK');
          // Localize message regardless of server text
          let base = '';
          if (item.type === 1) base = 'En panter har ansøgt på dit opslag.';
          else if (item.type === 2) base = 'Din ansøgning er blevet accepteret.';
          else if (item.type === 3) base = 'Ny chatbesked.';
          else if (item.type === 4) base = 'Mødested er sat.';
          else base = 'Ny notifikation.';
          const title = `${base}  ·  ${when}`;
          return (
            <PressableButton
              title={title}
              onPress={() => openItem(item.id, item.listingId, item.type)}
              color={item.isRead ? '#6b7280' : '#2563eb'}
              iconName={item.isRead ? 'inbox' : 'bell'}
              style={{ marginBottom: 8, alignItems: 'flex-start' }}
            />
          );
        }}
      />
    </View>
  );
}
