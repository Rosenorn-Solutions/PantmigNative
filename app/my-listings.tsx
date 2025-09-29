import { useFocusEffect } from '@react-navigation/native';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableButton from '../components/PressableButton';
import { ListingStatus } from './apis/pantmig-api/models/ListingStatus';
import type { RecycleListing } from './apis/pantmig-api/models/RecycleListing';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi } from './services/api';
import { useToast } from './Toast';
import { getListingStatusView } from './utils/status';
import { isFinalListing as isFinalListingHelper } from './utils/listings';
import CompletedToggle from '../components/CompletedToggle';

export default function MyListingsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecycleListing[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [chatBusy, setChatBusy] = useState<number | null>(null);
  const [confirmBusy, setConfirmBusy] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const isFinalListing = useCallback((l: RecycleListing) => isFinalListingHelper(l), []);

  // Memoized filtered data MUST be declared at top-level (not inside conditional JSX) to avoid hook order changes
  const visibleData = useMemo(() => {
    if (showCompleted) return data;
    return data.filter(l => !isFinalListing(l));
  }, [data, showCompleted, isFinalListing]);
  const hiddenCount = useMemo(() => data.reduce((acc, l) => acc + (isFinalListing(l) ? 1 : 0), 0), [data, isFinalListing]);

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

  const confirmPickup = (listing: RecycleListing) => {
    if (!listing.id) return;
    Alert.alert(
      'Bekræft afhentning',
      'Er du sikker på at pantet er afhentet? Dette afslutter opslaget.',
      [
        { text: 'Annullér', style: 'cancel' },
        {
          text: 'Ja, færdiggør', style: 'destructive', onPress: async () => {
            try {
              setConfirmBusy(listing.id!);
              const api = createRecycleListingsApi();
              await api.listingsPickupConfirm({ pickupConfirmRequest: { listingId: listing.id } });
              show('Afhentning bekræftet – tak!', 'success');
              await load();
            } catch (e) {
              console.error(e);
              show('Kunne ikke bekræfte afhentning', 'error');
            } finally {
              setConfirmBusy(null);
            }
          }
        }
      ]
    );
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
          data={visibleData}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={{ padding: 16, textAlign: 'center', color: '#666' }}>Ingen opslag at vise.</Text>}
          renderItem={({ item }) => {
            const isFinal = isFinalListing(item);
            const hasAssigned = !!item.assignedRecyclerUserId;
            const canConfirmPickup = !isFinal && !!item.meetingSetAt && !!item.assignedRecyclerUserId && !item.pickupConfirmedAt;
            return (
              <View style={{ padding: 12, borderWidth: 1, borderColor: isFinal ? '#cbd5e1' : '#ddd', marginBottom: 12, borderRadius: 8, backgroundColor: isFinal ? '#f1f5f9' : '#fff', opacity: isFinal ? 0.85 : 1 }}>
                <Text style={{ fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
                {item.description ? <Text>{item.description}</Text> : null}
                {item.location ? <Text style={{ color: '#666' }}>{item.location}</Text> : null}
                <Text style={{ marginTop: 4, color: getListingStatusView(item).color }}>
                  Status: {getListingStatusView(item).label}
                </Text>
                {isFinal ? <Text style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>Afsluttet</Text> : null}
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
                      iconName="user-group"
                    />
                  ) : null}
                  {item.assignedRecyclerUserId ? (
                    <PressableButton
                      title={chatBusy === item.id ? 'Åbner…' : (isFinal ? 'Chat (afsluttet)' : 'Chat')}
                      onPress={() => openChat(item)}
                      disabled={chatBusy === item.id || isFinal}
                      color="#2563eb"
                      iconName="comments"
                    />
                  ) : null}
                  {item.chatSessionId ? (
                    <PressableButton
                      title={(item.meetingLatitude != null && item.meetingLongitude != null) ? 'Mødested' : 'Sæt mødested'}
                      disabled={isFinal}
                      onPress={() => router.push({ pathname: '/meeting-point/[listingId]', params: { listingId: String(item.id), readonly: isFinal ? '1' : '0' } } as any)}
                      color="#050f96ff"
                      iconName="location-dot"
                    />
                  ) : null}
                  {!item.meetingSetAt ? (
                    <PressableButton
                      title={busy === item.id ? 'Annullerer…' : 'Annullér'}
                      color="#dc2626"
                      onPress={() => cancelListing(item)}
                      disabled={busy === item.id || isFinal}
                      iconName="circle-minus"
                    />
                  ) : null}
                  {canConfirmPickup ? (
                    <PressableButton
                      title={confirmBusy === item.id ? 'Bekræfter…' : 'Færdiggør'}
                      color="#16a34a" // green
                      onPress={() => confirmPickup(item)}
                      disabled={confirmBusy === item.id}
                      iconName="check"
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
  <CompletedToggle showCompleted={showCompleted} onToggle={() => setShowCompleted(s => !s)} hiddenCount={hiddenCount} />
    </View>
  );
}
