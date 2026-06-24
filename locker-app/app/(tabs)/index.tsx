import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uenmzpinlbyonrehimys.supabase.co';
const supabaseKey = 'PASTE_YOUR_ANON_PUBLIC_KEY_HERE';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [lockers, setLockers] = useState([]);

  useEffect(() => {
    fetchLockers();
  }, []);

  async function fetchLockers() {
    const { data, error } = await supabase
      .from('lockers')
      .select('locker_code, is_occupied');
    
    if (data) setLockers(data);
    if (error) console.log("Database error:", error.message);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Smart Locker Status</Text>
      
      {lockers.length === 0 ? (
        <Text style={styles.item}>Loading lockers...</Text>
      ) : (
        <FlatList
          data={lockers}
          keyExtractor={(item) => item.locker_code}
          renderItem={({ item }) => (
            <Text style={styles.item}>
              Locker {item.locker_code}: {item.is_occupied ? '🔴 Occupied' : '🟢 Free'}
            </Text>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 40, backgroundColor: '#f5f5f5' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  item: { fontSize: 18, marginVertical: 8, textAlign: 'center' },
});