import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivationRoute } from './ActivationRoute';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

interface RootNavigatorProps {
  initialRouteName?: keyof RootStackParamList;
}

/**
 * App navigation. Native headers are hidden everywhere; each screen renders
 * its own themed AppHeader. The authenticated app is the MainTabs bottom
 * tabs (Customers / Add / Settings).
 */
export function RootNavigator({ initialRouteName = 'Main' }: RootNavigatorProps) {
  return (
    <NavigationContainer>
      <RootStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Activation" component={ActivationRoute} />
        <RootStack.Screen name="Main" component={MainTabs} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
