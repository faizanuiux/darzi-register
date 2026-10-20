import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort crash guard. Any uncaught render error lands here as a readable
 * on-screen message instead of the OS "app keeps stopping" dialog, so the
 * failure can be reported and fixed instead of crashing silently.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              {error.name}: {error.message}
            </Text>
            {!!error.stack && (
              <Text style={styles.stack}>{error.stack}</Text>
            )}
            <Text style={styles.hint}>
              Please send a screenshot of this screen so it can be fixed.
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, paddingTop: 64 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12, color: '#111' },
  message: { fontSize: 15, marginBottom: 12, color: '#333' },
  stack: { fontSize: 11, color: '#666', marginBottom: 16 },
  hint: { fontSize: 13, color: '#888' },
});
