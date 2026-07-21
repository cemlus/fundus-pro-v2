import { Platform } from 'react-native';

// Android emulator maps 10.0.2.2 to the host machine's loopback interface (localhost)
// iOS simulator maps localhost to the host machine directly
export const API_BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000'
  : 'http://localhost:3000';
