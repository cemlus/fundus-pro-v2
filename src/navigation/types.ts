import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  PatientDetails: { patientId?: string }; // if editing existing, or empty for new
  Session: { sessionId: string };
  Camera: { sessionId: string };
  ImageReview: { imageId: string };
  Gallery: undefined;
  Settings: undefined;
};

export type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>;
