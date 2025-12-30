import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import PressableButton from '../../components/PressableButton';
import type { ApplicantInfo } from '../apis/pantmig-api/models/ApplicantInfo';
import { useAuth } from '../providers/AuthContext';
import { useToast } from '../providers/ToastProvider';
import { authApi, createRecycleListingsApi } from '../services/api';
import { getManyUsersFromCache, getMissingIds, mergeBatchIntoCache, setManyUsersInCache } from '../services/userCache';

export default function ListingApplicantsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = useMemo(() => Number(id), [id]);
  const { token, user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [applicants, setApplicants] = useState<ApplicantInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<Record<string, { userName?: string; rating?: number }>>({});
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token || !listingId) return;
      setLoading(true);
      try {
  const api = createRecycleListingsApi();
  const list = await api.listingsApplicantsGet({ id: listingId });
  setApplicants(list || []);
  } catch (e) {
        console.error(e);
        show('Kunne ikke hente ansøgere', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, listingId]);

  // Helpers for loading user info
  const preloadFromCache = (ids: string[]) => {
    const cached = getManyUsersFromCache(ids);
    if (Object.keys(cached).length) {
      setUserInfo(prev => ({ ...prev, ...cached }));
    }
  };

  const loadBatchUserInfo = async (ids: string[]) => {
    try {
      const res = await authApi.authUsersLookup({ usersLookupRequest: { ids } });
      mergeBatchIntoCache(res?.users);
      if (res?.users) {
        setUserInfo(prev => {
          const next = { ...prev };
          for (const u of res.users || []) {
            if (!u?.id) continue;
            next[u.id] = { ...(next[u.id] || {}), userName: (u as any).userName, rating: (u as any).rating };
          }
          return next;
        });
      }
    } catch (err) {
      console.warn('Kunne ikke hente brugerdata i batch', err);
    }
  };

  const chunkIds = (all: string[], size = 5): string[][] => {
    const res: string[][] = [];
    for (let i = 0; i < all.length; i += size) res.push(all.slice(i, i + size));
    return res;
  };

  const mapSettledUsers = (chunk: string[], results: PromiseSettledResult<any>[]) => {
    const updates: Record<string, { userName?: string; rating?: number }> = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        const info = r.value?.userInformation;
        const id = info?.id ?? chunk[i];
        if (!id) continue;
        updates[id] = {
          ...(updates[id] || {}),
          userName: info?.userName ?? updates[id]?.userName,
          rating: typeof info?.rating === 'number' ? info?.rating : updates[id]?.rating,
        };
      }
    }
    return updates;
  };

  const applyUserUpdates = (updates: Record<string, { userName?: string; rating?: number }>) => {
    if (!Object.keys(updates).length) return;
    setUserInfo(prev => ({ ...prev, ...updates }));
    setManyUsersInCache(updates);
  };

  const loadMissingUsernames = async (ids: string[]) => {
    const toFetch = getMissingIds(ids, { userName: true });
    if (toFetch.length === 0) return;
    const chunks = chunkIds(toFetch, 5);
    for (const chunk of chunks) {
      const results = await Promise.allSettled(chunk.map(id => authApi.authGetUserById({ id })));
      const updates = mapSettledUsers(chunk, results);
      applyUserUpdates(updates);
    }
  };

  // Fetch ratings/usernames from Auth with caching
  useEffect(() => {
    const run = async () => {
      if (!token) return;
      const ids = (applicants || []).map(a => a.id).filter((x): x is string => !!x);
      if (ids.length === 0) return;
      setUsersLoading(true);
      try {
        preloadFromCache(ids);
        await loadBatchUserInfo(ids);
        await loadMissingUsernames(ids);
      } finally {
        setUsersLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, applicants]);

  if (!token) return <Redirect href="/login" />;
  if (user?.role !== 'Donator') return <Redirect href="/" />;

  const selectApplicant = async (recyclerUserId: string) => {
    try {
      setBusy(recyclerUserId);
      const api = createRecycleListingsApi();
    await api.listingsPickupAccept({ acceptRequest: { listingId, recyclerUserId } });
    show('Recycler valgt', 'success');
    // Navigate to my listings to reflect new assigned recycler + enable chat button
    router.replace('/my-listings');
    } catch (e) {
      console.error(e);
      show('Kunne ikke vælge ansøger', 'error');
    } finally {
      setBusy(null);
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
          data={applicants}
          keyExtractor={(item, index) => item.id ?? `applicant-${index}`}
          ListEmptyComponent={<Text style={{ padding: 16, textAlign: 'center', color: '#666' }}>Ingen ansøgere endnu.</Text>}
          renderItem={({ item, index }) => {
            const id = item.id ?? '';
            const info = userInfo[id] || {};
            const name = info.userName || id;
            const rating = info.rating;
            const when = item.appliedAt ? new Date(item.appliedAt).toLocaleString('da-DK') : '';
            const isItemBusy = busy === id;
            let ratingText = 'Ingen rating endnu';
            if (usersLoading && !info.userName) {
              ratingText = 'Henter bruger...';
            } else if (rating != null) {
              ratingText = `Rating: ${rating.toFixed(1)}`;
            }
            return (
              <View style={{ padding: 12, borderWidth: 1, borderColor: '#ddd', marginBottom: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontWeight: '600' }}>{name}</Text>
                  <Text style={{ color: '#666', marginTop: 2 }}>{ratingText}</Text>
                  <Text style={{ color: '#666', marginTop: 2 }}>Ansøgt: {when}</Text>
                </View>
                <PressableButton title={isItemBusy ? 'Vælger…' : 'Vælg'} onPress={() => selectApplicant(id)} disabled={isItemBusy} color="#16a34a" iconName="user-check" />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
