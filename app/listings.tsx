import { useFocusEffect } from '@react-navigation/native';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import PressableButton from '../components/PressableButton';
import type { RecycleListing } from './apis/pantmig-api/models/RecycleListing';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi } from './services/api';
import { useToast } from './Toast';
import { getListingStatusView } from './utils/status';

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
      const latest = await api.listingsGetById({ id: listing.id! });
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
        setData((prev) => prev.map(l => l.id === listing.id
          ? { ...l, appliedForRecyclementUserIdList: [ ...(l.appliedForRecyclementUserIdList || []), user.id ] }
          : l
        ));
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
      (item.appliedForRecyclementUserIdList || []).includes(user?.id || '') ||
      !!item.assignedRecyclerUserId ||
      item.isActive === false
    );
  };

  const getStatus = (item: RecycleListing) => getListingStatusView(item);

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={data}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <View style={{ padding: 12, borderWidth: 1, borderColor: '#ddd', marginBottom: 12, borderRadius: 8, justifyContent: 'center' }}>
          <Text style={{ fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
          {item.description ? <Text>{item.description}</Text> : null}
          {item.location ? <Text style={{ color: '#666' }}>{item.location}</Text> : null}
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
