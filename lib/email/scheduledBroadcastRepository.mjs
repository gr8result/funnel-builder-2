export function createScheduledBroadcastRepository(db) {
  return {
    async expireStaleClaims() {
      const { data, error } = await db.rpc("expire_stale_email_broadcast_claims");
      if (error) throw error;
      return Number(data) || 0;
    },

    async listDueDeliveries({ now, limit }) {
      const { data, error } = await db
        .from("email_broadcast_deliveries")
        .select("id,workspace_id,broadcast_id,contact_id,scheduled_at,status")
        .eq("status", "pending")
        .lte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    async claimDelivery({ deliveryId, claimToken }) {
      const { data, error } = await db.rpc("claim_email_broadcast_delivery", {
        p_delivery_id: deliveryId,
        p_claim_token: claimToken,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] || null : data || null;
    },

    async startAttempt({ delivery, broadcast, contact, claimToken, startedAt }) {
      const { data: emailSend, error: emailSendError } = await db
        .from("email_sends")
        .insert({
          user_id: broadcast.user_id,
          workspace_id: delivery.workspace_id,
          broadcast_id: delivery.broadcast_id,
          broadcast_delivery_id: delivery.id,
          contact_id: delivery.contact_id,
          subscriber_id: delivery.contact_id,
          email: contact.email,
          recipient_email: contact.email,
          email_type: "broadcast",
          subject: broadcast.subject,
          status: "processing",
          created_at: startedAt,
        })
        .select("id")
        .single();
      if (emailSendError) throw emailSendError;

      const { data: attempt, error: attemptError } = await db
        .from("email_broadcast_delivery_attempts")
        .insert({
          workspace_id: delivery.workspace_id,
          delivery_id: delivery.id,
          attempt_number: delivery.attempt_count,
          claim_token: claimToken,
          email_send_id: emailSend.id,
          status: "sending",
          started_at: startedAt,
        })
        .select("id")
        .single();
      if (attemptError) {
        await db.from("email_sends").update({ status: "failed", error_message: "Delivery-attempt ledger could not be recorded." }).eq("id", emailSend.id);
        const error = new Error("Delivery-attempt ledger could not be recorded; provider was not called.");
        error.definitiveNoSend = true;
        throw error;
      }
      return { attemptId: attempt.id, emailSendId: emailSend.id };
    },

    async getScheduledBroadcast({ workspaceId, broadcastId }) {
      const { data, error } = await db
        .from("email_broadcasts")
        .select("id,user_id,workspace_id,status,scheduled_at,subject,html_content,from_name,from_email,reply_to,audience_type,list_id,audience_list_table")
        .eq("id", broadcastId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },

    async getCurrentRecipientState({ workspaceId, contactId, listTable, listId }) {
      const [contactResult, membershipResult, consentResult] = await Promise.all([
        db.from("contacts")
          .select("id,workspace_id,email,first_name,last_name,display_name,is_demo")
          .eq("id", contactId)
          .eq("workspace_id", workspaceId)
          .maybeSingle(),
        db.from("contact_list_memberships")
          .select("id,status,purpose,lawful_basis")
          .eq("workspace_id", workspaceId)
          .eq("contact_id", contactId)
          .eq("source_list_table", listTable)
          .eq("source_list_id", String(listId))
          .maybeSingle(),
        db.from("contact_consent_events")
          .select("id,event_type,channel,lawful_basis,source,occurred_at,recorded_at")
          .eq("workspace_id", workspaceId)
          .eq("contact_id", contactId)
          .eq("channel", "email")
          .order("occurred_at", { ascending: false })
          .order("recorded_at", { ascending: false })
          .limit(500),
      ]);
      const error = contactResult.error || membershipResult.error || consentResult.error;
      if (error) throw error;
      const contact = contactResult.data || null;
      let suppressed = false;
      const emailLower = String(contact?.email || "").trim().toLowerCase();
      if (emailLower) {
        const { data: suppression, error: suppressionError } = await db
          .from("email_suppressions")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("email_lower", emailLower)
          .limit(1);
        if (suppressionError) throw suppressionError;
        suppressed = (suppression || []).length > 0;
      }
      return {
        contact,
        membership: membershipResult.data || null,
        consentEvents: consentResult.data || [],
        suppressed,
      };
    },

    async finishDelivery({ delivery, claimToken, status, attemptId, finishedAt, providerMessageId = null, error = null }) {
      const { data, error: completionError } = await db.rpc("complete_email_broadcast_delivery", {
        p_delivery_id: delivery.id,
        p_workspace_id: delivery.workspace_id,
        p_claim_token: claimToken,
        p_attempt_id: attemptId?.attemptId || null,
        p_email_send_id: attemptId?.emailSendId || null,
        p_status: status,
        p_provider_message_id: providerMessageId,
        p_error: error,
        p_finished_at: finishedAt,
      });
      if (completionError) throw completionError;
      if (data !== true) throw new Error("Delivery claim was lost before completion.");
    },

    async finalizeBroadcast({ workspaceId, broadcastId }) {
      const { data, error } = await db.rpc("finalize_email_broadcast", {
        p_workspace_id: workspaceId,
        p_broadcast_id: broadcastId,
      });
      if (error) throw error;
      return data;
    },
  };
}
