import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import PressableButton from '../../components/PressableButton';
import { useAuth } from '../providers/AuthContext';
import { useToast } from '../providers/ToastProvider';
import { createRecycleListingsApi } from '../services/api';
import { geocodeSearch } from '../services/geocoding';
import { buildOverlayPrimaryText, buildOverlaySecondaryText } from '../utils/mapAnchors';
import { getListingStatusView } from '../utils/status';
import { colors, radii } from '../utils/theme';

const DEFAULT_REGION = { latitude: 55.6761, longitude: 12.5683, latitudeDelta: 2.5, longitudeDelta: 2.5 };
const PAGE_SIZE = 50;
const MAP_EDGE_PADDING = { top: 72, right: 72, bottom: 72, left: 72 };
const USER_REGION_DELTA = 0.08;
const SEARCH_RADIUS_METERS = 5000;

type LatLng = { latitude: number; longitude: number };

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  backButton: {
    minWidth: 80,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  mapCard: {
    flex: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    gap: 4,
  },
  overlayPrimary: {
    fontWeight: '600',
    color: '#111827',
  },
  overlaySecondary: {
    color: '#4b5563',
    fontSize: 12,
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 16,
    gap: 8,
  },
  footerInfo: {
    fontSize: 12,
    color: '#4b5563',
  },
  footerWarning: {
    fontSize: 12,
    color: '#b91c1c',
  },
  calloutTitle: {
    fontWeight: '600',
    marginBottom: 4,
    color: '#111827',
  },
  calloutStatus: {
    fontSize: 12,
    marginBottom: 4,
  },
  calloutLocation: {
    fontSize: 12,
    color: '#4b5563',
  },
  calloutItems: {
    fontSize: 12,
    color: '#374151',
  },
});

