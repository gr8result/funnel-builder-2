// /pages/social-test.js

import { useState } from 'react';

export default function SocialTest() {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('facebook');

  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/social/create-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          platform
        })
      });

      const data = await res.json();

      if (data.success) {
        alert('Post saved');
        setContent('');
      } else {
        alert(data.error || 'Error');
      }
    } catch (err) {
      console.error(err);
      alert('Request failed');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Create Social Post</h2>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your post..."
        style={{
          width: '100%',
          height: 100,
          background: '#111',
          color: '#fff',
          border: '1px solid #444',
          padding: 10
        }}
      />

      <br /><br />

      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
        style={{
          background: '#111',
          color: '#fff',
          padding: 8
        }}
      >
        <option value="facebook">Facebook</option>
        <option value="instagram">Instagram</option>
        <option value="linkedin">LinkedIn</option>
      </select>

      <br /><br />

      <button onClick={handleSubmit}>
        Save Post
      </button>
    </div>
  );
}