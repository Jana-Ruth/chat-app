import api from './client';

export async function getUserProfile(userId) {
  const { data } = await api.get(`/users/${userId}`);
  return data; // { user, iBlockedThem, theyBlockedMe }
}

export async function updateProfile(formData) {
  const { data } = await api.put('/users/me', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.user;
}

export async function changePassword(currentPassword, newPassword) {
  await api.put('/users/me/password', { currentPassword, newPassword });
}

export async function blockUser(userId) {
  await api.post(`/users/${userId}/block`);
}

export async function unblockUser(userId) {
  await api.post(`/users/${userId}/unblock`);
}

export async function listBlockedUsers() {
  const { data } = await api.get('/users/me/blocked');
  return data.users;
}
