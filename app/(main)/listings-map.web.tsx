import { useLocalSearchParams } from 'expo-router';
import type { Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import PressableButton from '../../components/PressableButton';
import { useAuth } from '../providers/AuthContext';
import { useToast } from '../providers/ToastProvider';
import { createRecycleListingsApi } from '../services/api';
import { geocodeSearch } from '../services/geocoding';
import { buildOverlayPrimaryText, buildOverlaySecondaryText } from '../utils/mapAnchors';
import { getListingStatusView } from '../utils/status';
import { colors, radii } from '../utils/theme';

const DEFAULT_CENTER: [number, number] = [55.6761, 12.5683];
const DEFAULT_ZOOM = 7;
const USER_ZOOM = 12;
const PAGE_SIZE = 50;
const SEARCH_RADIUS_METERS = 5000;

type LatLng = { latitude: number; longitude: number };

// Inject Leaflet CSS on mount
function useLeafletCss() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    return () => { try { link.remove(); } catch {} };
  }, []);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    maxWidth: 900,
    paddingHorizontal: 16,
    paddingBottom: 24,
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
  mapShell: {
    height: 600,
    borderRadius: radii.card,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  overlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    maxWidth: 320,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    gap: 4,
    zIndex: 1000,
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
  popupTitle: {
    fontWeight: '600',
    marginBottom: 4,
    color: '#111827',
  },
  popupText: {
    fontSize: 12,
    color: '#4b5563',
  },
  popupItems: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
  },
  line: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
});