export default function ListingsMapScreen() {
  const { cityExternalId } = useLocalSearchParams<{ cityExternalId?: string }>();
  const { token, user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<any[]>([]);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [cityCoords, setCityCoords] = useState<LatLng | null>(null);
  const [cityLookupPending, setCityLookupPending] = useState(false);
  const [locationChecking, setLocationChecking] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  // Fetch listings (all active, or by city)
  const anchorForSearch = useMemo<LatLng | null>(() => userLocation ?? cityCoords ?? null, [userLocation, cityCoords]);

  const fetchListings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const api = createRecycleListingsApi();
      let items: any[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext && page <= 5) { // Cap at 5 pages for MVP
        const searchRequest: any = { page, pageSize: PAGE_SIZE, onlyActive: true };
        if (cityExternalId) searchRequest.cityExternalId = String(cityExternalId);
        if (anchorForSearch) {
          searchRequest.latitude = anchorForSearch.latitude;
          searchRequest.longitude = anchorForSearch.longitude;
        }
        const useSearch = Boolean(cityExternalId) || Boolean(anchorForSearch);
        const res = useSearch
          ? await api.listingsSearch({ objectPagedSearchRequest: searchRequest })
          : await api.listingsGetActive({ page, pageSize: PAGE_SIZE });
        const pageItems = (res?.items || []) as any[];
        items = items.concat(pageItems);
        hasNext = typeof res?.hasNext === 'boolean' ? res.hasNext : pageItems.length === PAGE_SIZE;
        page++;
      }
      setListings(items);
    } catch (e) {
      console.error(e);
      show('Kunne ikke hente opslag', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, cityExternalId, anchorForSearch, show]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // Only show listings with coordinates
  const listingsWithCoords = useMemo(() => listings.filter(l =>
    Number.isFinite(l.meetingPointLatitude) && Number.isFinite(l.meetingPointLongtitude)
  ), [listings]);

  const listingCoordinates = useMemo(() => listingsWithCoords.map((l) => ({ latitude: l.meetingPointLatitude, longitude: l.meetingPointLongtitude })), [listingsWithCoords]);

  const anchorSummary = useMemo(() => {
    if (userLocation) {
      return { coords: userLocation, label: 'din position', source: 'gps' as const };
    }
    if (cityCoords) {
      return { coords: cityCoords, label: user?.cityName || 'din by', source: 'city' as const };
    }
    return { coords: { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude }, label: 'Danmark', source: 'default' as const };
  }, [cityCoords, user?.cityName, userLocation]);

  const requestLocation = useCallback(async (notifyOnError = false) => {
    setLocationChecking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!isMountedRef.current) return;
      setLocationStatus(status);
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!isMountedRef.current) return;
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } else {
        if (!isMountedRef.current) return;
        setUserLocation(null);
        if (notifyOnError && status === 'denied') {
          show('Placeringstilladelse er påkrævet for at finde opslag tæt på dig.', 'info');
        }
      }
    } catch (error) {
      console.error(error);
      if (notifyOnError) show('Kunne ikke hente din position', 'error');
    } finally {
      if (isMountedRef.current) {
        setLocationChecking(false);
      }
    }
  }, [show]);

  useEffect(() => { void requestLocation(false); }, [requestLocation]);

  useEffect(() => {
    if (userLocation) {
      setCityLookupPending(false);
      return;
    }
    if (!user?.cityName) {
      setCityCoords(null);
      setCityLookupPending(false);
      return;
    }
    let cancelled = false;
    setCityLookupPending(true);
  const includesCountry = user.cityName.toLowerCase().includes('danmark');
  const query = includesCountry ? user.cityName : `${user.cityName}, Danmark`;
    (async () => {
      try {
        const result = await geocodeSearch(query);
        if (!cancelled && isMountedRef.current) {
          setCityCoords(result ? { latitude: result.lat, longitude: result.lon } : null);
        }
      } catch (error) {
        console.warn('City geocode failed', error);
        if (!cancelled && isMountedRef.current) setCityCoords(null);
      } finally {
        if (!cancelled && isMountedRef.current) setCityLookupPending(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.cityName, userLocation]);

  // Fit map to markers
  useEffect(() => {
    if (!mapRef.current) return;
    if (listingCoordinates.length > 0) {
      const coords = [...listingCoordinates];
      if (userLocation) coords.push(userLocation);
      try {
        mapRef.current.fitToCoordinates(coords, { edgePadding: MAP_EDGE_PADDING, animated: true });
      } catch {}
      return;
    }
    const { coords, source } = anchorSummary;
    if (coords) {
      try {
        mapRef.current.animateToRegion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: source === 'default' ? DEFAULT_REGION.latitudeDelta : USER_REGION_DELTA,
          longitudeDelta: source === 'default' ? DEFAULT_REGION.longitudeDelta : USER_REGION_DELTA,
        }, 350);
      } catch {}
    }
  }, [anchorSummary, listingCoordinates, userLocation]);

  // Apply logic (minimal, mirrors list)
  const apply = async (listing: any) => {
    setApplyingId(listing.id);
    try {
      const api = createRecycleListingsApi();
    const latest = await api.listingsGetById({ id: listing.id });
    const appliedList = Array.isArray((latest as any).appliedForRecyclementUserIdList) ? (latest as any).appliedForRecyclementUserIdList : [];
    const alreadyApplied = appliedList.includes(user?.id || '');
      let errorMsg = '';
      if (latest.isActive === false) errorMsg = 'Opslaget er lukket';
      else if (latest.assignedRecyclerUserId) errorMsg = 'Der er allerede valgt en indsamler';
      else if (alreadyApplied) errorMsg = 'Du har allerede ansøgt';
      if (errorMsg) {
        show(errorMsg, 'error');
        setListings(prev => prev.map(l => l.id === latest.id ? { ...l, ...latest } : l));
        return;
      }
      await api.listingsPickupRequest({ pickupRequest: { listingId: latest.id } });
      show('Ansøgning sendt', 'success');
      if (user?.id) {
        setListings(prev => prev.map(l => {
          const prevApplied = Array.isArray(l.appliedForRecyclementUserIdList) ? l.appliedForRecyclementUserIdList : [];
          return l.id === listing.id ? { ...l, appliedForRecyclementUserIdList: prevApplied.includes(user.id) ? prevApplied : [...prevApplied, user.id] } : l;
        }));
      }
    } catch (e) {
      console.error(e);
      show('Kunne ikke ansøge', 'error');
    } finally {
      setApplyingId(null);
    }
  };

  const getApplyLabel = (item: any) => {
    if (item.createdByUserId === user?.id) return 'Dit opslag';
    if ((item.appliedForRecyclementUserIdList || []).includes(user?.id || '')) return 'Ansøgt';
    if (item.assignedRecyclerUserId) return 'Allerede valgt';
    if (item.isActive === false) return 'Lukket';
    return 'Ansøg';
  };

  const isApplyDisabled = (item: any) => (
    item.createdByUserId === user?.id ||
    (item.appliedForRecyclementUserIdList || []).includes(user?.id || '') ||
    !!item.assignedRecyclerUserId ||
    item.isActive === false
  );

  const anchorSource = anchorSummary.source;
  const locationDenied = locationStatus === 'denied';
  const locationButtonLabel = locationStatus === 'granted' ? 'Opdater position' : 'Brug min position';
  const overlayPrimaryText = useMemo(() => buildOverlayPrimaryText(anchorSource, anchorSummary.label), [anchorSource, anchorSummary.label]);
  const overlaySecondaryText = useMemo(() => buildOverlaySecondaryText(anchorSource), [anchorSource]);
  // material label mapping no longer needed; showing checkmarks per type

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Use default header/back from stack; no custom header here for consistency */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8 }}>Henter opslag…</Text>
          </View>
        ) : (
          <>
            <View style={styles.mapCard}>
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={DEFAULT_REGION}
                showsUserLocation={false}
                showsMyLocationButton={false}
              >
                {anchorSource === 'gps' && userLocation ? (
                  <>
                    <Marker
                      key="user-location"
                      coordinate={userLocation}
                      title="Din position"
                      description="Radius ca. 5 km"
                      pinColor={colors.brandGreen}
                    />
                    <Circle
                      center={userLocation}
                      radius={SEARCH_RADIUS_METERS}
                      strokeColor="rgba(22,163,74,0.35)"
                      fillColor="rgba(22,163,74,0.15)"
                      strokeWidth={1}
                    />
                  </>
                ) : null}
                {anchorSource === 'city' && cityCoords ? (
                  <Marker
                    key="city-anchor"
                    coordinate={cityCoords}
                    title={anchorSummary.label}
                    description="Din registrerede by"
                    pinColor="#2563eb"
                  />
                ) : null}
                {listingsWithCoords.map((l) => {
                  const statusView = getListingStatusView(l);
                  const from = l.availableFrom ? new Date(l.availableFrom) : null;
                  const to = l.availableTo ? new Date(l.availableTo) : null;
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const fmt = (d: Date | null) => d ? `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}` : '';
                  const itemsArr = Array.isArray(l.items) ? l.items : [];
                  const matTypes = itemsArr
                    .map((it: any) => (it?.materialType as number | undefined))
                    .filter((t: any, idx: number, arr: any[]) => t != null && arr.indexOf(t) === idx) as number[];
                  const hasPlast = matTypes.includes(1);
                  const hasGlas = matTypes.includes(2);
                  const hasCan = matTypes.includes(3);
                  return (
                    <Marker
                      key={l.id}
                      coordinate={{ latitude: l.meetingPointLatitude, longitude: l.meetingPointLongtitude }}
                      title={l.title}
                      description={l.location || ''}
                      pinColor="#f97316"
                    >
                      <Callout style={{ minWidth: 200 }}>
                        <Text style={styles.calloutTitle}>{l.title}</Text>
                        <Text style={[styles.calloutStatus, { color: statusView.color }]}>Status: {statusView.label}</Text>
                        {!!from && <Text style={styles.calloutLocation}>Fra: {fmt(from)}</Text>}
                        {!!to && <Text style={styles.calloutLocation}>Til: {fmt(to)}</Text>}
                        <Text style={styles.calloutItems}>Plastikflasker: {hasPlast ? '✅' : '❌'}</Text>
                        <Text style={styles.calloutItems}>Glasflasker: {hasGlas ? '✅' : '❌'}</Text>
                        <Text style={styles.calloutItems}>Dåser: {hasCan ? '✅' : '❌'}</Text>
                        {!!l.location && <Text style={[styles.calloutLocation, { marginTop: 2 }]}>{l.location}</Text>}
                        {user?.role === 'Recycler' && (
                          <PressableButton
                            title={getApplyLabel(l)}
                            onPress={() => apply(l)}
                            disabled={isApplyDisabled(l) || applyingId === l.id}
                            color={colors.brandGreen}
                            iconName="paper-plane"
                            style={{ marginTop: 8, alignSelf: 'flex-start' }}
                          />
                        )}
                      </Callout>
                    </Marker>
                  );
                })}
              </MapView>
              <View style={styles.overlay} pointerEvents="none">
                <Text style={styles.overlayPrimary}>{overlayPrimaryText}</Text>
                <Text style={styles.overlaySecondary}>{overlaySecondaryText}</Text>
                {cityLookupPending && anchorSource !== 'gps' && (
                  <Text style={styles.overlaySecondary}>Finder koordinater for din registrerede by…</Text>
                )}
                {locationDenied && (
                  <Text style={styles.overlaySecondary}>
                    Giv adgang til placering for mere præcise resultater.
                  </Text>
                )}
                {listingsWithCoords.length === 0 && (
                  <Text style={styles.overlaySecondary}>
                    Ingen opslag med koordinater fundet endnu – kortet vises alligevel.
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.footer}>
              <PressableButton
                title={locationChecking ? 'Henter position…' : locationButtonLabel}
                onPress={() => requestLocation(true)}
                disabled={locationChecking}
                iconName="location-crosshairs"
                color="#2563eb"
              />
              {locationChecking && <Text style={styles.footerInfo}>Forsøger at hente din aktuelle position.</Text>}
              {locationDenied && !locationChecking && (
                <Text style={styles.footerWarning}>Tillad placering i indstillinger for at finde nærliggende opslag.</Text>
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
