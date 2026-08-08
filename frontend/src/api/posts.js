import api from './client';

export async function createPost(formData) {
  const { data } = await api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.post;
}

export async function getFeed() {
  const { data } = await api.get('/posts/feed');
  return data.posts;
}

export async function getUserPosts(userId) {
  const { data } = await api.get(`/posts/user/${userId}`);
  return data.posts;
}

export async function deletePost(postId) {
  await api.delete(`/posts/${postId}`);
}
