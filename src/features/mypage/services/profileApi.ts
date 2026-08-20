import {
  apiRequest,
} from '@/src/services/apiClient';
import { appendMultipartImage, appendMultipartJson } from '@/src/utils/file';

import {
  parseRemoteUserProfileEnvelope,
  type RemoteUserProfile,
} from '../../auth/services/kakaoAuthContract';

type RemoteProfileUpdate = {
  imageUri?: string | null;
  intro: string;
  name: string;
  nickname: string;
};

export async function getRemoteUserProfile() {
  const response = await apiRequest<unknown>('/users/me');
  return parseRemoteUserProfileEnvelope(response, 'USER_PROFILE_200');
}

export async function updateRemoteUserProfile({
  imageUri,
  intro,
  name,
  nickname,
}: RemoteProfileUpdate): Promise<RemoteUserProfile> {
  const formData = new FormData();
  appendMultipartJson(formData, { intro, name, nickname });

  if (imageUri) {
    appendMultipartImage(formData, 'image', imageUri);
  }

  const response = await apiRequest<unknown>('/users/me/profile', {
    body: formData,
    method: 'PUT',
  });
  return parseRemoteUserProfileEnvelope(response, 'USER_PROFILE_UPDATE_200');
}
