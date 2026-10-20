import { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SearchX, TriangleAlert, Users } from 'lucide-react-native';
import { AppHeader } from '../../../components/common';
import { CustomerCard, SearchBar } from '../../../components/customers';
import { ConfirmationDialog, EmptyState, LoadingIndicator, useToast } from '../../../components/feedback';
import { useStrings } from '../../../core/i18n/i18n';
import { useTheme } from '../../../core/theme/ThemeProvider';
import type { CustomerListScreenProps } from '../../../app/navigation/types';
import type { Customer } from '../../../types/customer';
import { useCustomers } from '../hooks/useCustomers';

export function CustomerListScreen({ navigation }: CustomerListScreenProps) {
  const { theme } = useTheme();
  const s = useStrings();
  const toast = useToast();
  const { colors, spacing } = theme;

  const {
    customers,
    searchQuery,
    loading,
    refreshing,
    error,
    load,
    refresh,
    search,
    remove,
    clearError,
  } = useCustomers();

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reload when the screen gains focus (including first mount) so customers
  // saved in the editor appear immediately on return.
  useFocusEffect(
    useCallback(() => {
      if (searchQuery.trim()) {
        void search(searchQuery);
      } else {
        void load();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]),
  );

  const openDetails = (customer: Customer) => {
    navigation.navigate('CustomerDetails', { customerId: customer.id });
  };

  const openEditor = (customer?: Customer) => {
    navigation.navigate('CustomerEditor', customer ? { customerId: customer.id } : {});
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.showToast(s.customers.deleted);
      setDeleteTarget(null);
    } catch {
      // Error is already in store state; keep the dialog open is noisy,
      // so close it and let the error banner surface the problem.
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<Customer>) => (
    <CustomerCard
      customer={item}
      onPress={() => openDetails(item)}
      onEdit={() => openEditor(item)}
      onDelete={() => setDeleteTarget(item)}
    />
  );

  const listEmpty = () => {
    if (loading) {
      return <LoadingIndicator label={s.common.loading} />;
    }
    if (error) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title={error}
          actionLabel={s.common.retry}
          onAction={() => {
            clearError();
            void load();
          }}
        />
      );
    }
    if (searchQuery.trim()) {
      return <EmptyState icon={SearchX} title={s.customers.noResults} />;
    }
    return (
      <EmptyState
        icon={Users}
        title={s.customers.empty}
        message={s.customers.emptyHint}
        actionLabel={s.customers.add}
        onAction={() => openEditor()}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        variant="brand"
        title={s.customers.title}
        subtitle={`${customers.length}`}
        showBack={false}
      />
      <View style={{ paddingTop: spacing.md }}>
        <SearchBar value={searchQuery} onChangeText={text => void search(text)} />
      </View>
      <FlatList
        data={customers}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={[
          styles.list,
          {
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl * 3,
          },
          customers.length === 0 && styles.listEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            colors={[colors.primaryText]}
            tintColor={colors.primaryText}
          />
        }
      />
      <ConfirmationDialog
        visible={deleteTarget !== null}
        title={s.common.delete}
        message={s.customers.confirmDelete}
        confirmLabel={s.common.delete}
        destructive
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingTop: 4,
  },
  listEmpty: {
    flexGrow: 1,
  },
});
