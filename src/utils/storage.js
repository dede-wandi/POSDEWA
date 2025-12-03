import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

export async function getItemAsync(key) {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    return null;
  }
}

export async function setItemAsync(key, value) {
  if (isWeb) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch (e) {
      // noop
    }
  } else {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      // noop
    }
  }
}

export async function deleteItemAsync(key) {
  if (isWeb) {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch (e) {
      // noop
    }
  } else {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      // noop
    }
  }
}