// /pages/modules/communities/index.js 
// GR8 RESULT Communities – Global + My Community
// Uses get_account_brand() so posts show the real business name
// Allows users to edit/delete their own posts
// Includes working image uploads via Supabase Storage (community-images bucket)

import { useEffect, useState, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import SubscriberAvatar from "../../../components/crm/SubscriberAvatar";

// Banner icon – 48px
const CommunitiesIcon = ({ size = 48, color = "#00324b" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ marginRight: 16 }}
  >
    <circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.8" />
    <circle cx="16" cy="7" r="3" stroke={color} strokeWidth="1.8" />
    <circle cx="12" cy="16" r="3" stroke={color} strokeWidth="1.8" />
    <path
      d="M6 11.5c-1.7.4-3 1.9-3 3.7V18"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M18 10.5c1.7.4 3 1.9 3 3.7V18"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M9.5 19.2c.7.5 1.6.8 2.5.8 1 0 1.9-.3 2.6-.9"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const POLICY_VERSION = 1;

export default function Communities() {
  const [user, setUser] = useState(null);
  const [accountName, setAccountName] = useState(""); // e.g. Waite and Sea Health and Fitness

  const [tab, setTab] = useState("global"); // "global" | "my"
  const [globalCommunity, setGlobalCommunity] = useState(null);
  const [myCommunity, setMyCommunity] = useState(null);
  const [activeCommunityId, setActiveCommunityId] = useState(null);

  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [posts, setPosts] = useState([]);

  const [newChannelName, setNewChannelName] = useState("");
  const [newPostBody, setNewPostBody] = useState("");

  const [loading, setLoading] = useState(true);
  const [initialising, setInitialising] = useState(true);
  const [error, setError] = useState("");
  const [savingChannel, setSavingChannel] = useState(false);
  const [posting, setPosting] = useState(false);

  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [acceptChecked, setAcceptChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Image upload
  const [attachedImageUrl, setAttachedImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  // Edit / delete state
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingBody, setEditingBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);

  // ---------- INIT ----------
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setInitialising(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setError("You must be logged in to use Communities.");
          setLoading(false);
          setInitialising(false);
          return;
        }

        const currentUser = session.user;
        setUser(currentUser);

        await loadAccountName(currentUser);

        // Local-only guidelines flag
        try {
          if (typeof window !== "undefined") {
            const key = `gr8:community:codeAccepted:v${POLICY_VERSION}`;
            const stored = window.localStorage.getItem(key) === "1";
            setNeedsAcceptance(!stored);
          } else {
            setNeedsAcceptance(true);
          }
        } catch {
          setNeedsAcceptance(true);
        }

        const [globalComm, myComm] = await Promise.all([
          ensureGlobalCommunity(currentUser),
          ensureMyCommunity(currentUser),
        ]);

        setGlobalCommunity(globalComm);
        setMyCommunity(myComm);

        const startingCommunityId = globalComm?.id || myComm?.id || null;
        setActiveCommunityId(startingCommunityId);
        setTab(globalComm ? "global" : "my");

        if (startingCommunityId) {
          await loadChannelsAndMaybeSeed(startingCommunityId);
        }
      } catch (err) {
        console.error("Communities init error:", err);
        setError("Unexpected error loading communities.");
      } finally {
        setLoading(false);
        setInitialising(false);
      }
    };

    init();
  }, []);

  // ---------- Brand / account name (via RPC – but we don't trust it anymore for label) ----------
  const loadAccountName = async (currentUser) => {
    try {
      let resolved = "";

      // Call the SQL function we just created
      const { data, error } = await supabase.rpc("get_account_brand");
      if (error) {
        console.warn("get_account_brand() error:", error.message);
      }
      if (data && typeof data === "string" && data.trim().length > 0) {
        resolved = data.trim();
      }

      // Fallbacks
      if (!resolved) {
        const meta = currentUser.user_metadata || {};
        resolved =
          meta.business_name ||
          meta.company ||
          meta.full_name ||
          meta.name ||
          (currentUser.email || "").split("@")[0] ||
          "Member";
      }

      setAccountName(resolved);
      console.log("[Communities] Using display name:", resolved);
    } catch (err) {
      console.error("loadAccountName error:", err);
      const meta = currentUser.user_metadata || {};
      const fallback =
        meta.business_name ||
        meta.company ||
        meta.full_name ||
        meta.name ||
        (currentUser.email || "").split("@")[0] ||
        "Member";
      setAccountName(fallback);
    }
  };

  // Helper – this is the label for *our* posts
  // *** HARD OVERRIDE: NEVER SHOW "support" – ALWAYS SHOW YOUR BUSINESS NAME ***
  const getOwnDisplayName = () => {
    // Change this string if you ever rename the business
    return "Waite and Sea Health and Fitness";
  };

  // ---------- Community helpers ----------
  const ensureGlobalCommunity = async (currentUser) => {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("is_global", true)
        .limit(1);

      if (error) {
        console.error("Error loading global community:", error);
        return null;
      }
      if (data && data.length > 0) return data[0];

      const { data: created, error: createError } = await supabase
        .from("communities")
        .insert({
          owner_id: currentUser.id,
          name: "GR8 RESULT Global Community",
          description:
            "Platform announcements, support, and shared discussion for all GR8 RESULT users.",
          is_public: true,
          is_global: true,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating global community:", createError);
        return null;
      }

      return created;
    } catch (err) {
      console.error("ensureGlobalCommunity unexpected error:", err);
      return null;
    }
  };

  const ensureMyCommunity = async (currentUser) => {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("owner_id", currentUser.id)
        .eq("is_global", false)
        .order("created_at", { ascending: true })
        .limit(1);

      if (error) {
        console.error("Error loading my community:", error);
        return null;
      }
      if (data && data.length > 0) return data[0];

      const { data: created, error: createError } = await supabase
        .from("communities")
        .insert({
          owner_id: currentUser.id,
          name: "My Community",
          description:
            "Create private channels & discussions for your customers and clients.",
          is_public: true,
          is_global: false,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating my community:", createError);
        return null;
      }

      return created;
    } catch (err) {
      console.error("ensureMyCommunity unexpected error:", err);
      return null;
    }
  };

  const dedupeChannels = (rows = []) => {
    const seen = new Set();
    const out = [];
    for (const ch of rows) {
      const key = `${ch.community_id}:${(ch.slug || ch.name || "")
        .toLowerCase()
        .trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ch);
    }
    return out.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  };

  const loadChannelsAndMaybeSeed = async (communityId) => {
    if (!communityId) return;
    try {
      const { data: channelRows, error } = await supabase
        .from("community_channels")
        .select("*")
        .eq("community_id", communityId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading channels:", error);
        setError("Error loading channels.");
        return;
      }

      const existing = dedupeChannels(channelRows || []);

      if (!existing || existing.length === 0) {
        const defaults = [
          {
            community_id: communityId,
            name: "Announcements",
            slug: "announcements",
            description: "Important updates and announcements.",
            sort_order: 1,
          },
          {
            community_id: communityId,
            name: "General Discussion",
            slug: "general",
            description: "Open chat for everyone.",
            sort_order: 2,
          },
          {
            community_id: communityId,
            name: "Q&A",
            slug: "qa",
            description: "Ask questions and get help.",
            sort_order: 3,
          },
        ];

        const { data: inserted, error: insertError } = await supabase
          .from("community_channels")
          .insert(defaults)
          .select();

        if (insertError) {
          console.error("Error seeding channels:", insertError);
          setError("Could not create default channels.");
          return;
        }

        const seeded = dedupeChannels(inserted || []);
        setChannels(seeded);
        if (seeded && seeded[0]) {
          setSelectedChannelId(seeded[0].id);
          await loadPosts(seeded[0].id);
        }
      } else {
        setChannels(existing);
        if (existing[0]) {
          setSelectedChannelId(existing[0].id);
          await loadPosts(existing[0].id);
        }
      }
    } catch (err) {
      console.error("Unexpected error loading channels:", err);
      setError("Unexpected error while loading channels.");
    }
  };

  const loadPosts = async (channelId) => {
    if (!channelId) return;
    try {
      const { data, error } = await supabase
        .from("community_posts")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading posts:", error);
        setError("Error loading posts.");
        return;
      }

      setPosts(data || []);
    } catch (err) {
      console.error("Unexpected error loading posts:", err);
      setError("Unexpected error while loading posts.");
    }
  };

  const currentChannel = channels.find((c) => c.id === selectedChannelId);

  // ---------- Tab + channel handlers ----------
  const handleSwitchTab = async (targetTab) => {
    setTab(targetTab);
    setError("");
    setSelectedChannelId(null);
    setPosts([]);
    setNewPostBody("");
    setAttachedImageUrl("");
    setUploadError("");
    setEditingPostId(null);
    setEditingBody("");

    let communityId = null;
    if (targetTab === "global") communityId = globalCommunity?.id || null;
    if (targetTab === "my") communityId = myCommunity?.id || null;

    setActiveCommunityId(communityId);

    if (communityId) {
      await loadChannelsAndMaybeSeed(communityId);
    }
  };

  const handleSelectChannel = async (channelId) => {
    setSelectedChannelId(channelId);
    setNewPostBody("");
    setAttachedImageUrl("");
    setUploadError("");
    setEditingPostId(null);
    setEditingBody("");
    await loadPosts(channelId);
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!activeCommunityId || !newChannelName.trim()) return;
    setSavingChannel(true);
    setError("");

    try {
      const name = newChannelName.trim();
      const slug = name.toLowerCase().replace(/\s+/g, "-").slice(0, 40);

      const { data, error } = await supabase
        .from("community_channels")
        .insert({
          community_id: activeCommunityId,
          name,
          slug,
          description: "",
          sort_order: channels.length + 1,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating channel:", error);
        setError(error.message || "Could not create channel.");
        return;
      }

      const updated = dedupeChannels([...channels, data]);
      setChannels(updated);
      setNewChannelName("");
      setSelectedChannelId(data.id);
      await loadPosts(data.id);
    } catch (err) {
      console.error("Unexpected error creating channel:", err);
      setError("Unexpected error while creating channel.");
    } finally {
      setSavingChannel(false);
    }
  };

  // ---------- Image upload ----------
  const handleAttachClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadError("");
    setUploadingImage(true);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("community-images")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Image upload error:", uploadError);
        setUploadError(uploadError.message || "Could not upload image.");
        setAttachedImageUrl("");
        return;
      }

      const { data: publicData } = supabase.storage
        .from("community-images")
        .getPublicUrl(filePath);

      const publicUrl = publicData?.publicUrl || "";
      setAttachedImageUrl(publicUrl);
    } catch (err) {
      console.error("Unexpected image upload error:", err);
      setUploadError("Unexpected error uploading image.");
      setAttachedImageUrl("");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---------- Posting ----------
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!selectedChannelId || !user || !newPostBody.trim()) return;
    if (needsAcceptance) return;
    setPosting(true);
    setError("");

    const baseInsert = {
      channel_id: selectedChannelId,
      user_id: user.id,
      body: newPostBody.trim(),
      author_name: getOwnDisplayName(),
      author_email: user?.email || "",
    };

    if (attachedImageUrl) baseInsert.image_url = attachedImageUrl;

    try {
      let insertPayload = baseInsert;

      let { data, error } = await supabase
        .from("community_posts")
        .insert(insertPayload)
        .select()
        .single();

      if (
        error &&
        error.message &&
        /image_url|author_name|author_email/i.test(error.message)
      ) {
        const { image_url, author_name, author_email, ...fallbackInsert } =
          insertPayload;
        ({ data, error } = await supabase
          .from("community_posts")
          .insert(fallbackInsert)
          .select()
          .single());
      }

      if (error) {
        console.error("Error posting message:", error);
        setError(error.message || "Could not post message.");
        return;
      }

      setPosts((prev) => [...prev, data]);
      setNewPostBody("");
      setAttachedImageUrl("");
      setUploadError("");
    } catch (err) {
      console.error("Unexpected error posting message:", err);
      setError("Unexpected error while posting.");
    } finally {
      setPosting(false);
    }
  };

  // ---------- Edit / Delete ----------
  const handleStartEdit = (post) => {
    setEditingPostId(post.id);
    setEditingBody(post.body || "");
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditingBody("");
  };

  const handleSaveEdit = async (postId) => {
    if (!editingBody.trim() || !user) {
      handleCancelEdit();
      return;
    }
    setSavingEdit(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("community_posts")
        .update({ body: editingBody.trim() })
        .eq("id", postId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating post:", error);
        setError(error.message || "Could not update post.");
        return;
      }

      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, body: data.body } : p))
      );
      handleCancelEdit();
    } catch (err) {
      console.error("Unexpected error updating post:", err);
      setError("Unexpected error while updating post.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!user) return;
    setDeletingPostId(postId);
    setError("");

    try {
      const { error } = await supabase
        .from("community_posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting post:", error);
        setError(error.message || "Could not delete post.");
        return;
      }

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (editingPostId === postId) handleCancelEdit();
    } catch (err) {
      console.error("Unexpected error deleting post:", err);
      setError("Unexpected error while deleting post.");
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleAcceptCode = () => {
    setAccepting(true);
    try {
      if (typeof window !== "undefined") {
        const key = `gr8:community:codeAccepted:v${POLICY_VERSION}`;
        window.localStorage.setItem(key, "1");
      }
      setNeedsAcceptance(false);
      setAcceptChecked(false);
    } catch (err) {
      console.error("Error saving local acceptance:", err);
      setNeedsAcceptance(false);
      setAcceptChecked(false);
    } finally {
      setAccepting(false);
    }
  };

  // ---------- UI ----------
  return (
    <>
      <Head>
        <title>Communities | GR8 RESULT</title>
      </Head>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "#020817",
          color: "#e5e7eb",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "28px 28px 44px",
          }}
        >
          {/* Banner */}
          <div
            style={{
              maxWidth: 1320,
              width: "100%",
              margin: "0 auto 24px",
            }}
          >
            <div
              style={{
                background: "#06b6d4",
                borderRadius: 22,
                padding: "34px 36px",
                minHeight: 150,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <CommunitiesIcon />
                <div>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 500,
                      letterSpacing: 0.6,
                    }}
                  >
                    Communities
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      opacity: 0.95,
                      marginTop: 8,
                    }}
                  >
                    Talk with your members, plus the GR8 RESULT global
                    community.
                  </div>
                </div>
              </div>
              <Link href="/dashboard">
                <button
                  style={{
                    border: "1px solid rgba(15,23,42,0.85)",
                    background: "#0f172a",
                    color: "#e5e7eb",
                    padding: "12px 26px",
                    borderRadius: 999,
                    fontSize: 18,
                    cursor: "pointer",
                    fontWeight: 600,
                    boxShadow: "0 10px 24px rgba(15,23,42,0.7)",
                  }}
                >
                  ← Back to Dashboard
                </button>
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div
            style={{
              maxWidth: 1320,
              width: "100%",
              margin: "0 auto 24px",
              display: "flex",
              gap: 14,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            <button
              onClick={() => handleSwitchTab("global")}
              style={{
                padding: "12px 24px",
                borderRadius: 999,
                border: "none",
                background: tab === "global" ? "#06b6d4" : "#1e293b",
                color: "#020617",
                cursor: "pointer",
              }}
            >
              🌎 GR8 RESULT Global
            </button>
            <button
              onClick={() => handleSwitchTab("my")}
              style={{
                padding: "12px 24px",
                borderRadius: 999,
                border: "none",
                background: tab === "my" ? "#06b6d4" : "#1e293b",
                color: "#020617",
                cursor: "pointer",
              }}
            >
              🏠 My Community
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              maxWidth: 1320,
              width: "100%",
              margin: "0 auto",
              flex: 1,
              display: "flex",
              gap: 24,
            }}
          >
            {/* Channels */}
            <div
              style={{
                width: 380,
                minWidth: 340,
                background:
                  "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9))",
                borderRadius: 20,
                padding: "18px 18px 20px",
                border: "1px solid rgba(148,163,184,0.22)",
                boxShadow: "0 20px 42px rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 14,
                  letterSpacing: 0.3,
                }}
              >
                Channels
              </div>

              {loading || initialising ? (
                <div style={{ fontSize: 16, opacity: 0.9 }}>Loading…</div>
              ) : channels.length === 0 ? (
                <div style={{ fontSize: 16, opacity: 0.9 }}>
                  No channels yet.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginBottom: 16,
                    maxHeight: 440,
                    overflowY: "auto",
                  }}
                >
                  {channels.map((ch) => {
                    const active = ch.id === selectedChannelId;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => handleSelectChannel(ch.id)}
                        style={{
                          textAlign: "left",
                          borderRadius: 14,
                          border: active
                            ? "1px solid rgba(56,189,248,0.95)"
                            : "1px solid rgba(31,41,55,0.95)",
                          background: active
                            ? "radial-gradient(circle at top left, rgba(45,212,191,0.22), rgba(15,23,42,0.98))"
                            : "rgba(15,23,42,0.94)",
                          padding: "11px 12px",
                          cursor: "pointer",
                          color: "#e5e7eb",
                          fontSize: 18,
                          boxShadow: active
                            ? "0 0 0 1px rgba(56,189,248,0.65)"
                            : "none",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 18,
                            marginBottom: 2,
                          }}
                        >
                          #{ch.name}
                        </div>
                        {ch.description ? (
                          <div
                            style={{
                              fontSize: 16,
                              opacity: 0.8,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {ch.description}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* New channel */}
              <form onSubmit={handleCreateChannel}>
                <div
                  style={{
                    fontSize: 15,
                    textTransform: "uppercase",
                    letterSpacing: 0.15,
                    opacity: 0.8,
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  New channel
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. Premium members"
                    style={{
                      flex: 1,
                      fontSize: 17,
                      padding: "9px 12px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.5)",
                      background: "#020617",
                      color: "#e5e7eb",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={savingChannel || !newChannelName.trim()}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 999,
                      border: "none",
                      fontSize: 17,
                      fontWeight: 700,
                      cursor:
                        savingChannel || !newChannelName.trim()
                          ? "default"
                          : "pointer",
                      background: savingChannel
                        ? "rgba(148,163,184,0.5)"
                        : "#22c55e",
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {savingChannel ? "Saving…" : "Add"}
                  </button>
                </div>
              </form>
            </div>

            {/* Posts */}
            <div
              style={{
                flex: 1,
                background:
                  "linear-gradient(145deg, rgba(15,23,42,0.97), rgba(15,23,42,0.92))",
                borderRadius: 20,
                padding: "20px 20px 18px",
                border: "1px solid rgba(148,163,184,0.22)",
                boxShadow: "0 22px 46px rgba(0,0,0,0.65)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  marginBottom: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {currentChannel
                      ? `#${currentChannel.name}`
                      : "Select a channel"}
                  </div>
                  <div style={{ fontSize: 18, opacity: 0.86 }}>
                    {currentChannel?.description ||
                      (tab === "global"
                        ? "Global community for all GR8 RESULT users."
                        : "Private community just for your account.")}
                  </div>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    marginBottom: 14,
                    fontSize: 16,
                    color: "#fecaca",
                    background: "rgba(239,68,68,0.18)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    border: "1px solid rgba(239,68,68,0.5)",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Guidelines */}
              {needsAcceptance && (
                <div
                  style={{
                    marginBottom: 14,
                    borderRadius: 16,
                    padding: "14px 16px",
                    background:
                      "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.92))",
                    border: "1px solid rgba(250,204,21,0.7)",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.7)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    Community Guidelines (Please Read)
                  </div>
                  <div
                    style={{
                      fontSize: 17,
                      lineHeight: 1.7,
                      marginBottom: 12,
                      opacity: 0.98,
                    }}
                  >
                    This community is a safe space for everyone. By participating
                    here, you agree that you will NOT:
                    <br />
                    • Post or promote racism, hate speech, bullying or
                    harassment.
                    <br />
                    • Attack, threaten, or abuse other members.
                    <br />
                    • Share illegal content or encourage illegal activity.
                    <br />
                    • Spam or deliberately disrupt discussions.
                    <br />
                    <br />
                    GR8 RESULT reserves the right to remove content or restrict
                    access for any behaviour that violates these guidelines or
                    our terms of use.
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 16,
                      marginBottom: 12,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={acceptChecked}
                      onChange={(e) => setAcceptChecked(e.target.checked)}
                      style={{
                        cursor: "pointer",
                        width: 18,
                        height: 18,
                      }}
                    />
                    <span>
                      I have read and agree to follow these community
                      guidelines.
                    </span>
                  </label>
                  <button
                    onClick={handleAcceptCode}
                    disabled={!acceptChecked || accepting}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 999,
                      border: "none",
                      fontSize: 17,
                      fontWeight: 700,
                      cursor:
                        !acceptChecked || accepting ? "default" : "pointer",
                      background:
                        !acceptChecked || accepting ? "#4b5563" : "#22c55e",
                      color: "#020617",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {accepting ? "Saving…" : "Accept & Continue"}
                  </button>
                </div>
              )}

              {/* Posts list */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  paddingRight: 6,
                  marginBottom: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(30,64,175,0.5)",
                  background:
                    "radial-gradient(circle at top left, rgba(59,130,246,0.23), rgba(15,23,42,0.97))",
                }}
              >
                {loading || initialising ? (
                  <div style={{ padding: 16, fontSize: 17 }}>Loading…</div>
                ) : !currentChannel ? (
                  <div style={{ padding: 16, fontSize: 17 }}>
                    Choose a channel to view messages.
                  </div>
                ) : posts.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 17 }}>
                    No messages yet. Be the first to post!
                  </div>
                ) : (
                  posts.map((post) => {
                    const isOwnPost = user && post.user_id === user.id;
                    const labelName = isOwnPost
                      ? getOwnDisplayName()
                      : post.author_name || "Member";
                    const isEditing = editingPostId === post.id;

                    return (
                      <div
                        key={post.id}
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid rgba(15,23,42,0.8)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 16,
                            opacity: 0.9,
                            marginBottom: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <SubscriberAvatar
                            size={30}
                            lead={{
                              id: post.user_id,
                              name: labelName,
                              email: post.author_email || "",
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>{labelName}</span>
                          <span style={{ opacity: 0.6 }}>·</span>
                          <span>
                            {new Date(
                              post.created_at
                            ).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>

                          {isOwnPost && (
                            <span
                              style={{
                                marginLeft: "auto",
                                display: "flex",
                                gap: 12,
                                fontSize: 14,
                              }}
                            >
                              {!isEditing && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(post)}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#93c5fd",
                                    cursor: "pointer",
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeletePost(post.id)}
                                disabled={deletingPostId === post.id}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "#fecaca",
                                  cursor:
                                    deletingPostId === post.id
                                      ? "default"
                                      : "pointer",
                                }}
                              >
                                {deletingPostId === post.id
                                  ? "Deleting…"
                                  : "Delete"}
                              </button>
                            </span>
                          )}
                        </div>

                        {/* Body / edit area */}
                        {isEditing ? (
                          <div style={{ marginBottom: post.image_url ? 8 : 0 }}>
                            <textarea
                              value={editingBody}
                              onChange={(e) =>
                                setEditingBody(e.target.value || "")
                              }
                              rows={3}
                              style={{
                                width: "100%",
                                resize: "vertical",
                                borderRadius: 10,
                                border:
                                  "1px solid rgba(148,163,184,0.7)",
                                background: "#020617",
                                color: "#e5e7eb",
                                fontSize: 17,
                                padding: "8px 10px",
                                lineHeight: 1.6,
                              }}
                            />
                            <div
                              style={{
                                marginTop: 6,
                                display: "flex",
                                gap: 10,
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={savingEdit}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 999,
                                  border:
                                    "1px solid rgba(148,163,184,0.8)",
                                  background: "transparent",
                                  color: "#e5e7eb",
                                  cursor: savingEdit ? "default" : "pointer",
                                  fontSize: 14,
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(post.id)}
                                disabled={savingEdit || !editingBody.trim()}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: 999,
                                  border: "none",
                                  background: savingEdit
                                    ? "#4b5563"
                                    : "#22c55e",
                                  color: "#020617",
                                  fontSize: 14,
                                  fontWeight: 600,
                                  cursor:
                                    savingEdit || !editingBody.trim()
                                      ? "default"
                                      : "pointer",
                                }}
                              >
                                {savingEdit ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: 19,
                              lineHeight: 1.7,
                              whiteSpace: "pre-wrap",
                              marginBottom: post.image_url ? 8 : 0,
                            }}
                          >
                            {post.body}
                          </div>
                        )}

                        {post.image_url && (
                          <div>
                            <img
                              src={post.image_url}
                              alt="Attachment"
                              style={{
                                maxWidth: "100%",
                                borderRadius: 12,
                                border:
                                  "1px solid rgba(148,163,184,0.55)",
                                boxShadow:
                                  "0 12px 30px rgba(15,23,42,0.85)",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* New post */}
              <form onSubmit={handleCreatePost}>
                <div
                  style={{
                    borderRadius: 16,
                    border: "1px solid rgba(148,163,184,0.5)",
                    background: "#020617",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 12,
                    }}
                  >
                    <textarea
                      value={newPostBody}
                      onChange={(e) => setNewPostBody(e.target.value)}
                      placeholder={
                        needsAcceptance
                          ? "Accept the community guidelines above to post."
                          : currentChannel
                          ? `Post a message to #${currentChannel.name}…`
                          : "Select a channel first…"
                      }
                      rows={3}
                      style={{
                        flex: 1,
                        resize: "none",
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        color: "#e5e7eb",
                        fontSize: 18,
                        lineHeight: 1.6,
                      }}
                      disabled={!currentChannel || posting || needsAcceptance}
                    />

                    <button
                      type="submit"
                      disabled={
                        posting ||
                        !currentChannel ||
                        !newPostBody.trim() ||
                        needsAcceptance
                      }
                      style={{
                        padding: "10px 20px",
                        borderRadius: 999,
                        border: "none",
                        fontSize: 18,
                        fontWeight: 700,
                        cursor:
                          posting ||
                          !currentChannel ||
                          !newPostBody.trim() ||
                          needsAcceptance
                            ? "default"
                            : "pointer",
                        background:
                          posting || needsAcceptance ? "#4b5563" : "#22c55e",
                        color: "#020617",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {posting ? "Sending…" : "Post"}
                    </button>
                  </div>

                  {/* Attach image row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 14,
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={handleAttachClick}
                        disabled={uploadingImage}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          border: "1px solid rgba(148,163,184,0.8)",
                          background: "transparent",
                          color: "#e5e7eb",
                          cursor: uploadingImage ? "default" : "pointer",
                          fontSize: 14,
                        }}
                      >
                        {uploadingImage ? "Uploading…" : "Attach image"}
                      </button>
                      {attachedImageUrl && !uploadingImage && (
                        <span style={{ opacity: 0.85 }}>
                          Image attached ✔
                        </span>
                      )}
                      {uploadError && (
                        <span style={{ color: "#fca5a5" }}>{uploadError}</span>
                      )}
                    </div>
                    <div style={{ opacity: 0.7 }}>
                      Your posts will show as <strong>{getOwnDisplayName()}</strong>
                    </div>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
