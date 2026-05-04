import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, Share, ScrollView, Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/features/auth/useAuth';
import { useAuthStore } from '@/src/store/auth';
import {
  useHouseholdQuery,
  useHouseholdMembers,
  useJoinHousehold,
  useLeaveHousehold,
  useUpdateDietaryRestrictions,
} from '@/src/features/household/useHouseholdSharing';
import { JoinHouseholdModal } from '@/src/features/household/JoinHouseholdModal';
import { COLORS } from '@/src/lib/constants';

const DIETARY_OPTIONS = [
  { slug: 'vegetarian', label: 'Vegetarian' },
  { slug: 'vegan', label: 'Vegan' },
  { slug: 'gluten-free', label: 'Gluten-Free' },
  { slug: 'dairy-free', label: 'Dairy-Free' },
  { slug: 'nut-free', label: 'Nut-Free' },
  { slug: 'kosher', label: 'Kosher' },
  { slug: 'halal', label: 'Halal' },
] as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const user = useAuthStore((s) => s.user);
  const householdId = useAuthStore((s) => s.householdId);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [localRestrictions, setLocalRestrictions] = useState<string[]>([]);

  const { data: household } = useHouseholdQuery(user?.id ?? null);
  const { data: members = [] } = useHouseholdMembers(householdId);
  const joinMutation = useJoinHousehold(user?.id ?? null);
  const leaveMutation = useLeaveHousehold(user?.id ?? null);
  const updateDietaryMutation = useUpdateDietaryRestrictions(householdId, user?.id ?? null);

  useEffect(() => {
    if (household) {
      setLocalRestrictions(household.dietary_restrictions ?? []);
    }
  }, [household?.id]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleCopy() {
    if (!household?.invite_code) return;
    await Clipboard.setStringAsync(household.invite_code);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  }

  async function handleShare() {
    if (!household?.invite_code) return;
    await Share.share({
      message: `Join my household on Leftovers! Enter this code: ${household.invite_code}`,
    });
  }

  function handleLeave() {
    Alert.alert(
      'Leave Household',
      "Your items will stay in the household. You'll get a new personal household.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
      ]
    );
  }

  async function handleJoin(code: string) {
    await joinMutation.mutateAsync(code);
  }

  async function handleDietaryToggle(slug: string, value: boolean) {
    const prev = localRestrictions;
    const next = value
      ? [...localRestrictions, slug]
      : localRestrictions.filter((r) => r !== slug);
    setLocalRestrictions(next);
    try {
      await updateDietaryMutation.mutateAsync(next);
    } catch {
      setLocalRestrictions(prev);
      Alert.alert('Failed to save', 'Could not update dietary preferences. Try again.');
    }
  }

  const sectionLabel = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.muted,
    marginBottom: 12,
    marginTop: 28,
  };

  const row = {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 24,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>
        Settings
      </Text>
      {user?.email ? (
        <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 4 }}>
          {user.email}
        </Text>
      ) : null}

      {/* ── Household Section ─────────────────────── */}
      <Text style={sectionLabel}>HOUSEHOLD</Text>

      {household ? (
        <>
          <View style={row}>
            <Text style={{ fontSize: 15, color: COLORS.muted }}>Household</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>
              {household.name}
            </Text>
          </View>

          <View style={[row, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={{ fontSize: 15, color: COLORS.muted, marginBottom: 12 }}>Invite Code</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, letterSpacing: 3, flex: 1 }}>
                {household.invite_code}
              </Text>
              <TouchableOpacity
                onPress={handleCopy}
                style={{
                  backgroundColor: copiedFeedback ? COLORS.success : COLORS.primary,
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {copiedFeedback ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                style={{
                  backgroundColor: COLORS.border,
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600' }}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {members.length > 0 ? (
            <View style={[row, { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <Text style={{ fontSize: 15, color: COLORS.muted, marginBottom: 8 }}>Members</Text>
              {members.map((member) => (
                <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, color: COLORS.text }}>
                    {member.display_name ?? 'Unknown'}
                  </Text>
                  {member.id === user?.id ? (
                    <Text style={{ fontSize: 12, color: COLORS.muted, marginLeft: 6 }}>(you)</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleLeave}
            disabled={leaveMutation.isPending}
            style={{
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: COLORS.danger,
              opacity: leaveMutation.isPending ? 0.6 : 1,
              marginTop: 4,
              marginBottom: 8,
            }}
          >
            {leaveMutation.isPending ? (
              <ActivityIndicator color={COLORS.danger} />
            ) : (
              <Text style={{ color: COLORS.danger, fontSize: 16, fontWeight: '600' }}>
                Leave Household
              </Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator color={COLORS.primary} style={{ alignSelf: 'flex-start', marginBottom: 8 }} />
      )}

      <TouchableOpacity
        onPress={() => setShowJoinModal(true)}
        style={row}
      >
        <Text style={{ fontSize: 15, color: COLORS.text }}>Join a Household</Text>
        <Text style={{ fontSize: 18, color: COLORS.primary }}>›</Text>
      </TouchableOpacity>

      {/* ── Dietary Preferences Section ───────────── */}
      <Text style={sectionLabel}>DIETARY PREFERENCES</Text>

      <Text style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>
        Used by AI for recipe suggestions and shopping recommendations.
      </Text>

      <View style={{
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        {DIETARY_OPTIONS.map((option, index) => (
          <View
            key={option.slug}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: index < DIETARY_OPTIONS.length - 1 ? 1 : 0,
              borderBottomColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: 15, color: COLORS.text }}>{option.label}</Text>
            <Switch
              value={localRestrictions.includes(option.slug)}
              onValueChange={(value) => handleDietaryToggle(option.slug, value)}
              disabled={updateDietaryMutation.isPending || !household}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 12, color: COLORS.muted, textAlign: 'center', marginBottom: 4 }}>
        Changes save automatically.
      </Text>

      {/* ── Auth Section ──────────────────────────── */}
      <Text style={sectionLabel}>ACCOUNT</Text>

      <TouchableOpacity
        onPress={handleSignOut}
        disabled={isSigningOut}
        style={{
          backgroundColor: COLORS.danger,
          borderRadius: 12,
          padding: 16,
          alignItems: 'center',
          opacity: isSigningOut ? 0.7 : 1,
        }}
      >
        {isSigningOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Sign Out</Text>
        )}
      </TouchableOpacity>

      <JoinHouseholdModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoin}
      />
    </ScrollView>
  );
}
