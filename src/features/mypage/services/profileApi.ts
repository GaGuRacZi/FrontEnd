import {
  apiRequest,
} from '@/src/services/apiClient';
import { getMultipartImageFile } from '@/src/utils/file';

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
  formData.append(
    'data',
    new Blob(
      [JSON.stringify({ intro, name, nickname })],
      { type: 'application/json' },
    ),
  );

  if (imageUri) {
    formData.append('image', getMultipartImageFile(imageUri) as unknown as Blob);
  }

  const response = await apiRequest<unknown>('/users/me/profile', {
    body: formData,
    method: 'PUT',
  });
  return parseRemoteUserProfileEnvelope(response, 'USER_PROFILE_UPDATE_200');
}
