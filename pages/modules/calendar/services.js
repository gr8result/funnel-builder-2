import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [usageNotice, setUsageNotice] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setServices(data || []);
    }

    setLoading(false);
  }

  async function createService(e) {
    e.preventDefault();
    setError(null);
    setUsageNotice(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!user || !session?.access_token) return;

    const response = await fetch("/api/calendar/create-service", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name,
        duration_minutes: parseInt(duration, 10),
        price: price ? parseFloat(price) : 0,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload?.error || "Failed to create service");
      if (payload?.policy?.shouldWarn) {
        setUsageNotice(payload.policy);
      }
      return;
    }

    if (payload?.usage?.policy?.shouldWarn) {
      setUsageNotice(payload.usage.policy);
    }

    resetForm();
    loadServices();
  }

  async function updateService(id) {
    setError(null);
    setUsageNotice(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Unauthorized");
      return;
    }

    const response = await fetch("/api/calendar/update-service", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        id,
        name,
        duration_minutes: parseInt(duration, 10),
        price: price ? parseFloat(price) : 0,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload?.error || "Failed to update service");
      return;
    }

    resetForm();
    setEditingId(null);
    loadServices();
  }

  async function deleteService(id) {
    const confirmDelete = confirm("Delete this service?");
    if (!confirmDelete) return;

    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Unauthorized");
      return;
    }

    const response = await fetch("/api/calendar/delete-service", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload?.error || "Failed to delete service");
      return;
    }

    loadServices();
  }

  function startEdit(service) {
    setEditingId(service.id);
    setName(service.name);
    setDuration(service.duration_minutes);
    setPrice(service.price || "");
  }

  function resetForm() {
    setName("");
    setDuration(60);
    setPrice("");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "0 20px 48px", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <div
          style={{
            maxWidth: 1320,
            margin: "16px auto 28px",
            background: "#84cc16",
            borderRadius: 16,
            padding: "22px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Calendar size={48} color="white" />
            <div>
              <h1 style={{ fontSize: 48, fontWeight: 600, color: "white", margin: 0 }}>Calendar Services</h1>
              <div style={{ fontSize: 18, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                Manage the services customers can book.
              </div>
            </div>
          </div>

          <Link href="/modules/calendar/dashboard">
            <button style={{ fontSize: 18, fontWeight: 600, color: "#000000", background: "rgb(255, 255, 255)", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 9, cursor: "pointer" }}>
              ← Calendar Dashboard
            </button>
          </Link>
        </div>

        <div
          style={{
            background: "#161e2b",
            border: "1px solid #243047",
            padding: 32,
            borderRadius: 14,
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontSize: 28, fontWeight: 600, color: "#fff", marginBottom: 24, marginTop: 0 }}>
            {editingId ? "Edit Service" : "Create Service"}
          </h2>

          {usageNotice && (
            <div
              style={{
                background: usageNotice.level === "critical" ? "#7f1d1d" : "#78350f",
                border: "1px solid #243047",
                padding: 15,
                borderRadius: 8,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 16 }}>{usageNotice.message}</span>
              <Link href="/modules/billing/calendar-plans">
                <button style={editButton}>Upgrade Plan</button>
              </Link>
            </div>
          )}

          {error && (
            <div style={{ background: "#7f1d1d", padding: 15, borderRadius: 8, marginBottom: 20, fontSize: 16 }}>
              {error}
            </div>
          )}

          <form
            onSubmit={(e) =>
              editingId
                ? (e.preventDefault(), updateService(editingId))
                : createService(e)
            }
          >
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#9CA3AF" }}>Service Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#9CA3AF" }}>Duration (minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#9CA3AF" }}>Price (AUD)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button type="submit" style={primaryButton}>
              {editingId ? "Update Service" : "Create Service"}
            </button>
          </form>
        </div>

        <div style={{ background: "#161e2b", border: "1px solid #243047", padding: 32, borderRadius: 14 }}>
          <h2 style={{ fontSize: 28, fontWeight: 600, color: "#fff", marginBottom: 24, marginTop: 0 }}>Your Services</h2>

          {loading && <p style={{ fontSize: 16, color: "#6B7280" }}>Loading…</p>}
          {!loading && services.length === 0 && <p style={{ fontSize: 16, color: "#6B7280" }}>No services yet.</p>}

          {services.map((service) => (
            <div
              key={service.id}
              style={{
                padding: 20,
                border: "1px solid #243047",
                borderRadius: 10,
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0c121a",
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{service.name}</div>
                <div style={{ fontSize: 16, color: "#9CA3AF", marginTop: 4 }}>{service.duration_minutes} minutes</div>
                {service.price > 0 && (
                  <div style={{ fontSize: 16, color: "#84cc16", marginTop: 2 }}>${service.price.toFixed(2)}</div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => startEdit(service)}
                  style={editButton}
                >
                  Edit
                </button>

                <button
                  onClick={() => deleteService(service.id)}
                  style={deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 14,
  marginTop: 4,
  borderRadius: 8,
  border: "1px solid #374151",
  background: "rgba(0,0,0,0.4)",
  color: "#fff",
  fontSize: 16,
  boxSizing: "border-box",
};

const primaryButton = {
  padding: "14px 28px",
  background: "#22c55e",
  border: "none",
  borderRadius: 8,
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 18,
};

const editButton = {
  background: "#3b82f6",
  border: "none",
  padding: "8px 16px",
  borderRadius: 6,
  color: "white",
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 600,
};

const deleteButton = {
  background: "#ef4444",
  border: "none",
  padding: "8px 16px",
  borderRadius: 6,
  color: "white",
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 600,
};