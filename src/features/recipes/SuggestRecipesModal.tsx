import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';
import type { SuggestedRecipe } from './useRecipes';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (recipe: SuggestedRecipe) => Promise<void>;
  onRequestSuggestions: () => Promise<SuggestedRecipe[]>;
}

export function SuggestRecipesModal({ visible, onClose, onSave, onRequestSuggestions }: Props) {
  const insets = useSafeAreaInsets();
  const [suggestions, setSuggestions] = useState<SuggestedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  async function fetchSuggestions() {
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setSavedIndices(new Set());
    setExpandedIndex(null);
    try {
      const results = await onRequestSuggestions();
      setSuggestions(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(recipe: SuggestedRecipe, index: number) {
    setSavingIndex(index);
    try {
      await onSave(recipe);
      setSavedIndices((prev) => new Set([...prev, index]));
    } catch {
      // error handled upstream via mutation
    } finally {
      setSavingIndex(null);
    }
  }

  function handleClose() {
    setSuggestions([]);
    setError(null);
    setIsLoading(false);
    setSavedIndices(new Set());
    setExpandedIndex(null);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
        {/* Header */}
        <View style={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text }}>AI Suggestions</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={{ color: COLORS.primary, fontSize: 16 }}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Initial state — prompt to get suggestions */}
          {!isLoading && suggestions.length === 0 && !error ? (
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>🤖</Text>
              <Text style={{ fontSize: 16, color: COLORS.muted, textAlign: 'center', marginBottom: 32, lineHeight: 24 }}>
                Claude will look at your fridge and suggest 3 recipes you can make right now.
              </Text>
              <TouchableOpacity
                onPress={fetchSuggestions}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Suggest recipes</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Loading */}
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={{ color: COLORS.muted, marginTop: 16, fontSize: 15 }}>
                Analysing your fridge...
              </Text>
            </View>
          ) : null}

          {/* Error */}
          {error ? (
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <Text style={{ color: COLORS.danger, textAlign: 'center', marginBottom: 24, fontSize: 15 }}>
                {error}
              </Text>
              <TouchableOpacity
                onPress={fetchSuggestions}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Suggestions */}
          {suggestions.map((recipe, index) => {
            const isSaved = savedIndices.has(index);
            const isSaving = savingIndex === index;
            const isExpanded = expandedIndex === index;

            return (
              <View
                key={index}
                style={{
                  backgroundColor: COLORS.bg,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: isSaved ? COLORS.success : COLORS.primary,
                }}
              >
                {/* Title row */}
                <TouchableOpacity
                  onPress={() => setExpandedIndex(isExpanded ? null : index)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 }}>
                    {recipe.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: COLORS.muted }}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                <Text style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
                  {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                </Text>

                {isExpanded ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>
                      INGREDIENTS
                    </Text>
                    {recipe.ingredients.map((ing, i) => (
                      <Text key={i} style={{ fontSize: 14, color: COLORS.text, marginBottom: 3 }}>
                        • {ing}
                      </Text>
                    ))}
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>
                        INSTRUCTIONS
                      </Text>
                      {recipe.instructions.split('\n').filter(Boolean).map((step, i) => (
                        <Text key={i} style={{ fontSize: 14, color: COLORS.text, marginBottom: 6, lineHeight: 20 }}>
                          {step}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Save button */}
                <TouchableOpacity
                  onPress={() => handleSave(recipe, index)}
                  disabled={isSaved || isSaving}
                  style={{
                    marginTop: 12,
                    backgroundColor: isSaved ? COLORS.success : COLORS.primary,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                    {isSaved ? '✓ Saved' : isSaving ? 'Saving...' : 'Save recipe'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Try again after suggestions loaded */}
          {suggestions.length > 0 ? (
            <TouchableOpacity onPress={fetchSuggestions} style={{ alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>Get new suggestions</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
