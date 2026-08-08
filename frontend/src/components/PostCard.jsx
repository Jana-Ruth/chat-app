import { Link } from 'react-router-dom';
import { mediaUrl } from '../utils/media';
import { fullTimestamp } from '../utils/dates';
import Avatar from './Avatar';
import { Trash2 } from 'lucide-react';

const VISIBILITY_LABEL = {
  everyone: 'Everyone',
  contacts: 'Contacts',
  custom: 'Selected people',
};

export default function PostCard({ post, isOwn, onDelete }) {
  const author = post.author;

  return (
    <article className="post-card">
      <div className="post-card-header">
        <Link to={`/profile/${author.id || author._id}`} className="post-card-author">
          <Avatar user={author} size={38} />
          <div>
            <div className="post-card-username">{author.username}</div>
            <div className="post-card-meta">
              {new Date(post.createdAt).toLocaleDateString()} · {VISIBILITY_LABEL[post.visibility]}
            </div>
          </div>
        </Link>
        {isOwn && (
          <button className="post-card-delete" title="Delete post" onClick={() => onDelete(post._id)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="post-card-media" title={fullTimestamp(post.createdAt)}>
        {post.mediaType === 'video' ? (
          <video src={mediaUrl(post.mediaUrl)} controls />
        ) : (
          <img src={mediaUrl(post.mediaUrl)} alt={post.caption || 'Post'} />
        )}
      </div>

      {post.caption && <p className="post-card-caption">{post.caption}</p>}
    </article>
  );
}
