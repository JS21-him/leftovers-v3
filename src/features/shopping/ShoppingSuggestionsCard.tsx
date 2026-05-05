import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS } from '@/src/lib/constants';
import type { Suggestion } from './useShoppingSuggestions';

interface Props {
  suggestions: Suggestion[] | null;
  isLoading: boolean;
  error: string | null;
  onAdd: (name: string) => void;
  onAddAll: (names: string[]) => void;
  onRefresh: () => void;
}

export function ShoppingSuggestionsCard({
  suggestions,
  isLoading,
  error,
  onAdd,
  onAddAll,
  onRefresh,
}: Props) {
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());

  if (!isLoading && !error && (!suggestions || suggestions.length === 0)) return null;

  const unaddedSuggestions = (suggestions ?? []).filter((s) => !addedNames.has(s.name));

  function handleAdd(name: string) {
    onAdd(name);
    setAddedNames((prev) => new Set([...prev, name]));
  }

  function handleAddAll() {
    const names = unaddedSuggestions.map((s) => s.name);
    onAddAll(names);
    setAddedNames(new Set((suggestions ?? []).map((s) => s.name)));
  }

  return (
    <View
      style={{
        backgroundColor: '#fff0e6',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>
            {isLoading
              ? '✦ Finding suggestions…'
              : error
                ? '✦ Suggestions unavailable'
                : `✦ ${suggestions!.length} items to consider`}
          </Text>
          {!isLoading && !error && (
            <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
              Based on your fridge & habits
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={{ fontSize: 12, color: COLORS.muted }}>↻ Refresh</Text>
          </TouchableOpacity>
          {!isLoading && !error && unaddedSuggestions.length > 0 && (
            <TouchableOpacity onPress={handleAddAll}>
              <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600' }}>Add all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={{ fontSize: 14, color: COLORS.muted }}>Finding suggestions…</Text>
        </View>
      )}

      {/* Error state */}
      {error && (
        <TouchableOpacity onPress={onRefresh}>
          <Text style={{ fontSize: 13, color: COLORS.muted }}>{error}</Text>
        </TouchableOpacity>
      )}

      {/* Suggestion rows */}
      {suggestions &&
        suggestions.map((suggestion) => {
          const isAdded = addedNames.has(suggestion.name);
          return (
            <View
              key={suggestion.name}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
                borderTopWidth: 1,
                borderTopColor: '#fed7aa',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, color: COLORS.text, fontWeight: '600' }}>
                  {suggestion.name}
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.muted }}>{suggestion.reason}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { if (!isAdded) handleAdd(suggestion.name); }}
                disabled={isAdded}
                style={{
                  backgroundColor: isAdded ? COLORS.success : COLORS.primary,
                  borderRadius: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {isAdded ? '✓ Added' : '+ Add'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
    </View>
  );
}
