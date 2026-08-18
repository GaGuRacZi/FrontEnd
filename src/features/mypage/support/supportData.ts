import { createEmptyInquiryDraft } from './supportValidation';
import type { Inquiry, Notice, StoredSupportState } from './types';

export const NOTICE_MOCKS: readonly Notice[] = [
  {
    body: `PAW에서 작성한 반려동물 정보, 커뮤니티 활동, 채팅과 문의 내용은 기기의 앱 관리 저장영역에 보관됩니다.

앱을 삭제하거나 기기의 앱 데이터를 지우면 저장한 내용을 복구할 수 없습니다. 중요한 기록은 삭제 전에 다시 확인해주세요.

로그아웃해도 기존 기록은 유지되며, 같은 기기에서 다시 로그인하면 이어서 확인할 수 있습니다.`,
    createdAt: '2026-08-13T09:00:00+09:00',
    id: 'notice-local-storage-20260813',
    important: true,
    isNew: true,
    title: '앱 데이터 보관 안내',
  },
  {
    body: `마이페이지에서 작성글, 찜한 글과 댓글 단 글을 한곳에서 확인할 수 있도록 커뮤니티 활동 화면을 추가했습니다.

작성글은 소통·장터·리뷰별로, 찜한 글은 소통·장터별로 확인할 수 있습니다. 같은 게시글에 여러 댓글을 남긴 경우 가장 최근 댓글과 나머지 댓글 수도 함께 표시됩니다.

게시글이나 댓글을 변경하면 활동 목록에도 바로 반영됩니다.`,
    createdAt: '2026-08-11T14:30:00+09:00',
    id: 'notice-community-activity-20260811',
    important: false,
    isNew: true,
    title: '마이페이지에서 커뮤니티 활동을 확인해보세요',
  },
  {
    body: `커뮤니티에서 안전하게 소통할 수 있도록 운영정책을 안내합니다.

전문의약품과 처방약은 판매하거나 나눔할 수 없습니다. 다른 보호자의 경험은 참고 정보이며 수의사의 진단이나 처방을 대신하지 않습니다. 개인정보가 포함된 진료기록이나 연락처를 게시할 때에는 공개 범위를 꼭 확인해주세요.

운영정책을 확인하고 안전한 커뮤니티 이용 기준을 지켜주세요.`,
    createdAt: '2026-08-04T10:00:00+09:00',
    id: 'notice-community-safety-20260804',
    important: true,
    isNew: false,
    title: '안전한 커뮤니티 이용 안내',
  },
  {
    body: `반려동물 상세 화면에서 기본 정보, 보호자·등록 정보와 먹거리·관리 정보를 한곳에서 확인할 수 있습니다.

정보가 바뀌면 수정 화면에서 바로 반영할 수 있고, 등록한 사진과 건강 정보도 함께 관리할 수 있습니다.`,
    createdAt: '2026-07-25T11:00:00+09:00',
    id: 'notice-pet-management-20260725',
    important: false,
    isNew: false,
    title: '반려동물 정보를 한곳에서 관리해보세요',
  },
];

function createInquiryMocks(userId: string): Inquiry[] {
  return [
    {
      answer: null,
      answeredAt: null,
      body: '가족 계정과 함께 복약 체크 내용을 확인할 수 있는지 궁금합니다.',
      createdAt: '2026-08-10T16:20:00+09:00',
      id: 'inquiry-seed-waiting',
      images: [],
      status: 'waiting',
      type: 'service',
      userId,
    },
    {
      answer: '알림 설정에서 혜택·이벤트 알림을 끄면 마케팅 수신 동의를 철회할 수 있어요.',
      answeredAt: '2026-08-03T13:10:00+09:00',
      body: '마케팅 알림 수신 동의를 변경하고 싶어요.',
      createdAt: '2026-08-02T09:40:00+09:00',
      id: 'inquiry-seed-answered',
      images: [],
      status: 'answered',
      type: 'account',
      userId,
    },
  ];
}

export function createDefaultSupportState(userId: string): StoredSupportState {
  return {
    draft: createEmptyInquiryDraft(userId),
    inquiries: createInquiryMocks(userId),
  };
}
