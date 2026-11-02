const routingInput = /<input\b[^>]*\bname\s*=\s*(?:["'](?:funnel_id|step_id|list_id|notify_to|submission_key|user_id|owner_user_id|workspace_id)["']|(?:funnel_id|step_id|list_id|notify_to|submission_key|user_id|owner_user_id|workspace_id)(?=\s|\/?>))[^>]*>/gi;

export function stripFunnelRoutingInputs(html = "") {
  return String(html || "").replace(routingInput, "");
}

export function templateContent(html = "") {
  return String(html || "").replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi, (form, attributes, inner) => {
    if (!/\baction\s*=\s*["']\/api\/forms\/submit["']/i.test(attributes)) return form;
    return `<form${attributes}>${stripFunnelRoutingInputs(inner)}</form>`;
  });
}
