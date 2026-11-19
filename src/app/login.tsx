import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const {
    loading,
    configurationError,
    sessionError,
    signIn,
    signUp,
    startGuestMode,
  } = useAuth();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setActionError(null);
    setMessage(null);

    if (!username.trim()) {
      setActionError('Enter your username or phone number.');
      return;
    }
    if (password.length < 8) {
      setActionError('Password must be at least 8 characters.');
      return;
    }
    if (isSigningUp && !email.trim()) {
      setActionError('Enter your email address.');
      return;
    }
    if (isSigningUp && password !== confirmPassword) {
      setActionError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSigningUp) {
        const result = await signUp(username, email, password);
        const confirmationMessage = result.emailConfirmationRequired
          ? 'Account created. Confirm your email, then sign in with your username or phone.'
          : 'Account created and signed in.';
        const importMessage = result.pantryImportPending
          ? ' Your existing pantry will be imported to this account.'
          : '';
        const guestImportMessage = result.guestPantryImportPending
          ? ' Your guest pantry will be imported to this account.'
          : '';
        setMessage(`${confirmationMessage}${importMessage}${guestImportMessage}`);
        if (result.pantryImportWarning) setActionError(result.pantryImportWarning);
      } else {
        await signIn(username, password);
      }
    } catch (submitError) {
      setActionError(
        submitError instanceof Error ? submitError.message : 'Authentication failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setIsSigningUp((current) => !current);
    setMessage(null);
    setActionError(null);
    setConfirmPassword('');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.eyebrow}>YOUR KITCHEN, YOUR PLAN</Text>
        <Text style={styles.title}>{isSigningUp ? 'Create account' : 'Welcome back'}</Text>
        <Text style={styles.subtitle}>
          {isSigningUp
            ? 'Create an account to keep your pantry private and synced.'
            : 'Sign in to access your saved pantry.'}
        </Text>

        {configurationError ? (
          <Text style={styles.error}>{configurationError}</Text>
        ) : null}
        {sessionError ? <Text style={styles.error}>{sessionError}</Text> : null}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <Text style={styles.label}>Username or phone number</Text>
        <TextInput
          accessibilityLabel="Username or phone number"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
          placeholder="Your name or phone number"
          placeholderTextColor="#7A6B5E"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />

        {isSigningUp ? (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#7A6B5E"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </>
        ) : null}

        <Text style={styles.label}>Password (minimum 8 characters)</Text>
        <TextInput
          accessibilityLabel="Password"
          autoCapitalize="none"
          editable={!submitting}
          placeholder="Password"
          placeholderTextColor="#7A6B5E"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        {isSigningUp ? (
          <>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              accessibilityLabel="Confirm password"
              autoCapitalize="none"
              editable={!submitting}
              placeholder="Re-enter password"
              placeholderTextColor="#7A6B5E"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
            />
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={submitting || loading || Boolean(configurationError)}
          onPress={submit}
          style={[
            styles.submitButton,
            (submitting || loading || Boolean(configurationError)) && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Please wait…' : isSigningUp ? 'Sign up' : 'Log in'}
          </Text>
        </Pressable>

        {!isSigningUp ? (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={loading || submitting}
              onPress={async () => {
                setActionError(null);
                try {
                  await startGuestMode();
                } catch (guestError) {
                  setActionError(
                    guestError instanceof Error
                      ? guestError.message
                      : 'Could not start guest mode.',
                  );
                }
              }}
              style={[
                styles.guestButton,
                (loading || submitting) && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.guestButtonText}>Continue as guest</Text>
            </Pressable>
            <Text style={styles.guestNote}>Guest pantry data stays on this device.</Text>
          </>
        ) : null}

        <View style={styles.switchRow}>
          <Text style={styles.switchPrompt}>
            {isSigningUp ? 'Already have an account?' : 'Don’t have an account?'}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={switchMode}
            style={styles.switchButton}
          >
            <Text style={styles.switchButtonText}>
              {isSigningUp ? 'Log in' : 'Sign up'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF8F0',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: 22,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  eyebrow: {
    color: '#C45C26',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 8,
    color: '#7A2E0E',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 8,
    color: '#5C4A3A',
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    marginTop: 14,
    marginBottom: 6,
    color: '#5C4A3A',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D8C4B1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#3D2B1F',
    fontSize: 16,
  },
  error: {
    marginTop: 10,
    color: '#9A3412',
    fontSize: 14,
  },
  success: {
    marginTop: 10,
    color: '#2D6A4F',
    fontSize: 14,
  },
  submitButton: {
    minHeight: 52,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#C45C26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    height: 1,
    flex: 1,
    backgroundColor: '#E8D5C4',
  },
  dividerText: {
    color: '#7A6B5E',
    fontSize: 13,
  },
  guestButton: {
    minHeight: 50,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: {
    color: '#2D6A4F',
    fontSize: 16,
    fontWeight: '800',
  },
  guestNote: {
    marginTop: 8,
    color: '#7A6B5E',
    fontSize: 13,
    textAlign: 'center',
  },
  switchRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  switchPrompt: {
    color: '#5C4A3A',
    fontSize: 14,
  },
  switchButton: {
    padding: 6,
  },
  switchButtonText: {
    color: '#2D6A4F',
    fontSize: 14,
    fontWeight: '800',
  },
});
