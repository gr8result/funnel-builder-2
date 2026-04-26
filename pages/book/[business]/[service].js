import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { Calendar } from "lucide-react";

export default function ServiceBookingPage() {
  const router = useRouter();
  const { service } = router.query;

  const [serviceData, setServiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!service) return;
    loadService();
  }, [service]);

  async function loadService() {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("id", service)
      .single();

    setServiceData(data);
    setLoading(false);
  }

  function generateSlots() {
    if (!serviceData) return [];

    const slots = [];
    const now = new Date();

    for (let d = 0; d < 7; d++) {
      const day = new Date();
      day.setDate(now.getDate() + d);

      for (let hour = 9; hour < 17; hour++) {
        const start = new Date(day);
        start.setHours(hour, 0, 0, 0);

        const end = new Date(start);
        end.setMinutes(end.getMinutes() + serviceData.duration_minutes);

        if (start > now) {
          slots.push({ start, end });
        }
      }
    }

    return slots;
  }

  async function bookSlot() {
    if (!selectedSlot || !name || !email) {
      setMessage("Please complete all fields.");
      return;
    }

    await supabase.from("bookings").insert({
      user_id: serviceData.user_id,
      service_id: serviceData.id,
      client_name: name,
      client_email: email,
      start_datetime: selectedSlot.start.toISOString(),
      end_datetime: selectedSlot.end.toISOString(),
    });

    setMessage("Booking confirmed!");
    setSelectedSlot(null);
    setName("");
    setEmail("");
  }

  if (loading) return <div style={{ padding: 60 }}>Loading...</div>;
  if (!serviceData) return <div style={{ padding: 60 }}>Service not found.</div>;

  const slots = generateSlots();
  const priceAUD = (serviceData.price / 100).toFixed(2);

  return (
    <div style={{ padding: "40px 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Banner */}
        <div
          style={{
            background: "#84cc16",
            padding: "28px 40px",
            borderRadius: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Calendar size={48} color="white" />
            <div>
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 600,
                  color: "white",
                }}
              >
                {serviceData.name}
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: "white",
                  opacity: 0.9,
                  marginTop: 6,
                }}
              >
                Book your session below.
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#111827",
            padding: 40,
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 10 }}>
            Duration: {serviceData.duration_minutes} minutes
          </div>

          <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 20 }}>
            ${priceAUD} AUD
          </div>

          {serviceData.description && (
            <div style={{ marginBottom: 30, opacity: 0.85 }}>
              {serviceData.description}
            </div>
          )}

          <h3 style={{ marginBottom: 20 }}>Select a Time</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
              gap: 12,
            }}
          >
            {slots.map((slot, i) => (
              <button
                key={i}
                onClick={() => setSelectedSlot(slot)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background:
                    selectedSlot?.start === slot.start
                      ? "#22c55e"
                      : "#1f2937",
                  color: "white",
                }}
              >
                {slot.start.toLocaleString()}
              </button>
            ))}
          </div>

          {selectedSlot && (
            <div style={{ marginTop: 40 }}>
              <h3>Enter Your Details</h3>

              <input
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />

              <button onClick={bookSlot} style={primaryButton}>
                Confirm Booking
              </button>
            </div>
          )}

          {message && (
            <div style={{ marginTop: 30, fontWeight: 600 }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  padding: 14,
  marginTop: 15,
  borderRadius: 8,
  border: "1px solid #374151",
  background: "#1f2937",
  color: "white",
  fontSize: 16,
};

const primaryButton = {
  marginTop: 20,
  padding: "14px 24px",
  borderRadius: 8,
  border: "none",
  background: "#22c55e",
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 16,
};