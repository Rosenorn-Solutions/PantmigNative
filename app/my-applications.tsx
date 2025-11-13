import { useFocusEffect } from '@react-navigation/native';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import CompletedToggle from '../components/CompletedToggle';
import PressableButton from '../components/PressableButton';
import type { RecycleListing } from './apis/pantmig-api/models/RecycleListing';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi } from './services/api';
import { useToast } from './Toast';
import { isFinalListing as isFinalListingHelper } from './utils/listings';
import { getListingStatusView } from './utils/status';
import { colors, radii } from './utils/theme';

const formatDate = (d?: Date | string | null) => {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch { return ''; }
};

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
        // Non-final first, then final; within each group sort by createdAt desc
        const fa = isFinalListing(a) ? 1 : 0;
        const fb = isFinalListing(b) ? 1 : 0;
        if (fa !== fb) return fa - fb;
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
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          data={visibleData}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={{ padding: 16, textAlign: 'center', color: '#666' }}>Du har ingen ansøgninger.</Text>}
          // eslint-disable-next-line sonarjs/cognitive-complexity
          renderItem={({ item }) => {
            const isFinal = isFinalListing(item);
            const pickupConfirmed = !!item.pickupConfirmedAt;
            return (
              <View style={{ padding: 12, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 12, borderRadius: radii.card, backgroundColor: isFinal ? colors.cardFinalBg : colors.cardBg }}>
                <Text style={{ fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
                {item.description ? <Text>{item.description}</Text> : null}
                {item.location ? <Text style={{ color: '#666' }}>{item.location}</Text> : null}
                <View style={{ marginTop: 6, gap: 2 }}>
                  <Text style={{ color: '#374151' }}>
                    Antal: {(item.items || [])?.reduce((sum: number, it: any) => sum + (it?.quantity || 0), 0)}
                  </Text>
                  {(item.availableFrom || item.availableTo) ? (
                    <Text style={{ color: '#374151' }}>
                      Tilgængelig: {formatDate(item.availableFrom)}{item.availableTo ? ` – ${formatDate(item.availableTo)}` : ''}
                    </Text>
                  ) : null}
                  {/* Pickup time removed */}
                  <MaterialTypeCheckmarks items={item.items as any[] | null | undefined} />
                </View>
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
                  {(((item as any).meetingPointLatitude ?? (item as any).meetingLatitude) != null) && (((item as any).meetingPointLongtitude ?? (item as any).meetingLongitude) != null) ? (
                    <PressableButton
                      title="Mødested"
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
  <CompletedToggle placement="bottom-right" showCompleted={showCompleted} onToggle={() => setShowCompleted(s => !s)} hiddenCount={hiddenCount} />
    </View>
  );
}

type ItemLike = { materialType?: number | null } | null | undefined;
function MaterialTypeCheckmarks({ items }: Readonly<{ items?: ItemLike[] | null }>) {
  const list = items || [];
  const hasPlast = list.some(it => (it?.materialType as number | undefined) === 1);
  const hasGlas = list.some(it => (it?.materialType as number | undefined) === 2);
  const hasCan = list.some(it => (it?.materialType as number | undefined) === 3);
  return (
    <View style={{ marginTop: 2 }}>
      <Text style={{ color: '#374151' }}>Plastikflasker: {hasPlast ? '✅' : '❌'}</Text>
      <Text style={{ color: '#374151' }}>Glasflasker: {hasGlas ? '✅' : '❌'}</Text>
      <Text style={{ color: '#374151' }}>Dåser: {hasCan ? '✅' : '❌'}</Text>
    </View>
  );
}
