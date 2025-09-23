import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, TextInput, View } from 'react-native';
import PressableButton from '../../components/PressableButton';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import { createRecycleListingsApi } from '../services/api';

type MeetingPin = { latitude: number; longitude: number };

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RL = require('react-leaflet');
const { MapContainer, TileLayer, CircleMarker, useMapEvent } = RL;
// Inject Leaflet CSS via CDN to avoid Metro CSS import limitations on web
import ReactNative from 'react-native';
const { useEffect: useEffectRN } = React;
useEffectRN(() => {
  if (typeof document === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  return () => { try { document.head.removeChild(link); } catch {} };
}, []);

function MapClicker({ canEdit, onPick }: { canEdit: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvent('click', (e: any) => {
    if (!canEdit) return;
    const { lat, lng } = e?.latlng || {};
    if (typeof lat === 'number' && typeof lng === 'number') onPick(lat, lng);
  });
  return null;
}

interface SearchBarProps {
  readonly query: string;
  readonly setQuery: (t: string) => void;
  readonly onSearch: () => void;
  readonly searching: boolean;
  readonly canEdit: boolean;
}

function SearchBar(props: SearchBarProps) {
  const { query, setQuery, onSearch, searching, canEdit } = props;
  return (
    <View style={{ flexDirection: 'row', padding: 12, gap: 8, alignItems: 'center' }}>
      <TextInput
        placeholder="Søg adresse eller sted (Danmark)"
        value={query}
        onChangeText={setQuery}
        style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8 }}
        editable={canEdit}
      />
      <PressableButton
        title={searching ? 'Søger…' : 'Søg'}
        onPress={onSearch}
        disabled={!canEdit || searching || !query.trim()}
        color="#6b7280"
        iconName="search-outline"
      />
    </View>
  );
}

