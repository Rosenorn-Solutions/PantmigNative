import { useFocusEffect } from '@react-navigation/native';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableButton from '../components/PressableButton';
import { ListingStatus } from './apis/pantmig-api/models/ListingStatus';
import type { RecycleListing } from './apis/pantmig-api/models/RecycleListing';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi } from './services/api';
import { useToast } from './Toast';
import { getListingStatusView } from './utils/status';

export default function MyListingsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecycleListing[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [chatBusy, setChatBusy] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const api = createRecycleListingsApi();
      const items = await api.listingsMy();
      const sorted = [...(items || [])].sort((a, b) => {
        const ca = (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const cb = (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return cb - ca;
      });
      setData(sorted);
    } catch (e) {
      console.error(e);
      show('Kunne ikke hente dine opslag', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (!token) return <Redirect href="/login" />;
  if (user?.role !== 'Donator') return <Redirect href="/" />;

  const cancelListing = async (listing: RecycleListing) => {
    try {
      setBusy(listing.id || null);
      const api = createRecycleListingsApi();
      await api.listingsCancel({ cancelRequest: { listingId: listing.id } });
      show('Opslag annulleret', 'success');
      await load();
    } catch (e) {
      console.error(e);
      show('Kunne ikke annullere opslag', 'error');
    } finally {
      setBusy(null);
    }
  };

  const openChat = async (listing: RecycleListing) => {
    if (!listing.id) return;
    try {
      setChatBusy(listing.id);
      // If no chat session exists, start it
      if (!listing.chatSessionId) {
        const api = createRecycleListingsApi();
        await api.listingsChatStart({ chatStartRequest: { listingId: listing.id } });
        show('Chat startet', 'success');
        // Reload to fetch chatSessionId
        await load();
      }
      router.push({ pathname: '/chat/[listingId]', params: { listingId: String(listing.id) } } as any);
    } catch (e) {
      console.error(e);
      show('Kunne ikke starte chat', 'error');
    } finally {
      setChatBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={data}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={{ padding: 16, textAlign: 'center', color: '#666' }}>Du har ingen opslag.</Text>}
          renderItem={({ item }) => {
            const isFinal = (item.status === ListingStatus.NUMBER_5 || item.status === ListingStatus.NUMBER_6) || item.isActive === false || !!item.completedAt;
            const hasAssigned = !!item.assignedRecyclerUserId;
            return (
              <View style={{ padding: 12, borderWidth: 1, borderColor: '#ddd', marginBottom: 12, borderRadius: 8 }}>
                <Text style={{ fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
                {item.description ? <Text>{item.description}</Text> : null}
                {item.location ? <Text style={{ color: '#666' }}>{item.location}</Text> : null}
                <Text style={{ marginTop: 4, color: getListingStatusView(item).color }}>
                  Status: {getListingStatusView(item).label}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {!item.assignedRecyclerUserId ? (
                    <PressableButton
                      title="Se ansøgere"
                      disabled={isFinal || hasAssigned}
                      onPress={() => {
                        if (isFinal || hasAssigned) return;
                        router.push({ pathname: '/listing-applicants', params: { id: String(item.id) } } as any);
                      }}
                      color="#6b7280"
                      iconName="people-outline"
                    />
                  ) : null}
                  {item.assignedRecyclerUserId ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={chatBusy === item.id || isFinal}
                      onPress={() => openChat(item)}
                      style={({ pressed }) => ({
                        backgroundColor: '#2563eb',
                        opacity: (chatBusy === item.id || isFinal) ? 0.5 : (pressed ? 0.85 : 1),
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center'
                      })}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#fff', fontWeight: '600' }}>{chatBusy === item.id ? 'Åbner…' : 'Chat'}</Text>
                    </Pressable>
                  ) : null}
                  {item.chatSessionId ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isFinal && (item.meetingLatitude == null || item.meetingLongitude == null)}
                      onPress={() => router.push({ pathname: '/meeting-point/[listingId]', params: { listingId: String(item.id), readonly: isFinal ? '1' : '0' } } as any)}
                      style={({ pressed }) => ({
                        backgroundColor: '#050f96ff',
                        opacity: (isFinal && (item.meetingLatitude == null || item.meetingLongitude == null)) ? 0.5 : (pressed ? 0.85 : 1),
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center'
                      })}
                    >
                      <Ionicons name="location-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#fff', fontWeight: '600' }}>
                        {(item.meetingLatitude != null && item.meetingLongitude != null) ? 'Mødested' : 'Sæt mødested'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <PressableButton
                    title={busy === item.id ? 'Annullerer…' : 'Annullér'}
                    color="#dc2626"
                    onPress={() => cancelListing(item)}
                    disabled={busy === item.id || isFinal}
                    iconName="close-circle-outline"
                  />
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
