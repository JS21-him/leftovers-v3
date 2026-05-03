import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { COLORS } from '@/src/lib/constants';
import type { SavedRecipe } from '@/src/types/database';

interface Props {
  recipe: SavedRecipe;
  onDelete: (id: string) => void;
}

export function RecipeCard({ recipe, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const swipeRef = useRef<Swipeable>(null);

  function renderRightActions() {
    return (
      <TouchableOpacity
        onPress={() => {
          swipeRef.current?.close();
          onDelete(recipe.id);
        }}
        style={{
          backgroundColor: COLORS.danger,
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
          borderRadius: 12,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Delete</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderLeftWidth: 4,
          borderLeftColor: COLORS.primary,
        }}
      >
        {/* Header row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 }}>
            {recipe.title}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.muted }}>
            {expanded ? '▲' : '▼'}
          </Text>
        </View>

        <Text style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
          {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
        </Text>

        {expanded ? (
          <View style={{ marginTop: 12 }}>
            {/* Ingredients */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>
              INGREDIENTS
            </Text>
            {recipe.ingredients.map((ing, idx) => (
              <Text key={idx} style={{ fontSize: 14, color: COLORS.text, marginBottom: 3 }}>
                • {ing}
              </Text>
            ))}

            {/* Instructions */}
            {recipe.instructions ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>
                  INSTRUCTIONS
                </Text>
                {recipe.instructions.split('\n').filter(Boolean).map((step, idx) => (
                  <Text key={idx} style={{ fontSize: 14, color: COLORS.text, marginBottom: 6, lineHeight: 20 }}>
                    {step}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    </Swipeable>
  );
}
