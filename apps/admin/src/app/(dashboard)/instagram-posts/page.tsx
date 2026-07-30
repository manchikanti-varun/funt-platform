"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE } from "@funt-platform/constants";
import { RequireRoles } from "@/components/auth/RequireRoles";

interface InstaPost {
  _id: string;
  postUrl: string;
  label: string;
  order: number;
  active: boolean;
  createdAt: string;
}

const STAFF_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN];

export default function InstagramPostsPage() {
  const [posts, setPosts] = useState<InstaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function fetchPosts() {
    const res = await api<InstaPost[]>("/api/instagram-posts");
    if (res.success && Array.isArray(res.data)) {
      setPosts(res.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newUrl.trim()) {
      setError("Post URL is required");
      return;
    }
    if (!newUrl.includes("instagram.com/")) {
      setError("Must be a valid Instagram URL (post or reel)");
      return;
    }
    setAdding(true);
    const res = await api("/api/instagram-posts", {
      method: "POST",
      body: JSON.stringify({ postUrl: newUrl.trim(), label: newLabel.trim() }),
    });
    setAdding(false);
    if (res.success) {
      setNewUrl("");
      setNewLabel("");
      fetchPosts();
    } else {
      setError((res as { message?: string }).message ?? "Failed to add");
    }
  }

  async function toggleActive(post: InstaPost) {
    await api(`/api/instagram-posts/${post._id}`, {
      method: "PUT",
      body: JSON.stringify({ active: !post.active }),
    });
    fetchPosts();
  }

  async function deletePost(post: InstaPost) {
    if (!confirm(`Delete "${post.label || post.postUrl}"?`)) return;
    await api(`/api/instagram-posts/${post._id}`, { method: "DELETE" });
    fetchPosts();
  }

  function getType(url: string): "post" | "reel" {
    return url.includes("/reel") ? "reel" : "post";
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={STAFF_ROLES} fallbackHref="/dashboard" />

      {/* Header */}
      <div className="shrink-0 pb-6">
        <h1 className="text-2xl font-bold text-black">Instagram Posts</h1>
        <p className="mt-1 text-sm text-black/60">
          Add Instagram post/reel links here. They appear on the Gallery page and rotate every 5 minutes (6 unique posts shown at a time).
        </p>
      </div>

      {/* Add new post form */}
      <form onSubmit={addPost} className="shrink-0 mb-6 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-black mb-3">Add New Post</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            placeholder="https://www.instagram.com/p/ABC123/ or /reel/ABC123/"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="sm:w-48 rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={adding}
            className="shrink-0 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding..." : "Add Post"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-2 text-xs text-black/40">
          Supports: Posts (instagram.com/p/...) and Reels (instagram.com/reel/...)
        </p>
      </form>

      {/* Posts list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="text-center py-12 text-black/40 text-sm">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-black/15 bg-black/[0.02]">
            <p className="text-black/50 text-sm">No posts added yet. Add your first Instagram post above.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {posts.map((post) => (
              <div
                key={post._id}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                  post.active
                    ? "border-black/10 bg-white shadow-sm"
                    : "border-black/5 bg-black/[0.02] opacity-60"
                }`}
              >
                {/* Thumbnail preview */}
                <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-black/5 border border-black/10 flex items-center justify-center">
                  <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center hover:bg-black/10 transition-colors">
                    {getType(post.postUrl) === "reel" ? (
                      <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </a>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      getType(post.postUrl) === "reel"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {getType(post.postUrl)}
                    </span>
                    {post.label && (
                      <span className="text-sm font-medium text-black truncate">{post.label}</span>
                    )}
                  </div>
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block text-xs text-indigo-600 hover:underline truncate"
                  >
                    {post.postUrl}
                  </a>
                  <p className="mt-0.5 text-[10px] text-black/40">
                    Added {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(post)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      post.active
                        ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                        : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {post.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => deletePost(post)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="shrink-0 mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
        <h3 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">How it works</h3>
        <ul className="mt-2 space-y-1 text-xs text-indigo-700/80">
          <li>• Add Instagram post or reel URLs from @funtrobotics</li>
          <li>• Active posts appear on the Gallery page of funt.in</li>
          <li>• 6 posts are shown at a time, randomly rotated every 5 minutes</li>
          <li>• Each rotation picks 6 unique posts from all active ones</li>
          <li>• Toggle &quot;Active&quot; to hide/show a post without deleting it</li>
        </ul>
      </div>
    </div>
  );
}
