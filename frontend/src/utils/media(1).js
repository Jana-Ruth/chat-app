// Attachment URLs come back from the API as relative paths like "/uploads/images/xyz.png".
// The backend origin (no /api suffix) is what serves those static files.
const BACKEND_ORIGIN = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function mediaUrl(relativePath) {
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath;
  return `${BACKEND_ORIGIN}${relativePath}`;
}