function Footer({ pin, canEdit, onSave, saving }: { readonly pin: MeetingPin | null; readonly canEdit: boolean; readonly onSave: () => void; readonly saving: boolean }) {
  return (
    <View style={{ padding: 12, borderTopWidth: 1, borderColor: '#eee', backgroundColor: 'white' }}>
      <Text style={{ marginBottom: 8 }}>Tryk på kortet for at vælge et mødested.</Text>
      {pin ? (
        <Text style={{ marginBottom: 8, fontSize: 12, color: '#555' }}>
          {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
        </Text>
      ) : null}
      {canEdit ? (
        <PressableButton
          title={saving ? 'Gemmer…' : 'Gem mødested'}
          onPress={onSave}
          disabled={!pin || saving}
          color="#10b981"
          iconName="save-outline"
        />
      ) : null}
    </View>
  );
}

interface SuggestionsListProps {
  readonly suggestions: Array<{ display: string; lat: number; lon: number }>;
  readonly canEdit: boolean;
  readonly onPick: (lat: number, lon: number, display: string) => void;
}

function SuggestionsList(props: SuggestionsListProps) {
  const { suggestions, canEdit, onPick } = props;
  if (!canEdit || suggestions.length === 0) return null;
  return (
    <View style={{ marginHorizontal: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
      {suggestions.map((s, idx) => (
        <Text
          key={`${s.lat},${s.lon},${idx}`}
          onPress={() => onPick(s.lat, s.lon, s.display)}
          style={{ padding: 10, borderTopWidth: idx === 0 ? 0 : 1, borderColor: '#f0f0f0' }}
        >
          {s.display}
        </Text>
      ))}
    </View>
  );
}

export default function MeetingPointScreen() {
  const { listingId, readonly } = useLocalSearchParams<{ listingId: string; readonly?: string }>();
  const idNum = Number(listingId);
  const { token, user } = useAuth();
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ display: string; lat: number; lon: number }>>([]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<MeetingPin | null>(null);
  const region = pin ? { ...pin, latitudeDelta: 0.01, longitudeDelta: 0.01 } : { latitude: 55.6761, longitude: 12.5683, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  const [webMapKey, setWebMapKey] = useState(0);
  const [webCenter, setWebCenter] = useState<[number, number]>([region.latitude, region.longitude]);

  const load = useCallback(async () => {
    if (!token || !idNum) return;
    setLoading(true);
    try {
      const api = createRecycleListingsApi();
      const l = await api.listingsGetById({ id: idNum });
      if (l?.meetingLatitude != null && l?.meetingLongitude != null) {
        setPin({ latitude: l.meetingLatitude, longitude: l.meetingLongitude });
      }
    } catch (e) {
      console.error(e);
      show('Kunne ikke hente opslag', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, idNum]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (pin) { setWebCenter([pin.latitude, pin.longitude]); setWebMapKey((k) => k + 1); }
  }, [pin?.latitude, pin?.longitude]);

  const canEdit = user?.role === 'Donator' && readonly !== '1';

  const searchPlace = async () => {
    const q = query.trim();
    if (!q || !canEdit) return;
    try {
      setSearching(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=dk&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'PantmigNative/1.0 (web)' } });
      const arr = await res.json();
      if (Array.isArray(arr) && arr[0]) {
        const lat = parseFloat(arr[0].lat);
        const lon = parseFloat(arr[0].lon);
        if (isFinite(lat) && isFinite(lon)) {
          setWebCenter([lat, lon]);
          setWebMapKey((k) => k + 1);
        }
      } else {
        show('Ingen resultater', 'error');
      }
    } catch (e) {
      console.error(e);
      show('Søgning fejlede', 'error');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!canEdit) { setSuggestions([]); return; }
    const q = query.trim();
    const h = setTimeout(async () => {
      if (q.length < 3) { setSuggestions([]); return; }
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=dk&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'PantmigNative/1.0 (web)' } });
        const arr = await res.json();
        if (Array.isArray(arr)) {
          const mapped = arr.map((r: any) => ({ display: r.display_name as string, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }))
            .filter((x: any) => isFinite(x.lat) && isFinite(x.lon));
          setSuggestions(mapped);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [query, canEdit]);

  const save = async () => {
    if (!pin) return;
    try {
      setSaving(true);
      const api = createRecycleListingsApi();
      await api.listingsMeetingSet({ meetingPointRequest: { listingId: idNum, latitude: pin.latitude, longitude: pin.longitude } });
      show('Mødested gemt', 'success');
      router.back();
    } catch (e) {
      console.error(e);
      show('Kunne ikke gemme mødested', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!token) return <Redirect href="/login" />;
  if (!idNum) return <SafeAreaView><Text>Mangler listingId</Text></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Henter opslag…</Text>
        </View>
      ) : (
        <View style={{ flex: 1, width: '100%', alignSelf: 'center', maxWidth: 900 }}>
          <SearchBar query={query} setQuery={setQuery} onSearch={searchPlace} searching={searching} canEdit={canEdit} />
          <SuggestionsList
            suggestions={suggestions}
            canEdit={canEdit}
            onPick={(lat, lon, display) => {
              setQuery(display);
              setSuggestions([]);
              setWebCenter([lat, lon]);
              setWebMapKey((k) => k + 1);
            }}
          />
          <View style={{ flex: 1, minHeight: 300 }}>
            <MapContainer
              key={webMapKey}
              center={webCenter || [pin?.latitude ?? region.latitude, pin?.longitude ?? region.longitude]}
              zoom={14}
              className="mapFill"
              style={{ height: '100%', width: '100%', cursor: canEdit ? 'crosshair' : 'default' }}
              dragging={!canEdit}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap-bidragydere" />
              <MapClicker canEdit={canEdit} onPick={(lat, lng) => setPin({ latitude: lat, longitude: lng })} />
              {pin ? (
                <CircleMarker center={[pin.latitude, pin.longitude]} radius={10} pathOptions={{ color: '#2563eb' }} />
              ) : null}
            </MapContainer>
          </View>
          <Footer pin={pin} canEdit={canEdit} onSave={save} saving={saving} />
        </View>
      )}
    </SafeAreaView>
  );
}
