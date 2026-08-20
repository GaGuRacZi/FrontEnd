import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { ScreenLayout } from '@/src/components/layout';
import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

import { formatChatListTime, normalizeChatSearch } from '../chatFormat';
import { useChatStore } from '../ChatStore';
import { ChatSafetyBanner, ParticipantAvatar } from '../components';
import type { ChatMessage, ChatParticipantSnapshot, ChatRoom } from '../types';

function getMessagePreview(message: ChatMessage | null, currentUserId: string, room: ChatRoom) {
  if (!message) return room.lastMessagePreview ?? '아직 대화가 없어요.';
  if (message.kind === 'post') return message.postReference?.title ?? '게시글을 공유했어요.';
  if (message.kind === 'images' && !message.text) {
    const count = message.images?.length ?? 1;
    return `${message.senderId === currentUserId ? '사진을' : '사진이'} ${count}장 ${message.senderId === currentUserId ? '보냈어요.' : '도착했어요.'}`;
  }
  return message.text?.trim() || '메시지가 도착했어요.';
}

function ChatRoomRow({
  currentUserId,
  lastMessage,
  onPress,
  participant,
  room,
  unreadCount,
}: {
  currentUserId: string;
  lastMessage: ChatMessage | null;
  onPress: () => void;
  participant: ChatParticipantSnapshot;
  room: ChatRoom;
  unreadCount: number;
}) {
  const preview = getMessagePreview(lastMessage, currentUserId, room);
  const time = formatChatListTime(lastMessage?.createdAt ?? room.updatedAt);
  return (
    <Pressable
      accessibilityLabel={`${participant.nickname}님과의 채팅${participant.petName ? `, 반려동물 ${participant.petName}` : ''}, ${preview}, ${time}${unreadCount ? `, 읽지 않은 메시지 ${unreadCount}개` : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roomRow, pressed && styles.pressed]}
    >
      <ParticipantAvatar participant={participant} />
      <View style={styles.roomContent}>
        <View style={styles.roomTopLine}>
          <Text numberOfLines={1} style={styles.nickname}>
            {participant.nickname}{participant.petName ? ` · ${participant.petName}` : ''}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <View style={styles.roomBottomLine}>
          <Text numberOfLines={1} style={[styles.preview, unreadCount > 0 && styles.unreadPreview]}>
            {preview}
          </Text>
          {unreadCount > 0 ? (
            <View accessibilityLabel={`읽지 않은 메시지 ${unreadCount}개`} style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ChatListScreen() {
  const router = useRouter();
  const { currentUserId } = useAuthSession();
  const {
    getMessages,
    getOtherParticipant,
    getUnreadCount,
    hasLoadError,
    isReady,
    reloadChat,
    rooms,
    searchQuery,
    setSearchQuery,
  } = useChatStore();
  const [searchOpen, setSearchOpen] = useState(Boolean(searchQuery));
  const [searchText, setSearchText] = useState(searchQuery);
  const [guideVisible, setGuideVisible] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const renderedUserIdRef = useRef(currentUserId);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSearchText = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setSearchText('');
    void setSearchQuery('');
  }, [setSearchQuery]);

  const updateSearchText = useCallback(
    (value: string) => {
      setSearchText(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        searchTimerRef.current = null;
        void setSearchQuery(value);
      }, 250);
    },
    [setSearchQuery],
  );

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!searchTimerRef.current) setSearchText(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (renderedUserIdRef.current === currentUserId) return;
    renderedUserIdRef.current = currentUserId;
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setSearchText(searchQuery);
    setSearchOpen(Boolean(searchQuery));
    setGuideVisible(false);
  }, [currentUserId, searchQuery]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    clearSearchText();
  }, [clearSearchText]);

  const goBack = useCallback(() => {
    if (searchOpen || searchText) {
      closeSearch();
      return;
    }
    router.replace('/community');
  }, [closeSearch, router, searchOpen, searchText]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [goBack]),
  );

  useFocusEffect(
    useCallback(() => {
      reloadChat();
      return undefined;
    }, [reloadChat]),
  );

  useEffect(() => {
    if (isReady) setHasLoadedOnce(true);
  }, [isReady]);

  const roomRows = useMemo(() => {
    if (!currentUserId) return [];
    const query = normalizeChatSearch(searchText);
    if (searchOpen && !query) return [];
    return rooms.flatMap((room) => {
      const participant = getOtherParticipant(room);
      if (!participant) return [];
      const messages = getMessages(room.id);
      const lastMessage = messages.at(-1) ?? null;
      const matches = !query || [
        participant.nickname,
        participant.petName ?? '',
        room.postReference?.title ?? '',
      ].some((value) => normalizeChatSearch(value).includes(query));
      return matches
        ? [{ lastMessage, participant, room, unreadCount: getUnreadCount(room.id) }]
        : [];
    });
  }, [
    currentUserId,
    getMessages,
    getOtherParticipant,
    getUnreadCount,
    rooms,
    searchOpen,
    searchText,
  ]);

  const searchVisible = searchOpen || Boolean(searchText);
  const normalizedSearchQuery = normalizeChatSearch(searchText);

  return (
    <ScreenLayout
      headerFullWidth
      headerVariant="auth"
      leftAccessibilityLabel="커뮤니티로 돌아가기"
      onLeftPress={goBack}
      rightContent={
        <Pressable
          accessibilityLabel={searchVisible ? '채팅방 검색 닫기' : '채팅방 검색'}
          accessibilityRole="button"
          hitSlop={SPACING.md}
          onPress={() => (searchVisible ? closeSearch() : setSearchOpen(true))}
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
        >
          <AppIcon name={searchVisible ? 'close' : 'search-outline'} size={23} />
        </Pressable>
      }
      title="채팅"
    >
      <View style={styles.root}>
        {searchVisible ? (
          <AppInput
            autoFocus={!searchText}
            containerStyle={styles.searchInput}
            leftElement={<AppIcon color={COLORS.gray500} name="search-outline" size={19} />}
            maxLength={100}
            onChangeText={updateSearchText}
            placeholder="닉네임이나 게시글을 검색해보세요"
            rightElement={searchText ? (
              <Pressable
                accessibilityLabel="검색어 지우기"
                accessibilityRole="button"
                hitSlop={SPACING.sm}
                onPress={clearSearchText}
              >
                <AppIcon color={COLORS.gray500} name="close-circle" size={19} />
              </Pressable>
            ) : null}
            size="compact"
            value={searchText}
          />
        ) : null}

        {!isReady && !hasLoadedOnce ? (
          <LoadingView label="채팅을 불러오고 있어요." />
        ) : hasLoadError ? (
          <EmptyState
            actionLabel="다시 시도"
            description="잠시 후 다시 채팅을 열어주세요."
            icon={<AppIcon color={COLORS.primary} name="chatbubbles-outline" size={32} />}
            onActionPress={reloadChat}
            title="채팅을 불러오지 못했어요"
          />
        ) : (
          <FlatList
            ListEmptyComponent={
              <EmptyState
                description={
                  searchVisible && !normalizedSearchQuery
                    ? '상대 닉네임, 반려동물 이름, 게시글 제목으로 찾을 수 있어요.'
                    : normalizedSearchQuery
                      ? '다른 검색어로 다시 찾아보세요.'
                      : '장터 게시글에서 문의하면 대화를 시작할 수 있어요.'
                }
                icon={<AppIcon color={COLORS.primary} name="chatbubbles-outline" size={32} />}
                title={
                  searchVisible && !normalizedSearchQuery
                    ? '검색어를 입력해주세요'
                    : normalizedSearchQuery
                      ? '검색 결과가 없어요'
                      : '아직 채팅이 없어요'
                }
              />
            }
            ListHeaderComponent={searchVisible ? null : (
              <ChatSafetyBanner onGuidePress={() => setGuideVisible(true)} />
            )}
            contentContainerStyle={styles.listContent}
            data={roomRows}
            keyboardShouldPersistTaps="handled"
            keyExtractor={({ room }) => room.id}
            refreshControl={(
              <RefreshControl
                colors={[COLORS.primary]}
                onRefresh={reloadChat}
                refreshing={!isReady && hasLoadedOnce}
                tintColor={COLORS.primary}
              />
            )}
            renderItem={({ item }) => (
              <ChatRoomRow
                currentUserId={currentUserId ?? ''}
                lastMessage={item.lastMessage}
                onPress={() => router.push({
                  pathname: '/chat/[roomId]',
                  params: { roomId: item.room.id },
                })}
                participant={item.participant}
                room={item.room}
                unreadCount={item.unreadCount}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <AppModal
        onClose={() => setGuideVisible(false)}
        primaryAction={{ label: '확인', onPress: () => setGuideVisible(false) }}
        title="안전한 채팅을 위해 확인해주세요"
        variant="center"
        visible={guideVisible}
      >
        <View style={styles.guideContent}>
          <Text style={styles.guideText}>개인정보와 계좌번호는 꼭 필요한 경우에만 공유해주세요.</Text>
          <Text style={styles.guideText}>전문의약품·처방약 거래는 할 수 없어요.</Text>
          <Text style={styles.guideText}>거래 약속과 중요한 내용은 채팅에 남겨주세요.</Text>
        </View>
      </AppModal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.round,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  searchInput: {
    marginBottom: SPACING.xl,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xxxl,
    paddingTop: SPACING.xxl,
  },
  roomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xxl,
    minHeight: 92,
  },
  roomContent: {
    borderBottomColor: COLORS.borderSoft,
    borderBottomWidth: 1,
    flex: 1,
    gap: SPACING.sm,
    justifyContent: 'center',
    minHeight: 92,
  },
  roomTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  roomBottomLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  nickname: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
    flex: 1,
  },
  time: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
  },
  preview: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    flex: 1,
  },
  unreadPreview: {
    color: COLORS.black,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    minHeight: 22,
    minWidth: 22,
    paddingHorizontal: SPACING.sm,
    justifyContent: 'center',
  },
  badgeText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.background,
  },
  guideContent: {
    gap: SPACING.md,
  },
  guideText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  pressed: {
    opacity: 0.6,
  },
});
