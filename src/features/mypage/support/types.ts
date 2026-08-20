export type InquiryType = 'account' | 'billing' | 'community' | 'other' | 'pet';
export type InquiryStatus = 'answered' | 'waiting';

export type Notice = {
  body: string;
  createdAt: string;
  id: string;
  important: boolean;
  isNew: boolean;
  title: string;
};

export type InquiryImage = {
  assetId: string;
  localUri: string;
};

export type InquiryDraft = {
  body: string;
  images: InquiryImage[];
  type: InquiryType | null;
  updatedAt: string;
  userId: string;
};

export type Inquiry = {
  answer: string | null;
  answeredAt: string | null;
  body: string;
  createdAt: string;
  id: string;
  images: InquiryImage[];
  status: InquiryStatus;
  type: InquiryType;
  userId: string;
};

export type StoredSupportState = {
  draft: InquiryDraft;
  inquiries: Inquiry[];
};

export type SupportStatus = 'loading' | 'ready';
