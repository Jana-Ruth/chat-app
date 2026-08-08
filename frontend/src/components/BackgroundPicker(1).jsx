import { useRef, useState } from 'react';
import { uploadFile } from '../api/upload';
import { mediaUrl } from '../utils/media';

// A handful of solid/gradient presets plus "upload your own image" and "reset to default".
const PRESETS = [
  { id: 'default', label: 'Default', style: {} },
  { id: 'slate', label: 'Slate', style: { background: '#e5e7eb' } },
  { id: 'mint', label: 'Mint', style: { background: 'linear-gradient(160deg, #d1fae5, #a7f3d0)' } },
  { id: 'sunset', label: 'Sunset', style: { background: 'linear-gradient(160deg, #fde68a, #fca5a5)' } },
  { id: 'ocean', label: 'Ocean', style: { background: 'linear-gradient(160deg, #bfdbfe, #93c5fd)' } },
  { id: 'lavender', label: 'Lavender', style: { background: 'linear-gradient(160deg, #e9d5ff, #c4b5fd)' } },
  { id: 'dark', label: 'Dark', style: { background: '#1f2937' } },
];

export default function BackgroundPicker({ onSelect, onClose }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const attachment = await uploadFile(file);
      onSelect({ type: 'image', value: mediaUrl(attachment.url) });
    } catch (err) {
      console.error('Background upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-picker-overlay" onClick={onClose}>
      <div className="bg-picker" onClick={(e) => e.stopPropagation()}>
        <div className="bg-picker-header">
          <span>Chat background</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="bg-picker-grid">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              className="bg-swatch"
              style={preset.style}
              title={preset.label}
              onClick={() => onSelect({ type: 'preset', value: preset.id, style: preset.style })}
            >
              {preset.id === 'default' && 'A'}
            </button>
          ))}
          <button
            className="bg-swatch bg-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '...' : '+'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
