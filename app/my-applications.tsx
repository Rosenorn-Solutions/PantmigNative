import { useFocusEffect } from '@react-navigation/native';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, FlatList, RefreshControl, Text, View } from 'react-native';
import { ListingStatus } from './apis/pantmig-api/models/ListingStatus';
import type { RecycleListing } from './apis/pantmig-api/models/RecycleListing';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi } from './services/api';
import { useToast } from './Toast';
import { getListingStatusView } from './utils/status';

export default function MyApplicationsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecycleListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
          data={data}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={{ padding: 16, textAlign: 'center', color: '#666' }}>Du har ingen ansøgninger.</Text>}
          renderItem={({ item }) => {
            const isFinal = (item.status === ListingStatus.NUMBER_5 || item.status === ListingStatus.NUMBER_6) || item.isActive === false || !!item.completedAt;
            const hasMeetingPoint = item.meetingLatitude != null && item.meetingLongitude != null;
            const pickupConfirmed = !!item.pickupConfirmedAt;
            return (
              <View style={{ padding: 12, borderWidth: 1, borderColor: '#ddd', marginBottom: 12, borderRadius: 8 }}>
                <Text style={{ fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
                {item.description ? <Text>{item.description}</Text> : null}
                {item.location ? <Text style={{ color: '#666' }}>{item.location}</Text> : null}
                <Text style={{ marginTop: 4, color: getListingStatusView(item).color }}>
                  Status: {getListingStatusView(item).label}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {item.chatSessionId ? (
                    <Button
                      title={isFinal ? 'Chat (afsluttet)' : 'Chat'}
                      onPress={() => {
                        if (isFinal) return;
                        router.push({ pathname: '/chat/[listingId]', params: { listingId: String(item.id) } } as any);
                      }}
                      disabled={isFinal}
                      color="#2563eb"
                    />
                  ) : null}
                  {item.meetingLatitude != null && item.meetingLongitude != null ? (
                    <Button
                      title={isFinal ? 'Vis mødested (afsluttet)' : 'Vis mødested'}
                      onPress={() => {
                        if (isFinal) return;
                        router.push({ pathname: '/meeting-point/[listingId]', params: { listingId: String(item.id) } } as any);
                      }}
                      disabled={isFinal}
                      color="#10b981"
                    />
                  ) : null}
                  {hasMeetingPoint && !pickupConfirmed && !isFinal ? (
                    <Button
                      title="Godkend hentning"
                      onPress={async () => {
                        try {
                          const api = createRecycleListingsApi();
                          await api.listingsPickupConfirm({ pickupConfirmRequest: { listingId: item.id! } });
                          show('Hentning godkendt', 'success');
                          await load();
                        } catch (e) {
                          console.error(e);
                          show('Kunne ikke godkende hentning', 'error');
                        }
                      }}
                      color="#f59e0b"
                    />
                  ) : null}
                  {pickupConfirmed && !isFinal ? (
                    <Button
                      title="Færdigør"
                      onPress={() => {
                        router.push({ pathname: '/receipt-upload/[listingId]', params: { listingId: String(item.id) } } as any);
                      }}
                      color="#7c3aed"
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
