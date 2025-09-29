import { useFocusEffect } from '@react-navigation/native';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import PressableButton from '../components/PressableButton';
import { ListingStatus } from './apis/pantmig-api/models/ListingStatus';
import type { RecycleListing } from './apis/pantmig-api/models/RecycleListing';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi } from './services/api';
import { useToast } from './Toast';
import { getListingStatusView } from './utils/status';
import { isFinalListing as isFinalListingHelper } from './utils/listings';
import CompletedToggle from '../components/CompletedToggle';

export default function MyApplicationsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecycleListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const isFinalListing = useCallback((l: RecycleListing) => isFinalListingHelper(l), []);

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
      const items = await api.listingsMyApplications();
      const sorted = [...(items || [])].sort((a, b) => {
        const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return cb - ca;
      });
      setData(sorted);
    } catch (e) {
      console.error(e);
      show('Kunne ikke hente dine ansøgninger', 'error');
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
  if (user?.role !== 'Recycler') return <Redirect href="/" />;

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
          ListEmptyComponent={<Text style={{ padding: 16, textAlign: 'center', color: '#666' }}>Du har ingen ansøgninger.</Text>}
          renderItem={({ item }) => {
            const isFinal = isFinalListing(item);
            const hasMeetingPoint = item.meetingLatitude != null && item.meetingLongitude != null;
            const pickupConfirmed = !!item.pickupConfirmedAt;
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
                  {item.chatSessionId ? (
                    <PressableButton
                      title={isFinal ? 'Chat (afsluttet)' : 'Chat'}
                      onPress={() => {
                        if (isFinal) return;
                        router.push({ pathname: '/chat/[listingId]', params: { listingId: String(item.id) } } as any);
                      }}
                      disabled={isFinal}
                      color="#2563eb"
                      iconName="comments"
                    />
                  ) : null}
                  {item.meetingLatitude != null && item.meetingLongitude != null ? (
                    <PressableButton
                      title={isFinal ? 'Vis mødested (afsluttet)' : 'Vis mødested'}
                      onPress={() => {
                        if (isFinal) return;
                        router.push({ pathname: '/meeting-point/[listingId]', params: { listingId: String(item.id) } } as any);
                      }}
                      disabled={isFinal}
                      color="#050f96ff"
                      iconName="location-dot"
                    />
                  ) : null}
                  {pickupConfirmed ? (
                    <PressableButton
                      title="Gem flaskebon"
                      onPress={() => {
                        router.push({ pathname: '/receipt-upload/[listingId]', params: { listingId: String(item.id) } } as any);
                      }}
                      color="#16a34a"
                      iconName="file-lines"
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
