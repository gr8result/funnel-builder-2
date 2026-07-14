import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, FileText, RefreshCw, Shield } from "lucide-react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";
import {
  DEFAULT_WARNING_THRESHOLD_PERCENT,
  SELECTION_CATEGORIES,
  calculateSelectionFinancials,
  calculateSessionBudget,
  clientPriceImpactLabel,
  numberValue,
  roundMoney,
} from "../../../lib/builders/selectionBudget";

const INTERNAL_ROLES = new Set(["owner", "admin", "builder_admin", "builder_staff", "interior_designer"]);
const COST_ROLES = new Set(["owner", "admin", "builder_admin", "builder_staff"]);
const GST_RATE = 10;

const initialForm = {
  category: "appliances",
  subcategory: "",
  room: "",
  brand: "",
  productName: "",
  modelNumber: "",
  supplierSku: "",
  manufacturerSku: "",
  imageUrl: "",
  specificationUrl: "",
  installationGuideUrl: "",
  warrantyUrl: "",
  finish: "",
  colour: "",
  description: "",
  includedAllowance: 0,
  supplierCost: 0,
  builderCost: 0,
  installationCost: 0,
  builderMarkupPercent: 20,
  fixedBuilderMarkup: 0,
  gstRate: GST_RATE,
  manualOverridePrice: "",
  selectionStatus: "not_selected",
  supplierId: "",
  supplierName: "",
  sourceQuoteRowId: "",
  requiredBy: "",
  notes: "",
};

