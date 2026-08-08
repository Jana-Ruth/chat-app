import api from './client';

// Uploads a File/Blob and returns attachment metadata to send via the
// message:send socket event. `filename` matters for Blobs (e.g. recorded audio)
// which don't carry a name on their own.
export async function uploadFile(fileOrBlob, filename) {
  const formData = new FormData();
  formData.append('file', fileOrBlob, filename || fileOrBlob.name);

  const { data } = await api.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data.attachment;
}
