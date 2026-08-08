import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateProfile, changePassword, listBlockedUsers, unblockUser } from '../api/users';
import {
  soundsEnabled,
  setSoundsEnabled,
  soundPacks,
  currentSoundPack,
  setSoundPack,
  previewSoundPack,
} from '../utils/sound';
import Avatar from '../components/Avatar';
import BackgroundPicker from '../components/BackgroundPicker';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef(null);

  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [blockedUsers, setBlockedUsers] = useState([]);

  const [soundsOn, setSoundsOn] = useState(soundsEnabled());
  const [pack, setPack] = useState(currentSoundPack());
  const [showBgPicker, setShowBgPicker] = useState(false);

  useEffect(() => {
    listBlockedUsers().then(setBlockedUsers).catch(() => {});
  }, []);

  function handleSoundsToggle() {
    const next = !soundsOn;
    setSoundsOn(next);
    setSoundsEnabled(next);
  }

  function handlePackSelect(id) {
    setPack(id);
    setSoundPack(id);
    previewSoundPack(id);
  }

  function handleDefaultBackgroundSelect(bg) {
    localStorage.setItem('chatBg:default', JSON.stringify(bg));
    setShowBgPicker(false);
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setProfileSaving(true);
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('bio', bio);
      formData.append('phone', phone);
      if (avatarFile) formData.append('avatar', avatarFile);

      const updated = await updateProfile(formData);
      updateUser(updated);
      setProfileMessage('Profile updated');
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage('Password changed');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleUnblock(id) {
    await unblockUser(id);
    setBlockedUsers((prev) => prev.filter((u) => (u.id || u._id) !== id));
  }

  return (
    <div className="settings-page">
      <Link to="/" className="back-link">← Back to chats</Link>
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Profile</h2>
        <form onSubmit={handleProfileSubmit} className="settings-form">
          {profileError && <p className="error">{profileError}</p>}
          {profileMessage && <p className="success-msg">{profileMessage}</p>}

          <button
            type="button"
            className="avatar-picker"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" />
            ) : (
              <Avatar user={user} size={72} />
            )}
            <span className="avatar-picker-label">Change photo</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />

          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Not set" />
          </label>
          <label>
            Bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder="Tell people a little about yourself" />
          </label>

          <button type="submit" disabled={profileSaving}>
            {profileSaving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="settings-section">
        <h2>Password</h2>
        <form onSubmit={handlePasswordSubmit} className="settings-form">
          {passwordError && <p className="error">{passwordError}</p>}
          {passwordMessage && <p className="success-msg">{passwordMessage}</p>}
          <label>
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          <button type="submit" disabled={passwordSaving}>
            {passwordSaving ? 'Updating...' : 'Change password'}
          </button>
        </form>
      </section>

      <section className="settings-section">
        <h2>Blocked users</h2>
        {blockedUsers.length === 0 ? (
          <p className="muted-note">You haven't blocked anyone.</p>
        ) : (
          <ul className="blocked-list">
            {blockedUsers.map((u) => (
              <li key={u.id || u._id}>
                <Avatar user={u} size={32} />
                <span>{u.username}</span>
                <button onClick={() => handleUnblock(u.id || u._id)}>Unblock</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="settings-section">
        <h2>Appearance</h2>

        <div className="settings-subsection">
          <label className="settings-subsection-label">Theme</label>
          <div className="segmented-control">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => theme !== 'light' && toggleTheme()}>
              ☀️ Light
            </button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => theme !== 'dark' && toggleTheme()}>
              🌙 Dark
            </button>
          </div>
        </div>

        <div className="settings-subsection">
          <label className="settings-subsection-label">Chat background</label>
          <p className="muted-note">
            Sets the default wallpaper for conversations that don't have their own background chosen.
          </p>
          <button className="secondary-btn" onClick={() => setShowBgPicker(true)}>🎨 Choose background</button>
        </div>

        <div className="settings-subsection">
          <div className="settings-subsection-row">
            <label className="settings-subsection-label">Message sounds</label>
            <label className="toggle-switch">
              <input type="checkbox" checked={soundsOn} onChange={handleSoundsToggle} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className={`sound-pack-grid ${!soundsOn ? 'disabled' : ''}`}>
            {soundPacks().map((p) => (
              <button
                key={p.id}
                className={`sound-pack-option ${pack === p.id ? 'active' : ''}`}
                onClick={() => handlePackSelect(p.id)}
                disabled={!soundsOn}
              >
                <span>{p.label}</span>
                <span className="sound-pack-preview-icon">▶</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {showBgPicker && (
        <BackgroundPicker onSelect={handleDefaultBackgroundSelect} onClose={() => setShowBgPicker(false)} />
      )}

    </div>
  );
}
