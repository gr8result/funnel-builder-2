import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

export default function BusinessBookingPage() {
  const router = useRouter();
  const { business } = router.query;

  const [services, setServices] = useState([]);
  const [businessName, setBusinessName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business) return;
    loadData();
  }, [business]);

  async function loadData() {
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("slug", business)
      .single();

    if (!profile) {
      setLoading(false);
      return;
    }

    setBusinessName(profile.full_name);

    const { data: services } = await supabase
      .from("services")
      .select("*")
      .eq("user_id", profile.id)
      .eq("active", true);

    setServices(services || []);
    setLoading(false);
  }

  if (loading) return <div style={{ padding: 60 }}>Loading...</div>;
  if (!businessName) return <div style={{ padding: 60 }}>Business not found.</div>;

  return (
    <div style={{ padding: 60, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 40 }}>{businessName}</h1>
      <h2 style={{ marginTop: 40 }}>Select a Service</h2>

      {services.length === 0 && <p>No services available.</p>}

      {services.map((service) => (
        <div
          key={service.id}
          style={{
            padding: 20,
            border: "1px solid #ddd",
            borderRadius: 10,
            marginTop: 20,
          }}
        >
          <h3>{service.name}</h3>
          <p>{service.duration_minutes} minutes</p>
          <p>${service.price?.toFixed(2)}</p>

          <Link href={`/book/${business}/${service.slug}`}>
            <button style={{ marginTop: 10 }}>Book Now</button>
          </Link>
        </div>
      ))}
    </div>
  );
}