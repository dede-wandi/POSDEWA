import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DevSettings } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error?.message, error?.stack);
    console.error('[ErrorBoundary] Component stack:', info?.componentStack);
    this.setState({ error, info });
  }

  handleReload = () => {
    try {
      DevSettings.reload();
    } catch (e) {
      console.warn('Reload failed:', e);
    }
  };

  render() {
    const { error, info } = this.state;
    if (error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Terjadi Kesalahan</Text>
          <Text style={styles.message}>{String(error?.message || 'Unknown error')}</Text>
          {error?.stack ? (
            <Text style={styles.stack} numberOfLines={12}>
              {error.stack}
            </Text>
          ) : null}
          {info?.componentStack ? (
            <Text style={styles.stack} numberOfLines={6}>
              {info.componentStack}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.button} onPress={this.handleReload}>
            <Text style={styles.buttonText}>Muat Ulang Aplikasi</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#d32f2f',
  },
  message: {
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
  },
  stack: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f7f7f7',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#ff1659',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

