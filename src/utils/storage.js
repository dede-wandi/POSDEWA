import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
let SecureStore = null;
try {
  SecureStore = require('expo-secure-store');
} catch (e) {
  SecureStore = null;
}

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
    if (SecureStore && SecureStore.getItemAsync) {
      return await SecureStore.getItemAsync(key);
    }
    return await AsyncStorage.getItem(key);
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
      if (SecureStore && SecureStore.setItemAsync) {
        await SecureStore.setItemAsync(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
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
      if (SecureStore && SecureStore.deleteItemAsync) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      // noop
    }
  }
}
