import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/src/store/auth';
import { useHousehold } from '@/src/features/fridge/useHousehold';
import {
  useSavedRecipes,
  useSaveRecipe,
  useDeleteRecipe,
  useSuggestRecipes,
  type SuggestedRecipe,
} from '@/src/features/recipes/useRecipes';
import { RecipeCard } from '@/src/features/recipes/RecipeCard';
import { SuggestRecipesModal } from '@/src/features/recipes/SuggestRecipesModal';
import { COLORS } from '@/src/lib/constants';
import { logger } from '@/src/lib/logger';
import type { SavedRecipe } from '@/src/types/database';

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [showSuggestModal, setShowSuggestModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    useHousehold(user.id).then(({ householdId: hid, error }) => {
      if (error) { setHouseholdError(error); return; }
      setHouseholdId(hid);
    });
  }, [user]);

  const { data: recipes, isLoading, isError, error, refetch, isRefetching } = useSavedRecipes(householdId);
  const saveMutation = useSaveRecipe(householdId);
  const deleteMutation = useDeleteRecipe(householdId);
  const suggestMutation = useSuggestRecipes();

  async function handleSave(recipe: SuggestedRecipe) {
    if (!householdId) return;
    await saveMutation.mutateAsync({
      householdId,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
    });
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onError: (err) => logger.error('deleteRecipe failed', err),
    });
  }

  async function handleRequestSuggestions(): Promise<SuggestedRecipe[]> {
    return suggestMutation.mutateAsync();
  }

  function retryHousehold() {
    if (!user) return;
    setHouseholdError(null);
    useHousehold(user.id).then(({ householdId: hid, error }) => {
      if (error) setHouseholdError(error);
      else setHouseholdId(hid);
    });
  }

  const isInitializing = !householdId && !householdError;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: COLORS.text }}>Recipes</Text>
        {householdId ? (
          <TouchableOpacity
            onPress={() => setShowSuggestModal(true)}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>✦ Suggest</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {(isInitializing || isLoading) && !isRefetching ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : householdError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: COLORS.danger, textAlign: 'center', marginBottom: 16 }}>{householdError}</Text>
          <TouchableOpacity onPress={retryHousehold}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : isError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: COLORS.danger, textAlign: 'center', marginBottom: 16 }}>
            {error?.message ?? 'Failed to load recipes'}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<SavedRecipe>
          data={recipes ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 32,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>🍳</Text>
              <Text style={{ fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
                No saved recipes
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 22 }}>
                Tap "✦ Suggest" to get AI recipe ideas{'\n'}based on what's in your fridge
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <RecipeCard recipe={item} onDelete={handleDelete} />
          )}
        />
      )}

      <SuggestRecipesModal
        visible={showSuggestModal}
        onClose={() => setShowSuggestModal(false)}
        onSave={handleSave}
        onRequestSuggestions={handleRequestSuggestions}
      />
    </View>
  );
}
