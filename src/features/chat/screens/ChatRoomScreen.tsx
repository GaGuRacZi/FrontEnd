import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { AppScreen, ScreenLayout, TopHeader } from '@/src/components/layout';
import { useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { formatCompactRegion } from '@/src/utils/location';

import { formatChatDate, formatChatTime } from '../chatFormat';
import { useChatStore } from '../ChatStore';
import {
  ChatPostReferenceCard,
  ChatSafetyBanner,
  ParticipantAvatar,
} from '../components';
import { getChatImageUri } from '../services/chatImageStorage';
import type { ChatMessage, ChatParticipantSnapshot } from '../types';

type ChatRoomScreenProps = {
  roomId: string;
};

const REFRESH_PROMPT_INTERVAL_MS = 10_000;

function ChatRoomState({
  children,
  onBack,
}: PropsWithChildren<{ onBack: () => void }>) {
  return (
    <ScreenLayout
      headerFullWidth
      headerVariant="auth"
      leftAccessibilityLabel="채팅 목록으로 돌아가기"
      onLeftPress={onBack}
      title="채팅"
    >
      <View style={styles.centered}>{children}</View>
    </ScreenLayout>
  );
}

function isSameCalendarDate(first: string, second?: string) {
  if (!second) return false;
  const firstDate = new Date(first);
  const secondDate = new Date(second);
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function MessageImages({ message }: { message: ChatMessage }) {
  const images = message.images ?? [];
  if (!images.length) return null;

  return (
    <View style={[styles.messageImages, images.length === 1 && styles.singleMessageImage]}>
      {images.map((image) => (
        <Image
          accessibilityLabel="채팅 사진"
          key={image.assetId}
          source={{ uri: getChatImageUri(image) }}
          style={[styles.messageImage, images.length === 1 && styles.messageImageLarge]}
        />
      ))}
    </View>
  );
}

function MessageBubble({
  isMine,
  message,
  onRetry,
  participant,
  retrying,
}: {
  isMine: boolean;
  message: ChatMessage;
  onRetry: () => void;
  participant: ChatParticipantSnapshot;
  retrying: boolean;
}) {
  return (
    <View style={[styles.messageRow, isMine && styles.myMessageRow]}>
      {!isMine ? <ParticipantAvatar participant={participant} size={32} /> : null}
      <View style={[styles.messageColumn, isMine && styles.myMessageColumn]}>
        <View style={[styles.bubble, isMine ? styles.myBubble : styles.otherBubble]}>
          <MessageImages message={message} />
          {message.text ? (
            <Text style={[styles.messageText, isMine && styles.myMessageText]}>{message.text}</Text>
          ) : null}
        </View>
        <View style={[styles.messageMeta, isMine && styles.myMessageMeta]}>
          {message.status === 'sending' ? (
            <Text accessibilityLiveRegion="polite" style={styles.messageStatus}>전송 중</Text>
          ) : message.status === 'failed' ? (
            <Pressable
              accessibilityLabel="메시지 다시 보내기"
              accessibilityRole="button"
              disabled={retrying}
              hitSlop={SPACING.md}
              onPress={onRetry}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              {retrying ? (
                <ActivityIndicator color={COLORS.danger} size="small" />
              ) : (
                <>
                  <AppIcon color={COLORS.danger} name="refresh" size={14} />
                  <Text style={styles.failedText}>전송 실패</Text>
                </>
              )}
            </Pressable>
          ) : null}
          <Text style={styles.messageTime}>{formatChatTime(message.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

export function ChatRoomScreen({ roomId }: ChatRoomScreenProps) {
  const router = useRouter();
  const showAlert = useAppAlert();
  const insets = useSafeAreaInsets();
  const { currentUserId } = useAuthSession();
  const {
    addDraftImages,
    canSendMessage,
    getDraft,
    getMessages,
    getOtherParticipant,
    getRoomById,
    hasLoadError,
    isReady,
    markRoomRead,
    reloadChat,
    removeDraftImage,
    retryMessage,
    sendDraft,
    updateDraftText,
  } = useChatStore();
  const room = getRoomById(roomId);
  const participant = room ? getOtherParticipant(room) : null;
  const draft = getDraft(roomId);
  const roomMessages = getMessages(roomId);
  const messages = useMemo(
    () => roomMessages.filter((message) => message.kind !== 'post'),
    [roomMessages],
  );
  const lastMessageId = roomMessages.at(-1)?.id;
  const roomSessionKey = `${currentUserId ?? ''}\u0000${roomId}`;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pickingImages, setPickingImages] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshPromptVisible, setRefreshPromptVisible] = useState(false);
  const composerInputRef = useRef<TextInput>(null);
  const initializedRoomRef = useRef('');
  const textRef = useRef('');
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const nearBottomRef = useRef(true);
  const leavingRef = useRef(false);
  const pickingImagesRef = useRef(false);
  const retryingIdsRef = useRef(new Set<string>());
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!isReady || !room || initializedRoomRef.current === roomSessionKey) return;
    initializedRoomRef.current = roomSessionKey;
    textRef.current = draft.text;
    setText(draft.text);
  }, [draft.text, isReady, room, roomSessionKey]);

  useEffect(() => {
    if (isReady) setHasLoadedOnce(true);
  }, [isReady]);

  const persistDraftText = useCallback(
    (value: string) => {
      textRef.current = value;
      setText(value);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        draftTimerRef.current = null;
        void updateDraftText(roomId, textRef.current);
      }, 250);
    },
    [roomId, updateDraftText],
  );

  const flushDraft = useCallback(async () => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    if (!isReady || hasLoadError) return { ok: true } as const;
    if (!getRoomById(roomId) || !canSendMessage(roomId)) return { ok: true } as const;
    return updateDraftText(roomId, textRef.current);
  }, [canSendMessage, getRoomById, hasLoadError, isReady, roomId, updateDraftText]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        nextState !== 'active' &&
        initializedRoomRef.current === roomSessionKey &&
        !sendingRef.current
      ) {
        void flushDraft();
      }
    });
    return () => subscription.remove();
  }, [flushDraft, roomSessionKey]);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(
      () => () => {
        if (
          draftTimerRef.current &&
          initializedRoomRef.current === roomSessionKey &&
          !sendingRef.current
        ) {
          void flushDraft();
        }
      },
      [flushDraft, roomSessionKey],
    ),
  );

  useFocusEffect(
    useCallback(() => {
      reloadChat();
      return undefined;
    }, [reloadChat]),
  );

  useFocusEffect(
    useCallback(() => {
      const intervalId = setInterval(
        () => setRefreshPromptVisible(true),
        REFRESH_PROMPT_INTERVAL_MS,
      );
      return () => {
        clearInterval(intervalId);
        setRefreshPromptVisible(false);
      };
    }, []),
  );

  const refreshMessages = useCallback(() => {
    if (!isReady) return;
    setRefreshPromptVisible(false);
    reloadChat();
  }, [isReady, reloadChat]);

  useFocusEffect(
    useCallback(() => {
      if (isReady && room && lastMessageId) void markRoomRead(roomId);
      return undefined;
    }, [isReady, lastMessageId, markRoomRead, room, roomId]),
  );

  const leaveRoom = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    try {
      if (!sendingRef.current) {
        const result = await flushDraft();
        if (!result.ok) {
          showAlert('작성 중인 메시지를 저장하지 못했어요', '잠시 후 다시 시도해주세요.');
          return;
        }
      }
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: '/community', params: { view: 'chat' } });
    } finally {
      leavingRef.current = false;
    }
  }, [flushDraft, router, showAlert]);

  const handleBack = useCallback(() => {
    void leaveRoom();
  }, [leaveRoom]);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (composerInputRef.current?.isFocused()) {
        composerInputRef.current.blur();
        Keyboard.dismiss();
      } else {
        void leaveRoom();
      }
      return true;
    });
    return () => backSubscription.remove();
  }, [leaveRoom]);

  const pickImages = useCallback(async () => {
    if (pickingImagesRef.current) return;
    const remaining = 5 - draft.images.length;
    if (remaining <= 0) {
      showAlert('사진은 최대 5장까지 보낼 수 있어요');
      return;
    }

    pickingImagesRef.current = true;
    setPickingImages(true);
    try {
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showAlert('사진 접근 권한이 필요해요', '설정에서 사진 접근 권한을 허용해주세요.', [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => void Linking.openSettings() },
          ]);
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        defaultTab: 'photos',
        mediaTypes: ['images'],
        quality: 0.85,
        selectionLimit: remaining,
      });
      if (result.canceled) return;
      const addResult = await addDraftImages(
        roomId,
        result.assets.slice(0, remaining).map((asset) => asset.uri),
      );
      if (!addResult.ok) {
        showAlert(
          addResult.reason === 'limit' ? '사진은 최대 5장까지 보낼 수 있어요' : '사진을 불러오지 못했어요',
          addResult.reason === 'limit' ? undefined : '잠시 후 다시 시도해주세요.',
        );
      }
    } catch {
      showAlert('사진을 불러오지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      pickingImagesRef.current = false;
      setPickingImages(false);
    }
  }, [addDraftImages, draft.images.length, roomId, showAlert]);

  const submit = useCallback(async () => {
    if (sendingRef.current || (!text.trim() && !draft.images.length)) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const draftResult = await flushDraft();
      if (!draftResult.ok) {
        showAlert('작성 중인 메시지를 저장하지 못했어요', '입력 내용은 그대로 두었어요. 다시 시도해주세요.');
        return;
      }
      const result = await sendDraft(roomId);
      if (result.ok) {
        textRef.current = '';
        setText('');
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      } else if (result.messageId) {
        textRef.current = '';
        setText('');
        showAlert('메시지를 보내지 못했어요', '메시지 옆의 다시 보내기를 눌러주세요.');
      } else if (result.reason === 'read-only') {
        showAlert('메시지를 보낼 수 없는 채팅방이에요');
      } else if (result.reason !== 'empty') {
        showAlert(
          '메시지를 보내지 못했어요',
          '입력 내용은 보존했어요. 다시 전송해주세요.',
        );
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [draft.images.length, flushDraft, roomId, sendDraft, showAlert, text]);

  const retry = useCallback(async (messageId: string) => {
    if (retryingIdsRef.current.has(messageId)) return;
    retryingIdsRef.current.add(messageId);
    setRetryingIds((current) => new Set(current).add(messageId));
    try {
      const result = await retryMessage(messageId);
      if (!result.ok) {
        showAlert(
          result.reason === 'read-only' ? '메시지를 보낼 수 없는 채팅방이에요' : '다시 보내지 못했어요',
          result.reason === 'read-only' ? undefined : '잠시 후 다시 시도해주세요.',
        );
      }
    } finally {
      retryingIdsRef.current.delete(messageId);
      setRetryingIds((current) => {
        const next = new Set(current);
        next.delete(messageId);
        return next;
      });
    }
  }, [retryMessage, showAlert]);

  const participantSubtitle = useMemo(() => {
    if (!participant) return '';
    return [
      participant.petName,
      participant.location ? formatCompactRegion(participant.location) : null,
    ].filter(Boolean).join(' · ');
  }, [participant]);

  if (!isReady && !hasLoadedOnce) {
    return (
      <ChatRoomState onBack={handleBack}>
        <LoadingView label="대화방을 불러오고 있어요." />
      </ChatRoomState>
    );
  }

  if (hasLoadError) {
    return (
      <ChatRoomState onBack={handleBack}>
        <EmptyState
          actionLabel="다시 시도"
          description="잠시 후 다시 대화방을 열어주세요."
          onActionPress={reloadChat}
          title="대화방을 불러오지 못했어요"
        />
      </ChatRoomState>
    );
  }

  if (!room || !participant || !currentUserId) {
    return (
      <ChatRoomState onBack={handleBack}>
        <EmptyState
          actionLabel="채팅 목록으로"
          description="삭제되었거나 잘못된 대화방이에요."
          onActionPress={() => router.replace({ pathname: '/community', params: { view: 'chat' } })}
          title="대화방을 찾을 수 없어요"
        />
      </ChatRoomState>
    );
  }

  const writable = canSendMessage(roomId);
  const canSubmit = writable && !sending && Boolean(text.trim() || draft.images.length);
  const postReference = room.postReference;

  return (
    <AppScreen edges={['top', 'bottom', 'left', 'right']} padded={false}>
      <TopHeader
        centerContent={
          <View style={styles.headerProfile}>
            <ParticipantAvatar participant={participant} size={44} />
            <View style={styles.headerText}>
              <Text numberOfLines={1} style={styles.headerNickname}>{participant.nickname}</Text>
              {participantSubtitle ? (
                <Text numberOfLines={1} style={styles.headerSubtitle}>{participantSubtitle}</Text>
              ) : null}
            </View>
          </View>
        }
        centerContentStyle={styles.headerCenter}
        leftAccessibilityLabel="채팅 목록으로 돌아가기"
        leftIcon="chevron-back"
        onLeftPress={handleBack}
        style={styles.header}
      />
      <View style={styles.headerDivider} />
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={insets.bottom}
        style={styles.root}
      >
        <FlatList
          ListHeaderComponent={
            <View style={styles.roomHeaderContent}>
              <ChatSafetyBanner compact />
              {postReference ? (
                <ChatPostReferenceCard
                  onPress={postReference.deletedAt ? undefined : () => router.push({
                    pathname: '/community/[postId]',
                    params: { origin: 'community', postId: postReference.postId },
                  })}
                  reference={postReference}
                />
              ) : null}
              {!writable ? (
                <View style={styles.readOnlyBanner}>
                  <AppIcon color={COLORS.gray600} name="information-circle-outline" size={19} />
                  <Text style={styles.readOnlyText}>탈퇴한 사용자와의 대화는 읽기만 할 수 있어요.</Text>
                </View>
              ) : null}
            </View>
          }
          contentContainerStyle={styles.messageList}
          data={messages}
          keyExtractor={(message) => message.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (nearBottomRef.current) {
              listRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onScroll={({ nativeEvent }) => {
            nearBottomRef.current =
              nativeEvent.contentSize.height -
                nativeEvent.layoutMeasurement.height -
                nativeEvent.contentOffset.y <=
              80;
          }}
          ref={listRef}
          refreshControl={(
            <RefreshControl
              colors={[COLORS.primary]}
              onRefresh={refreshMessages}
              refreshing={!isReady && hasLoadedOnce}
              tintColor={COLORS.primary}
            />
          )}
          renderItem={({ index, item }) => {
            const previous = messages[index - 1];
            const showDate = !previous || !isSameCalendarDate(item.createdAt, previous.createdAt);
            return (
              <View>
                {showDate ? (
                  <View style={styles.dateChip}>
                    <Text style={styles.dateText}>{formatChatDate(item.createdAt)}</Text>
                  </View>
                ) : null}
                <MessageBubble
                  isMine={item.senderId === currentUserId}
                  message={item}
                  onRetry={() => void retry(item.id)}
                  participant={participant}
                  retrying={retryingIds.has(item.id)}
                />
              </View>
            );
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.composerArea}>
          {refreshPromptVisible ? (
            <Pressable
              accessibilityLabel="새 메시지 확인"
              accessibilityRole="button"
              disabled={!isReady}
              onPress={refreshMessages}
              style={({ pressed }) => [styles.refreshPrompt, pressed && styles.pressed]}
            >
              <AppIcon color={COLORS.primary} name="refresh" size={16} />
              <Text style={styles.refreshPromptText}>새 메시지 확인</Text>
            </Pressable>
          ) : null}
          {draft.images.length ? (
            <ScrollView
              contentContainerStyle={styles.draftImages}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              {draft.images.map((image, index) => (
                <View key={image.assetId} style={styles.draftImageContainer}>
                  <Image source={{ uri: getChatImageUri(image) }} style={styles.draftImage} />
                  <Pressable
                    accessibilityLabel={`${index + 1}번째 사진 삭제`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: sending }}
                    disabled={sending}
                    hitSlop={SPACING.md}
                    onPress={() => void removeDraftImage(roomId, image.assetId)}
                    style={({ pressed }) => [styles.removeImageButton, pressed && styles.pressed]}
                  >
                    <AppIcon color={COLORS.background} name="close" size={15} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
          <View style={[styles.composer, !writable && styles.composerDisabled]}>
            <Pressable
              accessibilityLabel="사진 첨부"
              accessibilityRole="button"
              accessibilityState={{ disabled: !writable || sending || pickingImages }}
              disabled={!writable || sending || pickingImages}
              hitSlop={SPACING.sm}
              onPress={() => void pickImages()}
              style={({ pressed }) => [styles.composerAction, pressed && styles.pressed]}
            >
              {pickingImages ? (
                <ActivityIndicator color={COLORS.gray500} size="small" />
              ) : (
                <AppIcon color={COLORS.gray500} name="camera-outline" size={22} />
              )}
            </Pressable>
            <TextInput
              accessibilityLabel="메시지 입력"
              editable={writable && !sending}
              maxLength={1000}
              multiline
              onChangeText={persistDraftText}
              placeholder={writable ? '메시지를 입력해주세요' : '메시지를 보낼 수 없어요'}
              placeholderTextColor={COLORS.gray500}
              ref={composerInputRef}
              style={styles.input}
              value={text}
            />
            <Pressable
              accessibilityLabel="메시지 보내기"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.sendButton,
                !canSubmit && styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {sending ? (
                <ActivityIndicator color={COLORS.background} size="small" />
              ) : (
                <AppIcon
                  color={COLORS.background}
                  name="send"
                  size={19}
                  style={styles.sendIcon}
                />
              )}
            </Pressable>
          </View>
          {text.length >= 900 ? (
            <Text style={styles.characterCount}>{text.length}/1,000</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    height: 80,
    marginHorizontal: SPACING.xxl,
  },
  headerCenter: {
    alignItems: 'flex-start',
    paddingHorizontal: SIZE.touchTarget + SPACING.xl,
  },
  headerDivider: {
    backgroundColor: COLORS.borderSoft,
    height: 1,
  },
  headerProfile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
    maxWidth: 230,
  },
  headerText: {
    flexShrink: 1,
  },
  headerNickname: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  root: {
    flex: 1,
  },
  roomHeaderContent: {
    gap: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  readOnlyBanner: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  readOnlyText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    flex: 1,
  },
  messageList: {
    flexGrow: 1,
    paddingBottom: SPACING.xxl,
  },
  dateChip: {
    alignSelf: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.round,
    marginBottom: SPACING.xxl,
    marginTop: SPACING.xxxl,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  dateText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  messageRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
    paddingHorizontal: SPACING.xxl,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  messageColumn: {
    alignItems: 'flex-start',
    maxWidth: '74%',
  },
  myMessageColumn: {
    alignItems: 'flex-end',
  },
  bubble: {
    overflow: 'hidden',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  otherBubble: {
    backgroundColor: COLORS.gray100,
    borderBottomLeftRadius: RADIUS.sm,
    borderRadius: RADIUS.lg,
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: RADIUS.sm,
    borderRadius: RADIUS.lg,
  },
  messageText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
  },
  myMessageText: {
    color: COLORS.background,
  },
  messageMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xxs,
  },
  myMessageMeta: {
    justifyContent: 'flex-end',
  },
  messageTime: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
  },
  messageStatus: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
  },
  retryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xxs,
    minHeight: 28,
  },
  failedText: {
    ...TYPOGRAPHY.small,
    color: COLORS.danger,
  },
  messageImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    maxWidth: 184,
  },
  singleMessageImage: {
    maxWidth: 196,
  },
  messageImage: {
    borderRadius: RADIUS.sm,
    height: 88,
    width: 88,
  },
  messageImageLarge: {
    height: 164,
    width: 196,
  },
  composerArea: {
    borderTopColor: COLORS.borderSoft,
    borderTopWidth: 1,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  refreshPrompt: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  refreshPromptText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 60,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.md,
  },
  composerDisabled: {
    backgroundColor: COLORS.gray100,
  },
  composerAction: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  input: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
    flex: 1,
    maxHeight: 116,
    minHeight: 44,
    paddingBottom: Platform.OS === 'ios' ? 11 : SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingTop: Platform.OS === 'ios' ? 11 : SPACING.xl,
    textAlignVertical: 'center',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.sub,
    opacity: 0.5,
  },
  sendIcon: {
    transform: [{ translateX: 2 }],
  },
  characterCount: {
    ...TYPOGRAPHY.small,
    alignSelf: 'flex-end',
    color: COLORS.gray500,
    marginRight: SPACING.xl,
    marginTop: SPACING.xxs,
  },
  draftImages: {
    gap: SPACING.md,
    paddingBottom: SPACING.md,
  },
  draftImageContainer: {
    position: 'relative',
  },
  draftImage: {
    borderRadius: RADIUS.md,
    height: 72,
    width: 72,
  },
  removeImageButton: {
    alignItems: 'center',
    backgroundColor: COLORS.gray800,
    borderRadius: RADIUS.round,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -6,
    width: 24,
  },
  pressed: {
    opacity: 0.6,
  },
});
