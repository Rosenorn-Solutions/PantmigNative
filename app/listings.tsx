import { useFocusEffect } from '@react-navigation/native';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import PressableButton from '../components/PressableButton';
import type { RecycleListing } from './apis/pantmig-api/models/RecycleListing';
import { RecycleMaterialType } from './apis/pantmig-api/models/RecycleMaterialType';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi } from './services/api';
import { useToast } from './Toast';
import { getListingStatusView } from './utils/status';
import { colors, radii } from './utils/theme';

export default function ListingsScreen() {
  const { token, user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecycleListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (token) {
        const api = createRecycleListingsApi();
        const items = await api.listingsGetActive();
        const sorted = [...(items || [])].sort((a, b) => {
          const ca = (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const cb = (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return cb - ca;
        });
        setData(sorted);
      }
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

  // After hooks are declared, it's safe to conditionally redirect
  if (!token) {
    return <Redirect href="/login" />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const apply = async (listing: RecycleListing) => {
    try {
      const api = createRecycleListingsApi();
      // Re-validate latest state before applying
  const latest = await api.listingsGetById({ id: listing.id! }) as unknown as RecycleListing;
  const alreadyApplied = (latest.appliedForRecyclementUserIdList || []).includes(user?.id || '');
      if (latest.isActive === false || latest.assignedRecyclerUserId || alreadyApplied) {
        // sync UI with latest
  setData(prev => prev.map(l => l.id === latest.id ? { ...l, ...latest } : l));
        let msg = 'Kan ikke ansøge';
        if (latest.isActive === false) msg = 'Opslaget er lukket';
        else if (latest.assignedRecyclerUserId) msg = 'Der er allerede valgt en indsamler';
        else if (alreadyApplied) msg = 'Du har allerede ansøgt';
        show(msg, 'error');
        return;
      }
      await api.listingsPickupRequest({ pickupRequest: { listingId: latest.id } });
      show('Ansøgning sendt', 'success');
      // Optimistically add current user id to applied list to disable button
      if (user?.id) {
        setData((prev) => prev.map(l => {
          if (l.id !== listing.id) return l;
          const applied = (l.appliedForRecyclementUserIdList || []);
          return { ...l, appliedForRecyclementUserIdList: applied.includes(user.id) ? applied : [...applied, user.id] } as RecycleListing;
        }));
      }
    } catch (e) {
      console.error(e);
      show('Kunne ikke ansøge', 'error');
    }
  };

  const getApplyLabel = (item: RecycleListing) => {
    if (item.createdByUserId === user?.id) return 'Dit opslag';
    if ((item.appliedForRecyclementUserIdList || []).includes(user?.id || '')) return 'Ansøgt';
    if (item.assignedRecyclerUserId) return 'Allerede valgt';
    if (item.isActive === false) return 'Lukket';
    return 'Ansøg';
  };

  const isApplyDisabled = (item: RecycleListing) => {
    return (
      item.createdByUserId === user?.id ||
  ((item.appliedForRecyclementUserIdList || []).includes(user?.id || '')) ||
      !!item.assignedRecyclerUserId ||
      item.isActive === false
    );
  };

  const getStatus = (item: RecycleListing) => getListingStatusView(item);

  const formatDate = (d?: Date | string | null) => {
    if (!d) return '';
    try {
      const date = typeof d === 'string' ? new Date(d) : d;
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    } catch {
      return '';
    }
  };

  const formatTime = (t?: string | null) => {
    if (!t) return '';
    // Accept HH:mm or HH:mm:ss
    const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(t);
    if (m) {
      const hh = m[1];
      const mm = m[2];
      return `${hh}:${mm}`;
    }
    // Fallback: try Date parsing if it's an ISO or full datetime
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    // Last resort: return as-is
    return t;
  };

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={data}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <View style={{ padding: 12, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 12, borderRadius: radii.card, justifyContent: 'center', backgroundColor: colors.cardBg }}>
          <Text style={{ fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
          {item.description ? <Text>{item.description}</Text> : null}
          {item.location ? <Text style={{ color: '#666' }}>{item.location}</Text> : null}
          {/* Extra listing meta */}
          <View style={{ marginTop: 6, gap: 2 }}>
            <Text style={{ color: '#374151' }}>
              Antal: {(item.items || [])?.reduce((sum: number, it: any) => sum + (it?.quantity || 0), 0)}
            </Text>
            {(item.availableFrom || item.availableTo) ? (
              <Text style={{ color: '#374151' }}>
                Tilgængelig: {formatDate(item.availableFrom)}{item.availableTo ? ` – ${formatDate(item.availableTo)}` : ''}
              </Text>
            ) : null}
            {(item.pickupTimeFrom || item.pickupTimeTo) ? (
              <Text style={{ color: '#374151' }}>
                Afhentningstid: {formatTime(item.pickupTimeFrom)}{item.pickupTimeTo ? ` – ${formatTime(item.pickupTimeTo)}` : ''}
              </Text>
            ) : null}
            <MaterialTypeCheckmarks items={item.items as any[] | null | undefined} />
          </View>
          <Text style={{ marginTop: 4, color: getStatus(item).color }}>Status: {getStatus(item).label}</Text>
          {user?.role === 'Recycler' && (
            <View style={{ marginTop: 8, alignItems: 'center' }}>
              <PressableButton
                title={getApplyLabel(item)}
                onPress={() => apply(item)}
                disabled={isApplyDisabled(item)}
                color="#16a34a"
                iconName="paper-plane"
                style={styles.button}
              />
            </View>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
 
  button: {
    justifyContent: 'center',
    maxWidth: 400,
    width: '100%',
  }
 });

type ItemLike = { materialType?: number | null } | null | undefined;
function MaterialTypeCheckmarks({ items }: Readonly<{ items?: ItemLike[] | null }>) {
  const list = items || [];
  const hasPlast = list.some(it => (it?.materialType as number | undefined) === RecycleMaterialType.NUMBER_1);
  const hasGlas = list.some(it => (it?.materialType as number | undefined) === RecycleMaterialType.NUMBER_2);
  const hasCan = list.some(it => (it?.materialType as number | undefined) === RecycleMaterialType.NUMBER_3);
  return (
    <View style={{ marginTop: 2 }}>
      <Text style={{ color: '#374151' }}>Plastikflasker: {hasPlast ? '✅' : '❌'}</Text>
      <Text style={{ color: '#374151' }}>Glasflasker: {hasGlas ? '✅' : '❌'}</Text>
      <Text style={{ color: '#374151' }}>Dåser: {hasCan ? '✅' : '❌'}</Text>
    </View>
  );
}
