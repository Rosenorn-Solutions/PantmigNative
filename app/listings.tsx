import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi } from './services/api';

export default function ListingsScreen() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        if (token) {
          const api = createRecycleListingsApi();
          const items = await api.listingsGetActive();
          setData(items);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

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

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={{ padding: 12, borderWidth: 1, borderColor: '#ddd', marginBottom: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
          {item.description ? <Text>{item.description}</Text> : null}
          {item.location ? <Text style={{ color: '#666' }}>{item.location}</Text> : null}
        </View>
      )}
    />
  );
}
