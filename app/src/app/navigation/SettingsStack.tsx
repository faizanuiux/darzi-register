import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ImportExportRoute } from './ImportExportRoute';
import { SettingsRoute } from './SettingsRoute';
import type { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

/** Stack inside the Settings tab: settings → import/export. */
export function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Settings" component={SettingsRoute} />
      <Stack.Screen name="ImportExport" component={ImportExportRoute} />
    </Stack.Navigator>
  );
}
