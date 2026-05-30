// FILE: /components/CheckoutModal.js
// FULL REPLACEMENT

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function CheckoutModal({
  open,
  onClose,
  course,
  onConfirm,
}) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!open) return;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setEmail(data?.user?.email || "");
    }

    loadUser();
  }, [open]);

  if (!open || !course) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button onClick={onClose} style={styles.close}>
          ✕
        </button>

        <div style={styles.header}>Confirm Your Purchase</div>

        <div style={styles.email}>
          Logged in as: <strong>{email}</strong>
        </div>

        {/* Course Image */}
        <img
          src={course.cover_url}
          alt={course.title}
          style={styles.image}
        />

        {/* Course Title */}
        <div style={styles.title}>{course.title}</div>

        {/* Price */}
        <div style={styles.price}>
          You will be charged: <strong>${course.price}</strong>
        </div>

        <button
          onClick={onConfirm}
          style={styles.checkoutBtn}
        >
          Checkout with Stripe — ${course.price}
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    background: "#1f2937",
    padding: 28,
    borderRadius: 14,
    width: 420,
    textAlign: "center",
    color: "#fff",
    position: "relative",
  },

  close: {
    position: "absolute",
    top: 12,
    right: 12,
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
  },

  header: {
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 12,
  },

  email: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 18,
  },

  image: {
    width: "100%",
    height: 180,
    objectFit: "cover",
    borderRadius: 10,
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 12,
  },

  price: {
    fontSize: 16,
    marginBottom: 20,
  },

  checkoutBtn: {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "12px 18px",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 16,
    cursor: "pointer",
    width: "100%",
  },
};

