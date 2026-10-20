import { useEffect, useState } from 'react';
import { useLanguage } from '../../core/i18n/i18n';
import { ImportExportScreen } from '../../features/customer-import-export/screens/ImportExportScreen';
import type { CustomerRepositoryLike } from '../../services/import/repository';
import { getCustomerRepository } from '../../database';
import { LoadingIndicator } from '../../components/feedback';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from './types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ImportExport'>;

/** Import/export route: injects the repository (adapted) and localized strings. */
export function ImportExportRoute({ navigation, route }: Props) {
  const { strings } = useLanguage();
  const [repo, setRepo] = useState<CustomerRepositoryLike | null>(null);

  useEffect(() => {
    getCustomerRepository()
      .then(r => {
        // Adapt the real repository to the CustomerRepositoryLike contract.
        const adapted: CustomerRepositoryLike = {
          create: c => r.create(c),
          getAll: () => r.getAll(),
          getById: id => r.getById(id),
          update: async (id, changes) => {
            const existing = await r.getById(id);
            if (!existing) {
              return null;
            }
            return r.update({ ...existing, ...changes, id });
          },
          delete: id => r.delete(id),
        };
        setRepo(adapted);
      })
      .catch(() => setRepo(null));
  }, []);

  if (!repo) {
    return <LoadingIndicator fullScreen />;
  }

  return (
    <ImportExportScreen
      strings={strings}
      repo={repo}
      customerId={route.params?.customerId}
      onClose={() => navigation.goBack()}
    />
  );
}
