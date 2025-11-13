import { useFocusEffect } from '@react-navigation/native';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import PressableButton from '../components/PressableButton';
import { CitiesApi } from './apis/pantmig-api/apis';
import type { CitySearchResult } from './apis/pantmig-api/models/CitySearchResult';
import type { ObjectPagedSearchRequest } from './apis/pantmig-api/models/ObjectPagedSearchRequest';
import type { RecycleListing } from './apis/pantmig-api/models/RecycleListing';
import type { RecycleListingItemResponse } from './apis/pantmig-api/models/RecycleListingItemResponse';
import { RecycleMaterialType } from './apis/pantmig-api/models/RecycleMaterialType';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi, pantmigApiConfig } from './services/api';
import { useToast } from './Toast';
import { getListingStatusView } from './utils/status';
import { colors, radii } from './utils/theme';

export default function ListingsScreen() {
  const { token, user } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecycleListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const loadMoreGuardRef = useRef(false);
  // City filter/search UI state
  const citiesApi = useMemo(() => new CitiesApi(pantmigApiConfig), []);
  const [selectedCityExternalId, setSelectedCityExternalId] = useState<string | null>(user?.cityExternalId ?? null);
  const [cityQuery, setCityQuery] = useState<string>('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextSearchRef = useRef(false);
  const userTypedRef = useRef(false);

  // Initialize default city from user (once)
  useEffect(() => {
    const uext = user?.cityExternalId;
    if (selectedCityExternalId === null && uext) {
      setSelectedCityExternalId(uext);
      // Do not set input value programmatically on mount; keep dropdown closed
      suppressNextSearchRef.current = true;
      userTypedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.cityExternalId]);

  const canUseSearch = useMemo(() => selectedCityExternalId !== null, [selectedCityExternalId]);
  const hasCity = selectedCityExternalId !== null;

  // Recycler should not see listings they've already applied to
  const filterOutApplied = useCallback((items: RecycleListing[]) => {
    if (user?.role !== 'Recycler') return items;
    const uid = user?.id || '';
    return items.filter(l => !((l.appliedForRecyclementUserIdList || []).includes(uid)));
  }, [user?.id, user?.role]);

  const computeHasNext = (res: any, itemsLen: number) => {
    if (typeof res?.hasNext === 'boolean') return res.hasNext as boolean;
    const t = res?.total as number | undefined;
    const p = res?.page as number | undefined;
    const ps = res?.pageSize as number | undefined;
    if (t != null && p != null && ps != null) return (p * ps) < t;
    return itemsLen === pageSize;
  };

  const loadFirstPage = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const api = createRecycleListingsApi();
      const nextPage = 1;
      // Prefer search endpoint when user has a cityId; otherwise fall back to GetActive
      if (canUseSearch) {
        const req: ObjectPagedSearchRequest = { cityExternalId: selectedCityExternalId as string, page: nextPage, pageSize, onlyActive: true } as any;
        const res = await api.listingsSearch({ objectPagedSearchRequest: req });
        const items = filterOutApplied((res?.items || []) as unknown as RecycleListing[]);
        setHasNext(computeHasNext(res, items.length));
        setPage(nextPage);
        setData(items);
      } else {
        const res = await api.listingsGetActive({ page: nextPage, pageSize });
        const items = filterOutApplied((res?.items || []) as unknown as RecycleListing[]);
        setHasNext(computeHasNext(res, items.length));
        setPage(nextPage);
        setData(items);
      }
    } finally {
      setLoading(false);
    }
  }, [token, pageSize, canUseSearch, selectedCityExternalId]);

  // Initial load and refetch when token or selected city changes
  useEffect(() => { void loadFirstPage(); }, [token, canUseSearch, selectedCityExternalId, loadFirstPage]);
  // Refresh on screen focus only; don't depend on page to avoid loops
  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
    }, [loadFirstPage])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFirstPage();
    } finally {
      setRefreshing(false);
    }
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore) return;
    if (!hasNext) return;
    if (loadMoreGuardRef.current) return;
    loadMoreGuardRef.current = true;
    try {
      setLoadingMore(true);
      const next = page + 1;
      // Temporarily advance page for this call; load() will set state appropriately
      const api = createRecycleListingsApi();
      if (canUseSearch) {
        const req: ObjectPagedSearchRequest = { cityExternalId: selectedCityExternalId as string, page: next, pageSize, onlyActive: true } as any;
        const res = await api.listingsSearch({ objectPagedSearchRequest: req });
        const items = filterOutApplied((res?.items || []) as unknown as RecycleListing[]);
        setHasNext(computeHasNext(res, items.length));
        setPage(next);
        setData(prev => [...prev, ...items]);
      } else {
        const res = await api.listingsGetActive({ page: next, pageSize });
        const items = filterOutApplied((res?.items || []) as unknown as RecycleListing[]);
        setHasNext(computeHasNext(res, items.length));
        setPage(next);
        setData(prev => [...prev, ...items]);
      }
    } catch (e) {
      console.error(e);
      show('Kunne ikke hente flere opslag', 'error');
    } finally {
      setLoadingMore(false);
      loadMoreGuardRef.current = false;
    }
  }, [loading, refreshing, loadingMore, hasNext, page, pageSize, canUseSearch, selectedCityExternalId]);

  // Debounced city search
  useEffect(() => {
    const q = (cityQuery || '').trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  if (suppressNextSearchRef.current) { suppressNextSearchRef.current = false; setCityOpen(false); return; }
    // Only search/open when user actually typed in the field
    if (!userTypedRef.current) { return; }
    if (q.length < 2) { setCityResults([]); setCityOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await citiesApi.citiesSearch({ q, take: 8 });
        setCityResults(results || []);
        // Only open after explicit typing, not on initial seed
        setTimeout(() => setCityOpen(true), 50);
      } catch {
        setCityResults([]); setCityOpen(false);
      } finally { /* no-op */ }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityQuery, citiesApi]);

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
      // Recycler should no longer see this listing after applying
      if (user?.role === 'Recycler') {
        setData(prev => prev.filter(l => l.id !== listing.id));
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

  // No pickup time formatting needed

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={data}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={user?.role === 'Recycler' ? (
        <View style={{ marginBottom: 12, position: 'relative', zIndex: 1000, elevation: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <View style={{ position: 'relative', zIndex: 200 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={cityQuery}
                    placeholder={hasCity ? (user?.cityName || 'Valgt by') : 'Alle byer'}
                    onChangeText={(t) => { userTypedRef.current = true; setCityQuery(t); }}
                    onFocus={() => { /* don't auto-open; wait for user typing */ }}
                    onBlur={() => { /* keep open to allow click on suggestions; close on selection instead */ }}
                    onSubmitEditing={() => {
                      if (cityOpen && cityResults.length > 0) {
                        const c = cityResults[0];
                        setSelectedCityExternalId(c.externalId || null);
                        suppressNextSearchRef.current = true;
                        userTypedRef.current = false;
                        setCityQuery(c.name || '');
                        setCityOpen(false);
                        setCityResults([]);
                        setPage(1); setHasNext(true);
                      }
                    }}
                    style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, color: '#111827' }}
                  />
                  <PressableButton
                    title={hasCity ? 'Ryd' : 'Alle byer'}
                    onPress={() => { setSelectedCityExternalId(null); userTypedRef.current = false; setCityQuery(''); setCityResults([]); setCityOpen(false); setPage(1); setHasNext(true); }}
                    color="#6b7280"
                    iconName={hasCity ? 'xmark' : 'globe'}
                  />
                </View>
                {/* Suggestions list */}
                {cityOpen && cityResults.length > 0 ? (
                  <View style={{ position: 'absolute', top: 72, left: 0, right: 0, backgroundColor: 'white', borderWidth: 1, borderColor: '#eee', borderRadius: 8, zIndex: 2000, elevation: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
                    {cityResults.map((c, idx) => (
                      <Pressable
                        key={(c.externalId || c.name || 'city') + '_' + idx}
                        onPress={() => {
                          setSelectedCityExternalId(c.externalId || null);
                          suppressNextSearchRef.current = true; // selecting shouldn't trigger a follow-up search immediately
                          userTypedRef.current = false;
                          setCityQuery(c.name || '');
                          setCityOpen(false);
                          setCityResults([]);
                          setPage(1); setHasNext(true);
                        }}
                        style={{ padding: 10, borderTopWidth: idx === 0 ? 0 : 1, borderColor: '#f3f4f6' }}
                      >
                        <Text>{c.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
            <PressableButton
              title="Kort"
              onPress={() => {
                if (selectedCityExternalId === null) router.push('/listings-map');
                else router.push({ pathname: '/listings-map', params: { cityExternalId: String(selectedCityExternalId) } });
              }}
              color="#2563eb"
              iconName="map"
              style={{ marginLeft: 12, minWidth: 80 }}
            />
          </View>
        </View>
  ) : null}
  ListHeaderComponentStyle={{ zIndex: 1000, elevation: 12 }}
  onEndReachedThreshold={0.2}
  onEndReached={() => { void loadMore(); }}
      ListFooterComponent={loadingMore ? (
        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : null}
      renderItem={({ item }) => (
        <View style={{ padding: 12, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 12, borderRadius: radii.card, justifyContent: 'center', backgroundColor: colors.cardBg }}>
          <Text style={{ fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
          {item.description ? <Text>{item.description}</Text> : null}
          {item.location ? <Text style={{ color: '#666' }}>{item.location}</Text> : null}
          {/* Extra listing meta */}
          <View style={{ marginTop: 6, gap: 2 }}>
            <Text style={{ color: '#374151' }}>
              Antal: {(item.items || [])?.reduce((sum: number, it: RecycleListingItemResponse) => sum + (it?.quantity || 0), 0)}
            </Text>
            {(item.availableFrom || item.availableTo) ? (
              <Text style={{ color: '#374151' }}>
                Tilgængelig: {formatDate(item.availableFrom)}{item.availableTo ? ` – ${formatDate(item.availableTo)}` : ''}
              </Text>
            ) : null}
            {/* Pickup time removed */}
            <MaterialTypeCheckmarks items={item.items} />
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

function MaterialTypeCheckmarks({ items }: Readonly<{ items?: Array<RecycleListingItemResponse> | null }>) {
  const list = items ?? [];
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
