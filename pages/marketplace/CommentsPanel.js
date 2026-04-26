import { useState } from "react";

export default function CommentsPanel() {
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  return (
    <div className="mt-4 bg-[#181f2e] border border-slate-700 rounded-lg p-3">
      <div className="font-semibold mb-2 text-green-400">Comments</div>
      <div className="max-h-24 overflow-y-auto mb-2">
        {comments.length === 0 ? (
          <div className="text-slate-400 text-sm">No comments yet.</div>
        ) : (
          comments.map((c, i) => (
            <div key={i} className="text-slate-200 text-sm mb-1">{c}</div>
          ))
        )}
      </div>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (commentInput.trim()) {
            setComments(cs => [...cs, commentInput.trim()]);
            setCommentInput("");
          }
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          className="flex-1 bg-[#222] rounded px-2 py-1 text-white border border-slate-700 text-sm"
          placeholder="Add a comment..."
          value={commentInput}
          onChange={e => setCommentInput(e.target.value)}
        />
        <button type="submit" className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold">
          Post
        </button>
      </form>
    </div>
  );
}