export default function ListingsMapWebScreen() {
  useLeafletCss();
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
  const [locationStatus, setLocationStatus] = useState<'granted' | 'denied' | 'unsupported' | 'insecure' | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
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
      while (hasNext && page <= 5) {
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
  const listingLatLngs = useMemo(() => listingsWithCoords.map((l) => [l.meetingPointLatitude, l.meetingPointLongtitude] as [number, number]), [listingsWithCoords]);

  const anchorSummary = useMemo(() => {
    if (userLocation) {
      return { coords: userLocation, label: 'din position', source: 'gps' as const };
    }
    if (cityCoords) {
      return { coords: cityCoords, label: user?.cityName || 'din by', source: 'city' as const };
    }
    return { coords: { latitude: DEFAULT_CENTER[0], longitude: DEFAULT_CENTER[1] }, label: 'Danmark', source: 'default' as const };
  }, [cityCoords, user?.cityName, userLocation]);

  const userLocationIcon = useMemo(() => L.divIcon({
    className: '',
    html: '<div style="width:20px;height:20px;border-radius:50%;background:#16a34a;border:4px solid rgba(22,163,74,0.25);box-shadow:0 0 8px rgba(22,163,74,0.35);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  }), []);

  const cityAnchorIcon = useMemo(() => L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:4px solid rgba(37,99,235,0.25);"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  }), []);

  const listingIcon = useMemo(() => L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#f97316;border:4px solid rgba(249,115,22,0.25);"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  }), []);

  const handleUnsupported = useCallback((notifyOnError: boolean) => {
    if (!isMountedRef.current) return;
    setLocationStatus('unsupported');
    setUserLocation(null);
    if (notifyOnError) show('Din browser understøtter ikke geolokation.', 'info');
  }, [show]);

  const handleLocationError = useCallback((error: any, notifyOnError: boolean) => {
    if (!isMountedRef.current) return;
    setUserLocation(null);
    const code = typeof error?.code === 'number' ? error.code : null;
    if (code === 1) {
      setLocationStatus('denied');
      if (notifyOnError) show('Placeringstilladelse blev afvist.', 'info');
    } else {
      setLocationStatus('denied');
      if (notifyOnError) show('Kunne ikke hente din position.', 'error');
    }
  }, [show]);

  const requestLocation = useCallback(async (notifyOnError = false) => {
    setLocationChecking(true);
    try {
      // On web, geolocation requires a secure context (HTTPS) or localhost
      if (typeof globalThis !== 'undefined' && (globalThis as any).window) {
        const host = (globalThis as any).window.location?.hostname || '';
        const isLocalhost = host === 'localhost' || host === '127.0.0.1';
        const isSecure = (globalThis as any).isSecureContext === true || (globalThis as any).window.isSecureContext === true;
        if (!isSecure && !isLocalhost) {
          setLocationStatus('insecure');
          if (notifyOnError) show('Geolokation kræver HTTPS eller at du kører på localhost.', 'info');
          return;
        }
      }
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        handleUnsupported(notifyOnError);
        return;
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, (err: any) => {
          reject(new Error(err?.message || 'geolocation error'));
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
      });
      if (!isMountedRef.current) return;
      setLocationStatus('granted');
      setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (error) {
      handleLocationError(error, notifyOnError);
    } finally {
      if (isMountedRef.current) setLocationChecking(false);
    }
  }, [handleLocationError, handleUnsupported]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (listingLatLngs.length > 0) {
      const bounds = L.latLngBounds(listingLatLngs);
      if (userLocation) bounds.extend([userLocation.latitude, userLocation.longitude]);
      map.fitBounds(bounds, { padding: [60, 60] });
      return;
    }
    const { coords, source } = anchorSummary;
    const nextZoom = source === 'default' ? DEFAULT_ZOOM : USER_ZOOM;
    map.setView([coords.latitude, coords.longitude], nextZoom, { animate: true });
  }, [anchorSummary, listingLatLngs, userLocation]);

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
  const locationUnsupported = locationStatus === 'unsupported';
  const locationInsecure = locationStatus === 'insecure';
  const locationButtonLabel = locationStatus === 'granted' ? 'Opdater position' : 'Brug min position';
  const overlayPrimaryText = useMemo(() => buildOverlayPrimaryText(anchorSource, anchorSummary.label), [anchorSource, anchorSummary.label]);
  const overlaySecondaryText = useMemo(() => buildOverlaySecondaryText(anchorSource), [anchorSource]);

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
            <View style={styles.mapShell}>
              <MapContainer
                ref={mapRef}
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap-bidragydere" />
                {anchorSource === 'gps' && userLocation ? (
                  <>
                    <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userLocationIcon}>
                      <Popup>
                        <Text style={styles.popupTitle}>Din position</Text>
                        <Text style={styles.popupText}>Radius ca. 5 km</Text>
                      </Popup>
                    </Marker>
                    <Circle
                      center={[userLocation.latitude, userLocation.longitude]}
                      radius={SEARCH_RADIUS_METERS}
                      pathOptions={{ color: '#16a34a', weight: 1, fillColor: 'rgba(22,163,74,0.15)', fillOpacity: 1 }}
                    />
                  </>
                ) : null}
                {anchorSource === 'city' && cityCoords ? (
                  <Marker position={[cityCoords.latitude, cityCoords.longitude]} icon={cityAnchorIcon}>
                    <Popup>
                      <Text style={styles.popupTitle}>{anchorSummary.label}</Text>
                      <Text style={styles.popupText}>Din registrerede by</Text>
                    </Popup>
                  </Marker>
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
                    <Marker key={l.id} position={[l.meetingPointLatitude, l.meetingPointLongtitude]} icon={listingIcon}>
                      <Popup>
                        <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <View style={styles.line}><Text style={styles.popupTitle}>{l.title}</Text></View>
                          <View style={styles.line}><Text style={[styles.popupText, { color: statusView.color }]}>Status: {statusView.label}</Text></View>
                          {!!from && <View style={styles.line}><Text style={styles.popupText}>Fra: {fmt(from)}</Text></View>}
                          {!!to && <View style={styles.line}><Text style={styles.popupText}>Til: {fmt(to)}</Text></View>}
                          <View style={[styles.line, { marginTop: 4 }]}>
                            <Text style={styles.popupItems}>Plastikflasker: {hasPlast ? '✅' : '❌'}</Text>
                          </View>
                          <View style={styles.line}>
                            <Text style={styles.popupItems}>Glasflasker: {hasGlas ? '✅' : '❌'}</Text>
                          </View>
                          <View style={styles.line}>
                            <Text style={styles.popupItems}>Dåser: {hasCan ? '✅' : '❌'}</Text>
                          </View>
                          {!!l.location && <View style={[styles.line, { marginTop: 4 }]}><Text style={styles.popupText}>{l.location}</Text></View>}
                        </View>
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
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
              <View style={styles.overlay} pointerEvents="none">
                <Text style={styles.overlayPrimary}>{overlayPrimaryText}</Text>
                <Text style={styles.overlaySecondary}>{overlaySecondaryText}</Text>
                {cityLookupPending && anchorSource !== 'gps' && (
                  <Text style={styles.overlaySecondary}>Finder koordinater for din registrerede by…</Text>
                )}
                {locationDenied && (
                  <Text style={styles.overlaySecondary}>Giv adgang til placering i browseren for mere præcise resultater.</Text>
                )}
                {locationUnsupported && (
                  <Text style={styles.overlaySecondary}>Din browser understøtter ikke geolokation.</Text>
                )}
                {locationInsecure && (
                  <Text style={styles.overlaySecondary}>Geolokation kræver HTTPS eller localhost i browseren.</Text>
                )}
                {listingsWithCoords.length === 0 && (
                  <Text style={styles.overlaySecondary}>Ingen opslag med koordinater fundet endnu – kortet vises alligevel.</Text>
                )}
              </View>
            </View>
            <View style={styles.footer}>
              <PressableButton
                title={locationChecking ? 'Henter position…' : locationButtonLabel}
                onPress={() => requestLocation(true)}
                disabled={locationChecking || locationUnsupported || locationInsecure}
                iconName="location-crosshairs"
                color="#2563eb"
              />
              {locationChecking && <Text style={styles.footerInfo}>Forsøger at hente din aktuelle position.</Text>}
              {locationDenied && !locationChecking && (
                <Text style={styles.footerWarning}>Tillad placering i browseren for at finde nærliggende opslag.</Text>
              )}
              {locationUnsupported && (
                <Text style={styles.footerWarning}>Din browser understøtter ikke geolokation.</Text>
              )}
              {locationInsecure && (
                <Text style={styles.footerWarning}>Geolokation virker kun over HTTPS eller localhost.</Text>
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
