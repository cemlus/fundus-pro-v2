import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import NetInfo from '@react-native-community/netinfo';
import { UploadService } from './src/services/UploadService';

const App = () => {
  useEffect(() => {
    // Listen for network state changes to flush the offline sync queue
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        console.log('App came online, triggering auto-sync queue...');
        UploadService.retryFailedUploads();
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
};

export default App;
