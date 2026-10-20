import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomerDetailsScreen } from '../../features/customer-details/screens/CustomerDetailsScreen';
import { CustomerEditorScreen } from '../../features/customer-editor/screens/CustomerEditorScreen';
import { CustomerListScreen } from '../../features/customers/screens/CustomerListScreen';
import type { CustomersStackParamList } from './types';

const Stack = createNativeStackNavigator<CustomersStackParamList>();

/** Stack inside the Customers tab: list → details → editor. */
export function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Render-prop form: the list screen takes structural props, which the
          no-params route type won't accept via `component`. */}
      <Stack.Screen name="CustomerList">
        {props => (
          <CustomerListScreen navigation={props.navigation} route={props.route} />
        )}
      </Stack.Screen>
      <Stack.Screen name="CustomerDetails" component={CustomerDetailsScreen} />
      <Stack.Screen name="CustomerEditor" component={CustomerEditorScreen} />
    </Stack.Navigator>
  );
}