export default function BuilderClientSelectionsPage() {
  const { workspaceId, role, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selections, setSelections] = useState([]);
  const [variations, setVariations] = useState([]);
  const [budgetSettings, setBudgetSettings] = useState(null);
  const [budgetSettingsForm, setBudgetSettingsForm] = useState({
    privateUpgradeCeiling: 0,
    warningThresholdPercent: DEFAULT_WARNING_THRESHOLD_PERCENT,
    defaultBuilderMarkupPercent: 20,
    defaultGstRate: GST_RATE,
  });
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [form, setForm] = useState(initialForm);
  const [confirmation, setConfirmation] = useState(null);
  const [showInternalSummary, setShowInternalSummary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isInternal = INTERNAL_ROLES.has(role);
  const canViewCosts = COST_ROLES.has(role);
  const canEditCosts = COST_ROLES.has(role);
  const canEditBudgetSettings = COST_ROLES.has(role);
  const isDesigner = role === "interior_designer";
  const canManageSelections = isInternal || role === "client";
  const safeSelectionColumns = "id, session_id, snapshot_id, category, subcategory, room, title, description, included_in_contract, selected_product_name, selected_colour, selected_finish, status, required_by, selected_at, approved_at, brand, product_name, model_number, image_url, specification_url, installation_guide_url, warranty_url, finish, colour, variation_amount, selection_status, is_included_selection, is_active, created_at, updated_at";
  const internalSelectionColumns = `${safeSelectionColumns}, boq_item_id, variation_id, source_quote_row_id, allowance_amount, selected_supplier_id, selected_supplier_name, selected_details, metadata, supplier_sku, manufacturer_sku, included_allowance, gst_rate, calculated_client_selection_price, manual_override_price, has_manual_override, client_selection_price, notes, supplier_cost, builder_cost, installation_cost, builder_markup_percent, fixed_builder_markup`;

  useEffect(() => {
    if (!workspaceId) {
      setProjects([]);
      setSelectedProjectId("");
      return;
    }

    let cancelled = false;
    async function loadProjects() {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("builder_commercial_projects")
        .select("id, project_name, client_name, site_address, status, currency, original_estimate_total, contract_total, updated_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (loadError) {
        setError(loadError.message || "Could not load projects.");
        setProjects([]);
        setSelectedProjectId("");
      } else {
        const rows = data || [];
        setProjects(rows);
        setSelectedProjectId((current) => rows.find((project) => project.id === current)?.id || rows[0]?.id || "");
      }
      setLoading(false);
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !selectedProjectId) {
      setSnapshots([]);
      setSessions([]);
      setSelections([]);
      setSuppliers([]);
      setVariations([]);
      setBudgetSettings(null);
      setSelectedSnapshotId("");
      setSelectedSessionId("");
      return;
    }

    let cancelled = false;
    async function loadProjectData() {
      setLoading(true);
      setError("");
      const sessionSelect = isInternal
        ? "id, project_id, snapshot_id, session_name, original_estimate_total, private_upgrade_ceiling, current_net_selection_variation, current_updated_estimate_total, warning_threshold_percent, selection_budget_status, status, variation_id, metadata, created_at, updated_at"
        : "id, project_id, snapshot_id, session_name, original_estimate_total, current_net_selection_variation, current_updated_estimate_total, status, variation_id, created_at, updated_at";
      const [snapshotResult, sessionResult, selectionResult, supplierResult, variationResult, settingsResult] = await Promise.all([
        supabase
          .from("builder_estimate_snapshots")
          .select("id, snapshot_number, snapshot_label, status, source_quote_number, final_quote_total, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("snapshot_number", { ascending: false }),
        supabase
          .from("builder_selection_sessions")
          .select(sessionSelect)
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_client_selections")
          .select(isInternal ? internalSelectionColumns : safeSelectionColumns)
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("category", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("builder_suppliers")
          .select("id, name, email, phone, trade_category, status")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true }),
        supabase
          .from("builder_variations")
          .select("id, variation_number, title, status, total, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        isInternal
          ? supabase
              .from("builder_selection_budget_settings")
              .select("id, project_id, session_id, private_upgrade_ceiling, warning_threshold_percent, category_markup_overrides, default_builder_markup_percent, default_gst_rate, updated_at")
              .eq("workspace_id", workspaceId)
              .eq("project_id", selectedProjectId)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;
      const firstError = snapshotResult.error || sessionResult.error || selectionResult.error || supplierResult.error || variationResult.error || settingsResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load selections.");
        setSnapshots([]);
        setSessions([]);
        setSelections([]);
        setSuppliers([]);
        setVariations([]);
      } else {
        const snapshotRows = snapshotResult.data || [];
        const sessionRows = sessionResult.data || [];
        setSnapshots(snapshotRows);
        setSessions(sessionRows);
        setSelections(selectionResult.data || []);
        setSuppliers(supplierResult.data || []);
        setVariations(variationResult.data || []);
        setBudgetSettings((settingsResult.data || [])[0] || null);
        setSelectedSnapshotId((current) => snapshotRows.find((snapshot) => snapshot.id === current)?.id || sessionRows[0]?.snapshot_id || snapshotRows[0]?.id || "");
        setSelectedSessionId((current) => sessionRows.find((session) => session.id === current)?.id || sessionRows[0]?.id || "");
      }
      setLoading(false);
    }

    loadProjectData();
    return () => {
      cancelled = true;
    };
  }, [isInternal, workspaceId, selectedProjectId]);

  useEffect(() => {
    if (!workspaceId || !selectedProjectId || !selectedSnapshotId) {
      setBoqItems([]);
      return;
    }

    let cancelled = false;
    async function loadBoqItems() {
      const { data, error: loadError } = await supabase
        .from("builder_boq_items")
        .select("id, source_quote_row_id, source_section_name, item_name, description, quantity, unit, unit_rate, line_total, status, sort_order")
        .eq("workspace_id", workspaceId)
        .eq("project_id", selectedProjectId)
        .eq("snapshot_id", selectedSnapshotId)
        .order("sort_order", { ascending: true });

      if (cancelled) return;
      if (loadError) {
        setError(loadError.message || "Could not load BOQ rows.");
        setBoqItems([]);
      } else {
        setBoqItems(data || []);
      }
    }

    loadBoqItems();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId, selectedSnapshotId]);

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId) || null, [projects, selectedProjectId]);
  const selectedSnapshot = useMemo(() => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || null, [snapshots, selectedSnapshotId]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedSessionId) || null, [sessions, selectedSessionId]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);

  useEffect(() => {
    setBudgetSettingsForm({
      privateUpgradeCeiling: selectedSession?.private_upgrade_ceiling ?? budgetSettings?.private_upgrade_ceiling ?? 0,
      warningThresholdPercent: selectedSession?.warning_threshold_percent ?? budgetSettings?.warning_threshold_percent ?? DEFAULT_WARNING_THRESHOLD_PERCENT,
      defaultBuilderMarkupPercent: budgetSettings?.default_builder_markup_percent ?? 20,
      defaultGstRate: budgetSettings?.default_gst_rate ?? GST_RATE,
    });
  }, [budgetSettings, selectedSession]);

  useEffect(() => {
    if (!budgetSettings) return;
    setForm((current) => ({
      ...current,
      builderMarkupPercent: current.builderMarkupPercent === initialForm.builderMarkupPercent
        ? budgetSettings.default_builder_markup_percent ?? current.builderMarkupPercent
        : current.builderMarkupPercent,
      gstRate: current.gstRate === initialForm.gstRate
        ? budgetSettings.default_gst_rate ?? current.gstRate
        : current.gstRate,
    }));
  }, [budgetSettings]);

  const sessionSelections = useMemo(() => {
    return selections.filter((selection) => {
      if (selectedSessionId) return selection.session_id === selectedSessionId;
      if (selectedSnapshotId) return selection.snapshot_id === selectedSnapshotId;
      return true;
    });
  }, [selectedSessionId, selectedSnapshotId, selections]);

  const activeSelections = useMemo(
    () => sessionSelections.filter((selection) => selection.is_active !== false && !["replaced", "removed"].includes(selection.selection_status)),
    [sessionSelections]
  );

  const budget = useMemo(() => {
    const originalEstimateTotal = selectedSession?.original_estimate_total || selectedSnapshot?.final_quote_total || selectedProject?.original_estimate_total || selectedProject?.contract_total || 0;
    return calculateSessionBudget({
      originalEstimateTotal,
      privateUpgradeCeiling: selectedSession?.private_upgrade_ceiling || 0,
      warningThresholdPercent: selectedSession?.warning_threshold_percent || DEFAULT_WARNING_THRESHOLD_PERCENT,
      selections: activeSelections,
    });
  }, [activeSelections, selectedProject, selectedSession, selectedSnapshot]);

  const categorySummaries = useMemo(() => {
    const map = new Map();
    activeSelections.forEach((selection) => {
      const key = selection.category || "other";
      const current = map.get(key) || { category: key, originalAllowance: 0, selectedValue: 0, netDifference: 0, rows: [] };
      current.originalAllowance += numberValue(selection.included_allowance || selection.allowance_amount);
      current.selectedValue += numberValue(selection.client_selection_price || selection.selected_details?.clientSelectionPrice);
      current.netDifference += numberValue(selection.variation_amount || selection.selected_details?.variationAmount);
      current.rows.push(selection);
      map.set(key, current);
    });
    return Array.from(map.values()).map((summary) => ({
      ...summary,
      originalAllowance: roundMoney(summary.originalAllowance),
      selectedValue: roundMoney(summary.selectedValue),
      netDifference: roundMoney(summary.netDifference),
    }));
  }, [activeSelections]);

  const filteredSelections = useMemo(() => {
    return sessionSelections.filter((selection) => categoryFilter === "all" || selection.category === categoryFilter);
  }, [categoryFilter, sessionSelections]);

  const formFinancials = useMemo(() => calculateSelectionFinancials(form), [form]);
  const activeSelectedByCategory = useMemo(() => {
    const map = new Map();
    activeSelections.forEach((selection) => {
      if (["selected", "approved"].includes(selection.selection_status)) map.set(selection.category || "other", selection);
    });
    return map;
  }, [activeSelections]);

  function updateForm(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "supplierId") next.supplierName = supplierById.get(value)?.name || next.supplierName;
      if (field === "category") {
        const override = budgetSettings?.category_markup_overrides?.[value] ?? selectedSession?.metadata?.categoryMarkupOverrides?.[value];
        if (override !== undefined && override !== null) next.builderMarkupPercent = override;
      }
      if (field === "sourceQuoteRowId") {
        const source = boqItems.find((item) => item.source_quote_row_id === value || item.id === value);
        if (source) {
          next.productName = next.productName || source.item_name || "";
          next.description = next.description || source.description || source.item_name || "";
          next.includedAllowance = next.includedAllowance || source.line_total || 0;
          next.category = categoryFromSource(source.source_section_name) || next.category;
        }
      }
      return next;
    });
  }

  async function ensureSession() {
    if (selectedSession) return selectedSession;
    if (!workspaceId || !selectedProjectId || !selectedSnapshotId) throw new Error("Select a project and estimate snapshot first.");

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const originalEstimateTotal = numberValue(selectedSnapshot?.final_quote_total || selectedProject?.original_estimate_total || selectedProject?.contract_total);
    const payload = {
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      snapshot_id: selectedSnapshotId,
      session_name: `${selectedProject?.project_name || "Project"} Selections`,
      original_estimate_total: originalEstimateTotal,
      private_upgrade_ceiling: 0,
      current_net_selection_variation: 0,
      current_updated_estimate_total: originalEstimateTotal,
      warning_threshold_percent: DEFAULT_WARNING_THRESHOLD_PERCENT,
      selection_budget_status: "within_budget",
      created_by: userId,
      updated_by: userId,
    };
    const { data, error: insertError } = await supabase.from("builder_selection_sessions").insert(payload).select("*").single();
    if (insertError) throw insertError;
    setSessions((current) => [data, ...current]);
    setSelectedSessionId(data.id);
    return data;
  }

  async function saveBudgetSettings() {
    if (!canEditBudgetSettings) {
      setError("Only builder roles can edit private budget settings.");
      return;
    }
    if (!workspaceId || !selectedProjectId) {
      setError("Select a project before saving budget settings.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const session = await ensureSession();
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const nextBudget = calculateSessionBudget({
        originalEstimateTotal: session.original_estimate_total,
        privateUpgradeCeiling: budgetSettingsForm.privateUpgradeCeiling,
        warningThresholdPercent: budgetSettingsForm.warningThresholdPercent,
        selections: activeSelections,
      });
      const now = new Date().toISOString();
      const oldValue = {
        privateUpgradeCeiling: selectedSession?.private_upgrade_ceiling ?? budgetSettings?.private_upgrade_ceiling ?? 0,
        warningThresholdPercent: selectedSession?.warning_threshold_percent ?? budgetSettings?.warning_threshold_percent ?? DEFAULT_WARNING_THRESHOLD_PERCENT,
        defaultBuilderMarkupPercent: budgetSettings?.default_builder_markup_percent ?? 20,
        defaultGstRate: budgetSettings?.default_gst_rate ?? GST_RATE,
      };
      const sessionPayload = {
        private_upgrade_ceiling: numberValue(budgetSettingsForm.privateUpgradeCeiling),
        warning_threshold_percent: numberValue(budgetSettingsForm.warningThresholdPercent) || DEFAULT_WARNING_THRESHOLD_PERCENT,
        current_net_selection_variation: nextBudget.currentNetSelectionVariation,
        current_updated_estimate_total: nextBudget.currentUpdatedEstimateTotal,
        selection_budget_status: nextBudget.selectionBudgetStatus,
        updated_by: userId,
        updated_at: now,
      };
      const settingsPayload = {
        workspace_id: workspaceId,
        project_id: selectedProjectId,
        session_id: session.id,
        private_upgrade_ceiling: sessionPayload.private_upgrade_ceiling,
        warning_threshold_percent: sessionPayload.warning_threshold_percent,
        category_markup_overrides: budgetSettings?.category_markup_overrides || {},
        default_builder_markup_percent: numberValue(budgetSettingsForm.defaultBuilderMarkupPercent),
        default_gst_rate: numberValue(budgetSettingsForm.defaultGstRate) || GST_RATE,
        created_by: userId,
        updated_by: userId,
        updated_at: now,
      };

      const [{ data: updatedSession, error: sessionError }, { data: updatedSettings, error: settingsError }] = await Promise.all([
        supabase
          .from("builder_selection_sessions")
          .update(sessionPayload)
          .eq("workspace_id", workspaceId)
          .eq("id", session.id)
          .select("*")
          .single(),
        supabase
          .from("builder_selection_budget_settings")
          .upsert(settingsPayload, { onConflict: "workspace_id,project_id,session_id" })
          .select("*")
          .single(),
      ]);
      if (sessionError) throw sessionError;
      if (settingsError) throw settingsError;

      setSessions((current) => current.map((row) => row.id === session.id ? updatedSession : row));
      setBudgetSettings(updatedSettings);
      await auditHistory({
        sessionId: session.id,
        action: "upgrade_ceiling_changed",
        userId,
        oldValue,
        newValue: settingsPayload,
        reason: "Private budget settings updated",
      });
      setSuccess("Private budget settings saved.");
    } catch (settingsError) {
      setError(settingsError.message || "Could not save private budget settings.");
    } finally {
      setSaving(false);
    }
  }

  async function createSelection() {
    if (!workspaceId || !selectedProjectId || !selectedSnapshotId) {
      setError("Select a workspace, project and estimate snapshot first.");
      return;
    }
    if (!form.productName.trim()) {
      setError("Product name is required.");
      return;
    }
    if (!canManageSelections) {
      setError("Your role cannot update selections.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const session = await ensureSession();
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const supplier = form.supplierId ? supplierById.get(form.supplierId) : null;
      const source = form.sourceQuoteRowId ? boqItems.find((item) => item.source_quote_row_id === form.sourceQuoteRowId || item.id === form.sourceQuoteRowId) : null;
      const financials = calculateSelectionFinancials(form);
      const payload = {
        workspace_id: workspaceId,
        project_id: selectedProjectId,
        snapshot_id: selectedSnapshotId,
        session_id: session.id,
        boq_item_id: source?.id || null,
        source_quote_row_id: source?.source_quote_row_id || form.sourceQuoteRowId || null,
        category: form.category,
        subcategory: form.subcategory.trim(),
        room: form.room.trim(),
        title: form.productName.trim(),
        description: form.description.trim(),
        included_in_contract: financials.variationAmount === 0,
        allowance_amount: financials.includedAllowance,
        selected_product_name: form.productName.trim(),
        selected_supplier_id: form.supplierId || null,
        selected_supplier_name: supplier?.name || form.supplierName.trim(),
        selected_colour: form.colour.trim(),
        selected_finish: form.finish.trim(),
        brand: form.brand.trim(),
        product_name: form.productName.trim(),
        model_number: form.modelNumber.trim(),
        supplier_sku: form.supplierSku.trim(),
        manufacturer_sku: form.manufacturerSku.trim(),
        image_url: form.imageUrl.trim(),
        specification_url: form.specificationUrl.trim(),
        installation_guide_url: form.installationGuideUrl.trim(),
        warranty_url: form.warrantyUrl.trim(),
        finish: form.finish.trim(),
        colour: form.colour.trim(),
        included_allowance: financials.includedAllowance,
        supplier_cost: canEditCosts ? numberValue(form.supplierCost) : 0,
        builder_cost: canEditCosts ? numberValue(form.builderCost) : 0,
        installation_cost: numberValue(form.installationCost),
        builder_markup_percent: canEditCosts ? numberValue(form.builderMarkupPercent) : 0,
        fixed_builder_markup: canEditCosts ? numberValue(form.fixedBuilderMarkup) : 0,
        gst_rate: financials.gstRate,
        calculated_client_selection_price: financials.calculatedClientSelectionPrice,
        manual_override_price: financials.hasManualOverride ? financials.clientSelectionPrice : null,
        has_manual_override: financials.hasManualOverride,
        client_selection_price: financials.clientSelectionPrice,
        variation_amount: financials.variationAmount,
        selection_status: form.selectionStatus,
        is_included_selection: financials.isIncludedSelection,
        is_active: true,
        status: form.selectionStatus === "not_selected" ? "pending" : form.selectionStatus,
        selected_at: ["selected", "approved"].includes(form.selectionStatus) ? new Date().toISOString() : null,
        approved_at: form.selectionStatus === "approved" ? new Date().toISOString() : null,
        selected_details: {
          clientSelectionPrice: financials.clientSelectionPrice,
          calculatedClientSelectionPrice: financials.calculatedClientSelectionPrice,
          variationAmount: financials.variationAmount,
          impactType: financials.impactType,
          hasManualOverride: financials.hasManualOverride,
        },
        required_by: form.requiredBy || null,
        metadata: { source: "selections_budget_manager" },
        notes: isInternal ? form.notes.trim() : "",
        created_by: userId,
        updated_by: userId,
      };

      const { data, error: insertError } = await supabase
        .from("builder_client_selections")
        .insert(payload)
        .select("*")
        .single();
      if (insertError) throw insertError;

      const nextSelections = [data, ...activeSelections];
      await persistBudget(session.id, nextSelections, userId);
      await auditHistory({
        sessionId: session.id,
        selectionId: data.id,
        action: "product_selected",
        userId,
        oldValue: null,
        newValue: payload,
        newVariation: financials.variationAmount,
        reason: "Selection product created",
      });
      setSelections((current) => [data, ...current]);
      setForm({
        ...initialForm,
        category: form.category,
        builderMarkupPercent: budgetSettings?.default_builder_markup_percent ?? initialForm.builderMarkupPercent,
        gstRate: budgetSettings?.default_gst_rate ?? initialForm.gstRate,
      });
      setSuccess(`Selection "${data.product_name || data.title}" saved.`);
    } catch (saveError) {
      setError(saveError.message || "Could not save selection.");
    } finally {
      setSaving(false);
    }
  }

  function openSelectionConfirm(selection) {
    const current = budget.currentNetSelectionVariation;
    const previous = activeSelectedByCategory.get(selection.category);
    const previousVariation = previous && previous.id !== selection.id ? numberValue(previous.variation_amount) : 0;
    const next = roundMoney(current - previousVariation + numberValue(selection.variation_amount));
    setConfirmation({ selection, previous: previous?.id !== selection.id ? previous : null, current, next });
  }

  async function confirmSelection() {
    if (!confirmation) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const { selection, previous } = confirmation;
      const now = new Date().toISOString();

      if (previous) {
        const { error: previousError } = await supabase
          .from("builder_client_selections")
          .update({ selection_status: "replaced", status: "changed", is_active: false, updated_by: userId, updated_at: now })
          .eq("workspace_id", workspaceId)
          .eq("id", previous.id);
        if (previousError) throw previousError;
      }

      const { data: updated, error: updateError } = await supabase
        .from("builder_client_selections")
        .update({ selection_status: "selected", status: "selected", selected_at: now, is_active: true, updated_by: userId, updated_at: now })
        .eq("workspace_id", workspaceId)
        .eq("id", selection.id)
        .select(isInternal ? internalSelectionColumns : safeSelectionColumns)
        .single();
      if (updateError) throw updateError;

      const nextAll = selections.map((row) => {
        if (previous && row.id === previous.id) return { ...row, selection_status: "replaced", status: "changed", is_active: false };
        if (row.id === updated.id) return updated;
        return row;
      });
      const nextActive = nextAll.filter((row) => row.session_id === selectedSessionId && row.is_active !== false && !["replaced", "removed"].includes(row.selection_status));
      await persistBudget(selectedSessionId, nextActive, userId);
      await auditHistory({
        sessionId: selectedSessionId,
        selectionId: updated.id,
        previousSelectionId: previous?.id || null,
        replacementSelectionId: updated.id,
        action: previous ? "product_replaced" : "product_selected",
        userId,
        oldValue: previous || null,
        newValue: updated,
        previousVariation: previous ? numberValue(previous.variation_amount) : null,
        newVariation: numberValue(updated.variation_amount),
        reason: previous ? "Selection replaced from product card" : "Selection confirmed from product card",
      });
      setSelections(nextAll);
      setConfirmation(null);
      setSuccess(previous ? "Selection replaced and budget totals updated." : "Selection confirmed and budget totals updated.");
    } catch (confirmError) {
      setError(confirmError.message || "Could not confirm selection.");
    } finally {
      setSaving(false);
    }
  }

  async function persistBudget(sessionId, rows, userId) {
    if (!sessionId) return;
    const nextBudget = calculateSessionBudget({
      originalEstimateTotal: budget.originalEstimateTotal,
      privateUpgradeCeiling: selectedSession?.private_upgrade_ceiling || 0,
      warningThresholdPercent: selectedSession?.warning_threshold_percent || DEFAULT_WARNING_THRESHOLD_PERCENT,
      selections: rows,
    });
    const sessionPayload = {
      current_net_selection_variation: nextBudget.currentNetSelectionVariation,
      current_updated_estimate_total: nextBudget.currentUpdatedEstimateTotal,
      selection_budget_status: nextBudget.selectionBudgetStatus,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    const { data, error: updateError } = await supabase
      .from("builder_selection_sessions")
      .update(sessionPayload)
      .eq("workspace_id", workspaceId)
      .eq("id", sessionId)
      .select("*")
      .single();
    if (updateError) throw updateError;
    setSessions((current) => current.map((session) => session.id === sessionId ? data : session));

    const summaries = categorySummariesFromRows(rows).map((summary) => ({
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      session_id: sessionId,
      category: summary.category,
      original_allowance: summary.originalAllowance,
      selected_value: summary.selectedValue,
      net_difference: summary.netDifference,
      created_by: userId,
      updated_by: userId,
    }));
    if (isInternal && summaries.length) {
      await supabase.from("builder_selection_categories").upsert(summaries, { onConflict: "workspace_id,session_id,category" });
    }
  }

  async function auditHistory({ sessionId, selectionId = null, previousSelectionId = null, replacementSelectionId = null, action, userId, oldValue, newValue, previousVariation = null, newVariation = null, reason = "" }) {
    await supabase.from("builder_selection_history").insert({
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      session_id: sessionId,
      selection_id: selectionId,
      previous_selection_id: previousSelectionId,
      replacement_selection_id: replacementSelectionId,
      action,
      user_id: userId,
      user_role: role,
      changed_by: userId,
      previous_variation: previousVariation,
      new_variation: newVariation,
      old_value: oldValue,
      new_value: newValue,
      reason,
      created_by: userId,
      updated_by: userId,
    });
  }

  async function createDraftVariationFromSummary() {
    if (!isInternal) {
      setError("Only builder and designer roles can create selection variations.");
      return;
    }
    const rows = activeSelections.filter((selection) => numberValue(selection.variation_amount) !== 0);
    if (!rows.length) {
      setError("There are no upgrade or credit lines to send to Variations.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const subtotal = roundMoney(rows.reduce((total, row) => total + variationExGst(row), 0));
      const total = roundMoney(rows.reduce((sum, row) => sum + numberValue(row.variation_amount), 0));
      const gstTotal = roundMoney(total - subtotal);
      const variationPayload = {
        workspace_id: workspaceId,
        project_id: selectedProjectId,
        snapshot_id: selectedSnapshotId,
        variation_number: nextVariationNumber(variations),
        title: "Selections Summary Variation",
        reason: "Client selections above/below original estimate",
        status: "draft",
        subtotal,
        gst_total: gstTotal,
        total,
        margin_total: 0,
        metadata: {
          uiStatus: "draft",
          source: "selections_budget_manager",
          selectionSessionId: selectedSessionId,
          netSelectionVariation: budget.currentNetSelectionVariation,
          originalEstimateTotal: budget.originalEstimateTotal,
          updatedEstimatedPrice: budget.currentUpdatedEstimateTotal,
        },
        notes: "Draft created from approved selections summary. Review before sending or approving.",
        created_by: userId,
        updated_by: userId,
      };
      const { data: variation, error: variationError } = await supabase.from("builder_variations").insert(variationPayload).select("*").single();
      if (variationError) throw variationError;

      const itemPayloads = rows.map((row) => ({
        workspace_id: workspaceId,
        project_id: selectedProjectId,
        variation_id: variation.id,
        snapshot_id: selectedSnapshotId,
        boq_item_id: row.boq_item_id || null,
        source_quote_row_id: row.source_quote_row_id || null,
        source_section_name: titleCase(row.category),
        description: `${titleCase(row.category)} - ${row.brand ? `${row.brand} ` : ""}${row.product_name || row.title}${row.model_number ? ` (${row.model_number})` : ""}`,
        quantity: 1,
        unit: "ea",
        unit_cost: canViewCosts ? numberValue(row.builder_cost) + numberValue(row.installation_cost) : 0,
        unit_price: variationExGst(row),
        gst_rate: numberValue(row.gst_rate || GST_RATE),
        cost_total: canViewCosts ? numberValue(row.builder_cost) + numberValue(row.installation_cost) : 0,
        line_total: variationExGst(row),
        status: "active",
        metadata: {
          source: "selections_budget_manager",
          selectionId: row.id,
          selectionSessionId: selectedSessionId,
          category: row.category,
          includedAllowance: numberValue(row.included_allowance || row.allowance_amount),
          selectedClientPrice: numberValue(row.client_selection_price),
          variationAmount: numberValue(row.variation_amount),
          modelNumber: row.model_number || null,
          imageUrl: row.image_url || null,
        },
        created_by: userId,
      }));
      const { error: itemError } = await supabase.from("builder_variation_items").insert(itemPayloads);
      if (itemError) {
        await supabase.from("builder_variations").delete().eq("workspace_id", workspaceId).eq("id", variation.id);
        throw itemError;
      }

      await supabase
        .from("builder_selection_sessions")
        .update({ status: "variation_created", variation_id: variation.id, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("id", selectedSessionId);
      await auditHistory({
        sessionId: selectedSessionId,
        action: "variation_created",
        userId,
        oldValue: null,
        newValue: variationPayload,
        newVariation: total,
        reason: "Draft variation created from selections summary",
      });
      setVariations((current) => [variation, ...current]);
      setSuccess(`Draft variation ${variation.variation_number} created.`);
    } catch (variationError) {
      setError(variationError.message || "Could not create draft variation.");
    } finally {
      setSaving(false);
    }
  }

  const privateAlert = privateBudgetAlert(budget);

  return (
    <>
      <Head>
        <title>Client Selections Budget Manager</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>Gr8 Result Client Selections</div>
            <h1 style={styles.title}>Selections Budget Manager</h1>
            <p style={styles.subtitle}>Compare product selections against the original estimate while keeping private budget controls visible only to authorised project roles.</p>
          </div>
          <div style={styles.headerActions}>
            <Link href="/modules/builders/selections-book" style={styles.secondaryLink}>Selections Book</Link>
            <Link href="/modules/builders/variations" style={styles.primaryLink}>Variations</Link>
          </div>
        </header>

        <section style={styles.controls}>
          <label style={styles.field}>
            <span style={styles.label}>Project</span>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} style={styles.select} disabled={workspaceLoading || loading || !projects.length}>
              {!projects.length ? <option value="">No projects found</option> : null}
              {projects.map((project) => <option key={project.id} value={project.id}>{project.project_name || "Untitled Project"}{project.client_name ? ` - ${project.client_name}` : ""}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Estimate Snapshot</span>
            <select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)} style={styles.select} disabled={workspaceLoading || loading || !snapshots.length}>
              {!snapshots.length ? <option value="">No snapshots found</option> : null}
              {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>Snapshot {snapshot.snapshot_number}{snapshot.source_quote_number ? ` - ${snapshot.source_quote_number}` : ""}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Selections Session</span>
            <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)} style={styles.select} disabled={workspaceLoading || loading || !sessions.length}>
              {!sessions.length ? <option value="">New session will be created</option> : null}
              {sessions.map((session) => <option key={session.id} value={session.id}>{session.session_name || "Client Selections"} - {titleCase(session.status)}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={styles.select}>
              <option value="all">All categories</option>
              {SELECTION_CATEGORIES.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}
            </select>
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}

        <section style={styles.summaryDock}>
          <FinancialTile label="Original Estimate Price" value={money(budget.originalEstimateTotal, selectedProject?.currency)} />
          <FinancialTile label={budget.currentNetSelectionVariation < 0 ? "Selections Credit" : "Current Selections Above Estimate"} value={signedMoney(budget.currentNetSelectionVariation, selectedProject?.currency)} tone={budget.currentNetSelectionVariation > 0 ? "upgrade" : budget.currentNetSelectionVariation < 0 ? "credit" : ""} />
          <FinancialTile label="Updated Estimated Price" value={money(budget.currentUpdatedEstimateTotal, selectedProject?.currency)} emphasis />
        </section>

        {isInternal ? (
          <section style={styles.privatePanel}>
            <div style={styles.privateHeader}>
              <Shield size={20} />
              <div>
                <h2 style={styles.panelTitle}>Private Budget Panel</h2>
                <p style={styles.panelText}>Visible to builder and interior designer roles only.</p>
              </div>
            </div>
            {privateAlert ? <div style={{ ...styles.privateAlert, ...(budget.selectionBudgetStatus === "over_limit" ? styles.privateAlertDanger : {}) }}><AlertTriangle size={18} />{privateAlert}</div> : null}
            <div style={styles.privateGrid}>
              <MiniTotal label="Private Upgrade Ceiling" value={money(budget.privateUpgradeCeiling, selectedProject?.currency)} />
              <MiniTotal label="Current Net Upgrades" value={signedMoney(budget.currentNetSelectionVariation, selectedProject?.currency)} />
              <MiniTotal label="Remaining Capacity" value={money(budget.remainingCapacity, selectedProject?.currency)} tone={budget.remainingCapacity < 0 ? "bad" : "good"} />
              <MiniTotal label="Percentage Used" value={`${budget.percentageUsed}%`} />
              <MiniTotal label="Budget Status" value={titleCase(budget.selectionBudgetStatus)} tone={budget.selectionBudgetStatus === "over_limit" ? "bad" : budget.selectionBudgetStatus === "within_budget" ? "good" : ""} />
            </div>
            {canEditBudgetSettings ? (
              <div style={styles.settingsGrid}>
                <NumberField label="Private Upgrade Ceiling" value={budgetSettingsForm.privateUpgradeCeiling} onChange={(value) => setBudgetSettingsForm((current) => ({ ...current, privateUpgradeCeiling: value }))} />
                <NumberField label="Warning Threshold %" value={budgetSettingsForm.warningThresholdPercent} onChange={(value) => setBudgetSettingsForm((current) => ({ ...current, warningThresholdPercent: value }))} />
                <NumberField label="Default Markup %" value={budgetSettingsForm.defaultBuilderMarkupPercent} onChange={(value) => setBudgetSettingsForm((current) => ({ ...current, defaultBuilderMarkupPercent: value }))} />
                <NumberField label="Default GST %" value={budgetSettingsForm.defaultGstRate} onChange={(value) => setBudgetSettingsForm((current) => ({ ...current, defaultGstRate: value }))} />
                <button type="button" onClick={saveBudgetSettings} disabled={saving} style={styles.primaryDarkButton}>Save Settings</button>
              </div>
            ) : null}
          </section>
        ) : null}

        <section style={styles.layout}>
          {isInternal ? (
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.panelTitle}>Add Product Option</h2>
                  <p style={styles.panelText}>{isDesigner ? "Designer access can create selections and view budget warnings, but cost and margin fields remain controlled by builder roles." : "Store calculated and overridden client prices without exposing cost fields to clients."}</p>
                </div>
              </div>
              <div style={styles.formGrid}>
                <SelectField label="Category" value={form.category} onChange={(value) => updateForm("category", value)} options={SELECTION_CATEGORIES.map((category) => ({ value: category, label: titleCase(category) }))} />
                <TextField label="Room" value={form.room} onChange={(value) => updateForm("room", value)} />
                <TextField label="Brand" value={form.brand} onChange={(value) => updateForm("brand", value)} />
                <TextField label="Product Name" value={form.productName} onChange={(value) => updateForm("productName", value)} />
                <TextField label="Model Number" value={form.modelNumber} onChange={(value) => updateForm("modelNumber", value)} />
                <TextField label="Finish / Colour" value={form.finish || form.colour} onChange={(value) => { updateForm("finish", value); updateForm("colour", value); }} />
                <TextField label="Image URL" value={form.imageUrl} onChange={(value) => updateForm("imageUrl", value)} wide />
                <TextField label="Specification URL" value={form.specificationUrl} onChange={(value) => updateForm("specificationUrl", value)} />
                <TextField label="Warranty URL" value={form.warrantyUrl} onChange={(value) => updateForm("warrantyUrl", value)} />
                <TextField label="Installation Guide URL" value={form.installationGuideUrl} onChange={(value) => updateForm("installationGuideUrl", value)} />
                <SelectField label="Supplier" value={form.supplierId} onChange={(value) => updateForm("supplierId", value)} options={[{ value: "", label: "Manual supplier" }, ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))]} />
                <TextField label="Supplier Name" value={form.supplierName} onChange={(value) => updateForm("supplierName", value)} />
                <SelectField label="Source Quote Row" value={form.sourceQuoteRowId} onChange={(value) => updateForm("sourceQuoteRowId", value)} options={[{ value: "", label: "No source row" }, ...boqItems.map((item) => ({ value: item.source_quote_row_id || item.id, label: `${item.source_quote_row_id || item.id} - ${item.item_name || item.description}` }))]} wide />
                <TextArea label="Brief Description" value={form.description} onChange={(value) => updateForm("description", value)} wide />
                <NumberField label="Included Allowance" value={form.includedAllowance} onChange={(value) => updateForm("includedAllowance", value)} />
                {canEditCosts ? (
                  <>
                    <NumberField label="Supplier Cost" value={form.supplierCost} onChange={(value) => updateForm("supplierCost", value)} />
                    <NumberField label="Builder Cost" value={form.builderCost} onChange={(value) => updateForm("builderCost", value)} />
                    <NumberField label="Installation Cost" value={form.installationCost} onChange={(value) => updateForm("installationCost", value)} />
                    <NumberField label="Builder Markup %" value={form.builderMarkupPercent} onChange={(value) => updateForm("builderMarkupPercent", value)} />
                    <NumberField label="Fixed Builder Markup" value={form.fixedBuilderMarkup} onChange={(value) => updateForm("fixedBuilderMarkup", value)} />
                  </>
                ) : null}
                <NumberField label="GST Rate %" value={form.gstRate} onChange={(value) => updateForm("gstRate", value)} />
                <NumberField label="Manual Final Price" value={form.manualOverridePrice} onChange={(value) => updateForm("manualOverridePrice", value)} />
                <SelectField label="Selection Status" value={form.selectionStatus} onChange={(value) => updateForm("selectionStatus", value)} options={["not_selected", "selected", "approved"].map((status) => ({ value: status, label: titleCase(status) }))} />
                <TextArea label="Internal Notes" value={form.notes} onChange={(value) => updateForm("notes", value)} wide />
              </div>
              <div style={styles.calcStrip}>
                <MiniTotal label="Client Price" value={money(formFinancials.clientSelectionPrice, selectedProject?.currency)} />
                <MiniTotal label="Price Impact" value={clientPriceImpactLabel(formFinancials.variationAmount)} tone={formFinancials.variationAmount > 0 ? "bad" : formFinancials.variationAmount < 0 ? "good" : ""} />
                {canViewCosts ? <MiniTotal label="Calculated Ex GST" value={money(formFinancials.priceBeforeGst, selectedProject?.currency)} /> : null}
              </div>
              <button type="button" onClick={createSelection} disabled={saving || loading} style={{ ...styles.createButton, ...((saving || loading) ? styles.disabledButton : {}) }}>
                {saving ? "Saving..." : "Save Product Option"}
              </button>
            </section>
          ) : null}

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Selection Product Cards</h2>
                <p style={styles.panelText}>{filteredSelections.length} product option{filteredSelections.length === 1 ? "" : "s"} available for this session.</p>
              </div>
            </div>
            {!filteredSelections.length ? <div style={styles.empty}>No selections have been created for this project yet.</div> : null}
            <div style={styles.productGrid}>
              {filteredSelections.map((selection) => (
                <ProductCard
                  key={selection.id}
                  selection={selection}
                  currency={selectedProject?.currency}
                  isInternal={isInternal}
                  canViewCosts={canViewCosts}
                  onSelect={() => openSelectionConfirm(selection)}
                />
              ))}
            </div>
          </section>
        </section>

        <section style={styles.summarySection}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>{isInternal && showInternalSummary ? "Internal Summary" : "Client Summary"}</h2>
              <p style={styles.panelText}>Category totals are grouped from active selections only.</p>
            </div>
            <div style={styles.headerActions}>
              {isInternal ? <button type="button" onClick={() => setShowInternalSummary((value) => !value)} style={styles.utilityButton}>{showInternalSummary ? "Client Summary" : "Internal Summary"}</button> : null}
              {isInternal ? <button type="button" onClick={createDraftVariationFromSummary} disabled={saving || !activeSelections.length} style={styles.primaryDarkButton}><FileText size={16} />Create Draft Variation</button> : null}
            </div>
          </div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  {isInternal && showInternalSummary ? <th>Included Amount</th> : null}
                  {isInternal && showInternalSummary ? <th>Selected Amount</th> : null}
                  <th>{isInternal && showInternalSummary ? "Difference" : "Client Impact"}</th>
                </tr>
              </thead>
              <tbody>
                {categorySummaries.map((summary) => (
                  <tr key={summary.category}>
                    <td>{titleCase(summary.category)}</td>
                    {isInternal && showInternalSummary ? <td>{money(summary.originalAllowance, selectedProject?.currency)}</td> : null}
                    {isInternal && showInternalSummary ? <td>{money(summary.selectedValue, selectedProject?.currency)}</td> : null}
                    <td>{isInternal && showInternalSummary ? signedMoney(summary.netDifference, selectedProject?.currency) : categoryClientLabel(summary.netDifference, selectedProject?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={styles.bottomTotals}>
            <MiniTotal label="Original Estimate" value={money(budget.originalEstimateTotal, selectedProject?.currency)} />
            <MiniTotal label="Total Selection Upgrades" value={signedMoney(totalBySign(activeSelections, 1), selectedProject?.currency)} />
            <MiniTotal label="Total Selection Credits" value={signedMoney(totalBySign(activeSelections, -1), selectedProject?.currency)} />
            <MiniTotal label="Net Selection Variation" value={signedMoney(budget.currentNetSelectionVariation, selectedProject?.currency)} />
            <MiniTotal label="Updated Estimated Price" value={money(budget.currentUpdatedEstimateTotal, selectedProject?.currency)} />
          </div>
        </section>

        {confirmation ? (
          <div style={styles.modalBackdrop}>
            <div style={styles.modal}>
              <h2 style={styles.modalTitle}>{confirmation.previous ? "Replace Selection" : "Confirm Selection"}</h2>
              <p style={styles.modalText}>
                This selection will {numberValue(confirmation.selection.variation_amount) >= 0 ? "add" : "credit"} {money(Math.abs(numberValue(confirmation.selection.variation_amount)), selectedProject?.currency)} {numberValue(confirmation.selection.variation_amount) >= 0 ? "above" : "below"} the amount included in the original estimate.
              </p>
              <div style={styles.modalTotals}>
                <MiniTotal label="Current selections above estimate" value={signedMoney(confirmation.current, selectedProject?.currency)} />
                <MiniTotal label="After this change" value={signedMoney(confirmation.next, selectedProject?.currency)} />
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setConfirmation(null)} style={styles.utilityButton}>Choose Another</button>
                <button type="button" onClick={confirmSelection} disabled={saving} style={styles.primaryDarkButton}><Check size={16} />Confirm Selection</button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}

function ProductCard({ selection, currency, isInternal, canViewCosts, onSelect }) {
  const variation = numberValue(selection.variation_amount || selection.selected_details?.variationAmount);
  const status = selection.selection_status || selection.status || "not_selected";
  const productName = selection.product_name || selection.selected_product_name || selection.title;
  const imageUrl = selection.image_url || `https://placehold.co/640x420/e2e8f0/334155?text=${encodeURIComponent(productName || "Selection")}`;
  return (
    <article style={{ ...styles.productCard, ...(status === "selected" || status === "approved" ? styles.productCardSelected : {}) }}>
      <div style={styles.productImageWrap}>
        <img src={imageUrl} alt={productName || "Selection product"} style={styles.productImage} />
        <span style={{ ...styles.impactBadge, ...(variation > 0 ? styles.badgeUpgrade : variation < 0 ? styles.badgeCredit : styles.badgeIncluded) }}>{clientPriceImpactLabel(variation)}</span>
      </div>
      <div style={styles.productBody}>
        <div style={styles.cardHeader}>
          <div>
            <p style={styles.cardMeta}>{selection.brand || selection.selected_supplier_name || "Selection"}</p>
            <h3 style={styles.cardTitle}>{productName}</h3>
            <p style={styles.cardMeta}>{selection.model_number ? `Model ${selection.model_number}` : "Model not recorded"}</p>
          </div>
          <span style={{ ...styles.statusPill, ...statusStyle(status) }}>{titleCase(status)}</span>
        </div>
        <p style={styles.descriptionText}>{selection.description || [selection.finish, selection.colour].filter(Boolean).join(" / ") || "Product details available during the selections appointment."}</p>
        <p style={styles.finishLine}>{selection.finish || selection.colour || selection.selected_finish || selection.selected_colour || "Finish to be confirmed"}</p>
        <div style={styles.linkRow}>
          <DocLink href={selection.specification_url} label="Specifications" />
          <DocLink href={selection.warranty_url} label="Warranty" />
          <DocLink href={selection.installation_guide_url} label="Install Guide" />
        </div>
        {isInternal ? (
          <div style={styles.internalMini}>
            <MiniTotal label="Original Allowance" value={money(selection.included_allowance || selection.allowance_amount, currency)} />
            <MiniTotal label="Selected Value" value={money(selection.client_selection_price, currency)} />
            {canViewCosts ? <MiniTotal label="Builder Cost" value={money(numberValue(selection.builder_cost) + numberValue(selection.installation_cost), currency)} /> : null}
          </div>
        ) : null}
        <div style={styles.productActions}>
          <button type="button" onClick={onSelect} style={styles.selectButton}>{status === "selected" || status === "approved" ? "Replace Selection" : "Select"}</button>
          <button type="button" onClick={onSelect} style={styles.utilityButton}><RefreshCw size={15} />View Details</button>
        </div>
      </div>
    </article>
  );
}

function DocLink({ href, label }) {
  if (!href) return <span style={styles.disabledDoc}>{label}</span>;
  return <a href={href} target="_blank" rel="noreferrer" style={styles.docLink}>{label}</a>;
}

function FinancialTile({ label, value, tone = "", emphasis = false }) {
  return (
    <div style={{ ...styles.financialTile, ...(emphasis ? styles.financialTileEmphasis : {}), ...(tone === "upgrade" ? styles.financialTileUpgrade : {}), ...(tone === "credit" ? styles.financialTileCredit : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniTotal({ label, value, tone = "" }) {
  return (
    <div style={{ ...styles.miniTotal, ...(tone === "bad" ? styles.miniTotalBad : {}), ...(tone === "good" ? styles.miniTotalGood : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextField({ label, value, onChange, wide = false }) {
  return (
    <label style={wide ? styles.fieldWide : styles.field}>
      <span style={styles.label}>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} />
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input type="number" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} />
    </label>
  );
}

function TextArea({ label, value, onChange, wide = false }) {
  return (
    <label style={wide ? styles.fieldWide : styles.field}>
      <span style={styles.label}>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} style={styles.textarea} />
    </label>
  );
}

function SelectField({ label, value, onChange, options, wide = false }) {
  return (
    <label style={wide ? styles.fieldWide : styles.field}>
      <span style={styles.label}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.select}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function categorySummariesFromRows(rows) {
  const map = new Map();
  rows.forEach((selection) => {
    const key = selection.category || "other";
    const current = map.get(key) || { category: key, originalAllowance: 0, selectedValue: 0, netDifference: 0 };
    current.originalAllowance += numberValue(selection.included_allowance || selection.allowance_amount);
    current.selectedValue += numberValue(selection.client_selection_price);
    current.netDifference += numberValue(selection.variation_amount);
    map.set(key, current);
  });
  return Array.from(map.values()).map((summary) => ({
    ...summary,
    originalAllowance: roundMoney(summary.originalAllowance),
    selectedValue: roundMoney(summary.selectedValue),
    netDifference: roundMoney(summary.netDifference),
  }));
}

function privateBudgetAlert(budget) {
  if (budget.selectionBudgetStatus === "approaching_limit") return "The client is approaching their approved upgrade ceiling.";
  if (budget.selectionBudgetStatus === "limit_reached") return "The client has reached their approved upgrade ceiling.";
  if (budget.selectionBudgetStatus === "over_limit") return `The client has exceeded their approved upgrade ceiling by ${money(Math.abs(budget.remainingCapacity))}.`;
  return "";
}

function variationExGst(selection) {
  const gstRate = numberValue(selection.gst_rate || GST_RATE);
  return roundMoney(numberValue(selection.variation_amount) / (1 + gstRate / 100));
}

function totalBySign(rows, sign) {
  return roundMoney(rows.reduce((total, row) => {
    const value = numberValue(row.variation_amount);
    if (sign > 0 && value > 0) return total + value;
    if (sign < 0 && value < 0) return total + value;
    return total;
  }, 0));
}

function categoryClientLabel(value, currency) {
  const number = numberValue(value);
  if (number < 0) return `Category Credit: ${signedMoney(number, currency)}`;
  return `Category Upgrade: ${signedMoney(number, currency)}`;
}

function categoryFromSource(value) {
  const key = String(value || "").toLowerCase();
  return SELECTION_CATEGORIES.find((category) => key.includes(category.replace(/_/g, " "))) || "";
}

function nextVariationNumber(existing = []) {
  const max = existing.reduce((highest, variation) => {
    const match = String(variation.variation_number || "").match(/VAR-(\d+)/i);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `VAR-${String(max + 1).padStart(3, "0")}`;
}

function money(value, currency = "AUD") {
  const number = Number(value);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function signedMoney(value, currency = "AUD") {
  const number = numberValue(value);
  if (number === 0) return money(0, currency);
  const formatted = money(Math.abs(number), currency);
  return `${number > 0 ? "+" : "-"}${formatted}`;
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status) {
  if (status === "approved" || status === "selected") return { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" };
  if (status === "replaced") return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
  if (status === "removed") return { background: "#fff1f2", color: "#b91c1c", borderColor: "#fecaca" };
  return { background: "#f8fafc", color: "#475569", borderColor: "#cbd5e1" };
}

const styles = {
  page: { minHeight: "100vh", background: "#f5f7fb", color: "#111827", padding: 18 },
  header: { background: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: 8, padding: "22px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, boxShadow: "0 18px 45px rgba(17, 24, 39, 0.16)" },
  eyebrow: { color: "#5eead4", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" },
  title: { margin: "4px 0", fontSize: 34, lineHeight: 1.08, fontWeight: 850 },
  subtitle: { margin: 0, color: "#cbd5e1", fontSize: 15, maxWidth: 760 },
  headerActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  primaryLink: { background: "#ffffff", color: "#111827", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 8, padding: "10px 14px", textDecoration: "none", fontWeight: 800, whiteSpace: "nowrap" },
  secondaryLink: { background: "rgba(255,255,255,0.08)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 8, padding: "10px 14px", textDecoration: "none", fontWeight: 800, whiteSpace: "nowrap" },
  controls: { marginTop: 16, background: "#ffffff", border: "1px solid #d7dee8", borderRadius: 8, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
  fieldWide: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0, gridColumn: "1 / -1" },
  label: { color: "#475569", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" },
  select: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#111827", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#111827", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  textarea: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#111827", padding: "10px 11px", fontSize: 14, fontWeight: 700, resize: "vertical" },
  error: { marginTop: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  success: { marginTop: 12, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  notice: { marginTop: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  summaryDock: { position: "sticky", top: 0, zIndex: 5, marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 12, background: "rgba(245, 247, 251, 0.92)", padding: "8px 0", backdropFilter: "blur(8px)" },
  financialTile: { background: "#ffffff", border: "1px solid #d7dee8", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 5, minHeight: 82 },
  financialTileEmphasis: { borderColor: "#0f766e", background: "#f0fdfa" },
  financialTileUpgrade: { borderColor: "#fed7aa", background: "#fff7ed" },
  financialTileCredit: { borderColor: "#bbf7d0", background: "#f0fdf4" },
  privatePanel: { marginTop: 16, background: "#ffffff", border: "1px solid #99f6e4", borderRadius: 8, padding: 16 },
  privateHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, color: "#0f766e" },
  privateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 },
  settingsGrid: { marginTop: 14, paddingTop: 14, borderTop: "1px solid #ccfbf1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, alignItems: "end" },
  privateAlert: { marginBottom: 12, display: "flex", alignItems: "center", gap: 8, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  privateAlertDanger: { borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" },
  layout: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(360px, 0.85fr) minmax(0, 1.15fr)", gap: 16, alignItems: "start" },
  panel: { background: "#ffffff", border: "1px solid #d7dee8", borderRadius: 8, padding: 16 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 19, lineHeight: 1.2, fontWeight: 850 },
  panelText: { margin: "4px 0 0", color: "#64748b", fontSize: 14, fontWeight: 600 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  calcStrip: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 },
  createButton: { width: "100%", marginTop: 14, background: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: 8, padding: "12px 14px", fontWeight: 900, cursor: "pointer" },
  disabledButton: { opacity: 0.55, cursor: "not-allowed" },
  productGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 },
  productCard: { border: "1px solid #d7dee8", borderRadius: 8, overflow: "hidden", background: "#ffffff", display: "flex", flexDirection: "column" },
  productCardSelected: { borderColor: "#0f766e", boxShadow: "0 10px 30px rgba(15, 118, 110, 0.12)" },
  productImageWrap: { position: "relative", aspectRatio: "16 / 10", background: "#e2e8f0", overflow: "hidden" },
  productImage: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  impactBadge: { position: "absolute", right: 10, bottom: 10, borderRadius: 8, padding: "7px 9px", fontSize: 13, fontWeight: 900, border: "1px solid" },
  badgeUpgrade: { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" },
  badgeCredit: { background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" },
  badgeIncluded: { background: "#f8fafc", color: "#334155", borderColor: "#cbd5e1" },
  productBody: { padding: 13, display: "flex", flexDirection: "column", gap: 10, flex: 1 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  cardTitle: { margin: 0, fontSize: 17, fontWeight: 900 },
  cardMeta: { margin: "2px 0", color: "#64748b", fontSize: 13, fontWeight: 750 },
  descriptionText: { margin: 0, color: "#334155", fontSize: 14, fontWeight: 600, lineHeight: 1.45 },
  finishLine: { margin: 0, color: "#111827", fontSize: 13, fontWeight: 850 },
  linkRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  docLink: { border: "1px solid #cbd5e1", borderRadius: 8, color: "#1d4ed8", textDecoration: "none", padding: "6px 8px", fontSize: 12, fontWeight: 850 },
  disabledDoc: { border: "1px solid #e2e8f0", borderRadius: 8, color: "#94a3b8", padding: "6px 8px", fontSize: 12, fontWeight: 850 },
  internalMini: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 },
  productActions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" },
  selectButton: { background: "#0f766e", color: "#ffffff", border: "1px solid #0f766e", borderRadius: 8, padding: "9px 11px", fontWeight: 900, cursor: "pointer" },
  utilityButton: { display: "inline-flex", alignItems: "center", gap: 6, background: "#ffffff", color: "#111827", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 11px", fontWeight: 850, cursor: "pointer" },
  primaryDarkButton: { display: "inline-flex", alignItems: "center", gap: 7, background: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: 8, padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  miniTotal: { border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 11px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  miniTotalBad: { borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" },
  miniTotalGood: { borderColor: "#bbf7d0", background: "#f0fdf4", color: "#15803d" },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc", color: "#475569", padding: 18, fontWeight: 700 },
  summarySection: { marginTop: 16, background: "#ffffff", border: "1px solid #d7dee8", borderRadius: 8, padding: 16 },
  tableWrap: { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  bottomTotals: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 },
  statusPill: { border: "1px solid", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" },
  modalBackdrop: { position: "fixed", inset: 0, zIndex: 20, background: "rgba(17, 24, 39, 0.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 },
  modal: { width: "min(560px, 100%)", background: "#ffffff", borderRadius: 8, padding: 18, boxShadow: "0 25px 70px rgba(17, 24, 39, 0.25)" },
  modalTitle: { margin: 0, fontSize: 22, fontWeight: 900 },
  modalText: { margin: "10px 0 0", color: "#334155", fontSize: 15, fontWeight: 650 },
  modalTotals: { marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  modalActions: { marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
};
