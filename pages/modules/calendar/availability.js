// Merged into /modules/calendar/settings
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AvailabilityRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/modules/calendar/settings"); }, []);
  return null;
}

export default function CalendarAvailability() {
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDays, setSelectedDays] = useState([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  useEffect(() => {
    loadAvailability();
  }, []);

  async function loadAvailability() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("provider_availability")
      .select("*")
      .eq("user_id", user.id)
      .order("day_of_week", { ascending: true });

    if (data) setAvailability(data);

    setLoading(false);
  }

  function toggleDay(dayIndex) {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex]);
    }
  }

  async function addAvailability(e) {
    e.preventDefault();

    if (selectedDays.length === 0) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const inserts = selectedDays.map((day) => ({
      user_id: user.id,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
    }));

    await supabase.from("provider_availability").insert(inserts);

    setSelectedDays([]);
    loadAvailability();
  }

  async function deleteAvailability(id) {
    await supabase
      .from("provider_availability")
      .delete()
      .eq("id", id);

    loadAvailability();
  }

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return (
    <div style={{ padding: "40px 0" }}>
      <div style={{ maxWidth: "1320px", margin: "0 auto" }}>

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
                  fontSize: 48,
                  fontWeight: 600,
                  color: "white",
                }}
              >
                Availability
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: "white",
                  opacity: 0.9,
                  marginTop: 6,
                }}
              >
                Set when clients can book you.
              </div>
            </div>
          </div>

          <Link href="/modules/calendar/dashboard">
            <button
              style={{
                fontSize: 18,
                color: "white",
                background: "#000000",
                border: "none",
                padding: "10px 18px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          </Link>
        </div>

        {/* Add Availability */}
        <div
          style={{
            background: "#111827",
            padding: 40,
            borderRadius: 14,
            marginBottom: 40,
          }}
        >
          <h2 style={{ fontSize: 32, marginBottom: 30 }}>
            Add Availability
          </h2>

          <form onSubmit={addAvailability}>

            {/* Multi Day Selector */}
            <div style={{ marginBottom: 25 }}>
              <label style={{ display: "block", marginBottom: 10 }}>
                Select Days
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {days.map((day, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => toggleDay(index)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: selectedDays.includes(index)
                        ? "2px solid #22c55e"
                        : "1px solid #333",
                      background: selectedDays.includes(index)
                        ? "#22c55e"
                        : "#1f2937",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 30 }}>
              <label>End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button type="submit" style={primaryButton}>
              Save Availability
            </button>
          </form>
        </div>

        {/* Existing Availability */}
        <div
          style={{
            background: "#111827",
            padding: 40,
            borderRadius: 14,
          }}
        >
          <h2 style={{ fontSize: 28, marginBottom: 30 }}>
            Current Availability
          </h2>

          {loading && <p>Loading...</p>}

          {!loading && availability.length === 0 && (
            <p>No availability set yet.</p>
          )}

          {availability.map((slot) => (
            <div
              key={slot.id}
              style={{
                padding: 20,
                border: "1px solid #333",
                borderRadius: 10,
                marginBottom: 15,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{days[slot.day_of_week]}</strong>
                <div>
                  {slot.start_time} – {slot.end_time}
                </div>
              </div>

              <button
                onClick={() => deleteAvailability(slot.id)}
                style={deleteButton}
              >
                Delete
              </button>
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
  marginTop: 8,
  borderRadius: 8,
  border: "1px solid #333",
  background: "#ffffff",
  color: "#000000",
  fontSize: 16,
};

const primaryButton = {
  padding: "14px 28px",
  background: "#22c55e",
  border: "none",
  borderRadius: 8,
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
};

const deleteButton = {
  background: "#ef4444",
  border: "none",
  padding: "8px 16px",
  borderRadius: 6,
  color: "white",
  cursor: "pointer",
};