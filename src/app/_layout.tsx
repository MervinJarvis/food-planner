import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { PantryProvider } from '../context/PantryContext';

function RootNavigator() {
  const { session, guest, loading } = useAuth();
  const hasAppAccess = Boolean(session) || guest;

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Checking your account…</Text>
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Protected guard={!hasAppAccess}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={hasAppAccess}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="results" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PantryProvider>
        <RootNavigator />
      </PantryProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F0',
  },
  loadingText: {
    color: '#5C4A3A',
    fontSize: 15,
  },
});
