import { BASE_TEMPLATES, FLOOR_LEVELS, MULTI_STOREY_TYPES, QUESTIONNAIRE_CONFIG } from "./templates/baseTemplates";
import { COMPLEXITY_RULES } from "./templates/complexityRules";
import { TRADE_CATEGORIES } from "./templates/tradeCategories";

const PHASE_ORDER = {
  "Pre-Construction": 1,
  Procurement: 2,
  "Site Preparation": 3,
  Foundations: 4,
  "Frame Stage": 5,
  "Lock-Up Stage": 6,
  "Rough-In Stage": 7,
  "Internal Lining": 8,
  "Fix-Out Stage": 9,
  "External Works": 10,
  Completion: 11,
};

const GROUP_ORDER = [
  "Ground Floor tasks",
  "First Floor tasks",
  "Second Floor tasks",
  "Roof / external envelope",
  "Internal works",
  "Completion",
];

function selectedValues(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function hasFloorRequirement(answers, levelKey, requirement) {
  return (answers[`${levelKey}SpecialRequirements`] || []).includes(requirement);
}

function isMultiStorey(answers = {}) {
  return MULTI_STOREY_TYPES.includes(answers.projectType);
}

function cloneTask(task) {
  return {
    ...task,
    dependencies: [...(task.dependencies || [])],
    critical: !!task.critical,
  };
}

export function visibleQuestionnaireConfig(answers = {}) {
  return QUESTIONNAIRE_CONFIG.filter((item) => {
    if (item.simpleOnly && isMultiStorey(answers)) return false;
    if (item.storeyTypes && !item.storeyTypes.includes(answers.projectType)) return false;
    return true;
  });
}

export function defaultPlannerAnswers() {
  return Object.fromEntries(QUESTIONNAIRE_CONFIG.map((item) => [
    item.key,
    item.multiple ? [] : item.options[0],
  ]));
}

export function getBaseTemplateForAnswers(answers = {}) {
  const projectType = answers.projectType || "Single Storey Home";
  return BASE_TEMPLATES.find((template) => template.matches.includes(projectType)) || BASE_TEMPLATES[0];
}

function structureDuration(structure) {
  if (structure === "Suspended concrete") return 10;
  if (structure === "Steel floor system") return 8;
  if (structure === "Timber floor system") return 6;
  return 10;
}

function wallDuration(wallType) {
  if (wallType === "Blockwork") return 12;
  if (wallType === "Hebel") return 8;
  if (wallType === "Lightweight cladding") return 9;
  if (wallType === "Rendered cladding") return 11;
  if (wallType === "Mixed") return 12;
  return 10;
}

function frameDuration(frameType) {
  if (frameType === "Steel frame") return 9;
  if (frameType === "Masonry") return 11;
  return 8;
}

function groupForLevel(levelKey) {
  if (levelKey === "first") return "First Floor tasks";
  if (levelKey === "second") return "Second Floor tasks";
  return "Ground Floor tasks";
}

function levelPrefix(levelKey) {
  if (levelKey === "first") return "First Floor";
  if (levelKey === "second") return "Second Floor";
  return "Ground Floor";
}

function buildLevelTasks(answers, level, previousDependency) {
  const prefix = levelPrefix(level.key);
  const group = groupForLevel(level.key);
  const structure = answers[`${level.key}FloorStructure`];
  const wall = answers[`${level.key}ExternalWall`];
  const frame = answers[`${level.key}InternalFrame`];
  const structureKey = `${level.key}-floor-structure`;
  const frameKey = `${level.key}-frame`;
  const wallKey = `${level.key}-external-wall`;
  const tasks = [
    {
      key: structureKey,
      name: level.key === "ground" ? `${prefix} Structure` : `${prefix} Joists / Floor System`,
      group,
      phase: level.key === "ground" ? "Foundations" : "Frame Stage",
      duration: structureDuration(structure),
      trade: structure === "Concrete slab" || structure === "Suspended concrete" ? TRADE_CATEGORIES.CONCRETE : TRADE_CATEGORIES.CARPENTRY,
      dependencies: previousDependency ? [previousDependency] : ["set-out"],
      critical: true,
    },
    {
      key: frameKey,
      name: `${prefix} ${frame}`,
      group,
      phase: "Frame Stage",
      duration: frameDuration(frame),
      trade: frame === "Steel frame" ? TRADE_CATEGORIES.SPECIALIST : frame === "Masonry" ? TRADE_CATEGORIES.MASONRY : TRADE_CATEGORIES.CARPENTRY,
      dependencies: [structureKey],
      critical: true,
    },
    {
      key: wallKey,
      name: `${prefix} ${wall}`,
      group,
      phase: "Lock-Up Stage",
      duration: wallDuration(wall),
      trade: wall === "Lightweight cladding" || wall === "Rendered cladding" || wall === "Mixed" ? TRADE_CATEGORIES.CLADDING : TRADE_CATEGORIES.MASONRY,
      dependencies: [frameKey],
      critical: true,
    },
  ];

  if (level.key !== "ground") {
    tasks.push({
      key: `${level.key}-windows-openings`,
      name: `${prefix} Windows / External Openings`,
      group,
      phase: "Lock-Up Stage",
      duration: 4,
      trade: TRADE_CATEGORIES.CARPENTRY,
      dependencies: [wallKey],
      critical: true,
    });
  }

  if (wall === "Lightweight cladding" || wall === "Mixed" || hasFloorRequirement(answers, level.key, "Feature cladding")) {
    tasks.push({
      key: `${level.key}-feature-cladding`,
      name: `${prefix} Lightweight Cladding`,
      group,
      phase: "Lock-Up Stage",
      duration: 7,
      trade: TRADE_CATEGORIES.CLADDING,
      dependencies: [wallKey],
      critical: true,
    });
  }

  if (hasFloorRequirement(answers, level.key, "Structural steel")) {
    tasks.push({
      key: `${level.key}-structural-steel`,
      name: `${prefix} Structural Steel`,
      group,
      phase: "Frame Stage",
      duration: 4,
      trade: TRADE_CATEGORIES.SPECIALIST,
      dependencies: [structureKey],
      critical: true,
    });
    const frameTask = tasks.find((task) => task.key === frameKey);
    frameTask.dependencies.push(`${level.key}-structural-steel`);
  }

  if (level.key !== "ground" && hasFloorRequirement(answers, level.key, "Upper floor services")) {
    tasks.push({
      key: `${level.key}-upper-services`,
      name: `${prefix} Services Rough-In`,
      group,
      phase: "Rough-In Stage",
      duration: 6,
      trade: TRADE_CATEGORIES.SERVICES,
      dependencies: [frameKey],
      critical: true,
    });
  }

  if (hasFloorRequirement(answers, level.key, "Balcony")) {
    tasks.push({
      key: `${level.key}-balcony-waterproofing`,
      name: `${prefix} Balcony Waterproofing`,
      group,
      phase: "External Works",
      duration: 3,
      trade: TRADE_CATEGORIES.SPECIALIST,
      dependencies: [frameKey],
      critical: false,
    });
  }

  return { tasks, lastDependency: wallKey };
}

function buildMultiStoreyTasks(answers) {
  const levels = FLOOR_LEVELS.filter((level) => level.storeyTypes.includes(answers.projectType));
  const tasks = [
    { key: "site-preparation", name: "Site Preparation", group: "Ground Floor tasks", phase: "Site Preparation", duration: 5, trade: TRADE_CATEGORIES.SITE_WORKS, dependencies: [], critical: true },
    { key: "set-out", name: "Set Out", group: "Ground Floor tasks", phase: "Site Preparation", duration: 1, trade: TRADE_CATEGORIES.SURVEY, dependencies: ["site-preparation"], critical: true },
  ];
  let previous = "set-out";
  let lastEnvelopeDependency = null;
  let scaffoldAnchor = null;

  levels.forEach((level) => {
    const built = buildLevelTasks(answers, level, previous);
    tasks.push(...built.tasks);
    previous = built.lastDependency;
    lastEnvelopeDependency = built.lastDependency;
    if (level.key !== "ground" && hasFloorRequirement(answers, level.key, "Scaffold required")) {
      const installKey = `${level.key}-scaffold-install`;
      tasks.push({
        key: installKey,
        name: scaffoldAnchor ? "Scaffold Adjustments" : "Scaffold Install",
        group: "Roof / external envelope",
        phase: "Frame Stage",
        duration: scaffoldAnchor ? 1 : 2,
        trade: TRADE_CATEGORIES.SPECIALIST,
        dependencies: [level.key === "first" ? "ground-frame" : `${level.key}-floor-structure`].filter(Boolean),
        critical: true,
      });
      const frameTask = tasks.find((task) => task.key === `${level.key}-frame`);
      if (frameTask) frameTask.dependencies.push(installKey);
      scaffoldAnchor = installKey;
    }
  });

  const roofDependency = lastEnvelopeDependency || previous;
  tasks.push(
    { key: "roof", name: `${answers.roofType || "Roof"} Roof`, group: "Roof / external envelope", phase: "Lock-Up Stage", duration: 8, trade: TRADE_CATEGORIES.ROOFING, dependencies: [roofDependency], critical: true },
    { key: "lock-up", name: "Lock Up", group: "Roof / external envelope", phase: "Lock-Up Stage", duration: 5, trade: TRADE_CATEGORIES.CARPENTRY, dependencies: ["roof"], critical: true },
    { key: "rough-in", name: "Whole Home Services Rough-In", group: "Internal works", phase: "Rough-In Stage", duration: 10, trade: TRADE_CATEGORIES.SERVICES, dependencies: ["lock-up"], critical: true },
    { key: "internal-lining", name: "Internal Lining", group: "Internal works", phase: "Internal Lining", duration: 14, trade: TRADE_CATEGORIES.FINISHES, dependencies: ["rough-in"], critical: true },
    { key: "fix-out", name: "Fix Out", group: "Internal works", phase: "Fix-Out Stage", duration: 22, trade: TRADE_CATEGORIES.FINISHES, dependencies: ["internal-lining"], critical: true },
    { key: "practical-completion", name: "Practical Completion", group: "Completion", phase: "Completion", duration: 5, trade: TRADE_CATEGORIES.SUPERVISION, dependencies: ["fix-out"], critical: true },
  );

  if (scaffoldAnchor) {
    tasks.push({
      key: "scaffold-removal",
      name: "Scaffold Removal",
      group: "Roof / external envelope",
      phase: "External Works",
      duration: 2,
      trade: TRADE_CATEGORIES.SPECIALIST,
      dependencies: ["lock-up"],
      critical: false,
    });
  }

  return tasks;
}

function baseTasksForTemplate(template, answers) {
  if (template.mode === "multi") return buildMultiStoreyTasks(answers);
  const sourceTasks = template.tasks?.length ? template.tasks : BASE_TEMPLATES[0].tasks;
  return sourceTasks.map((task) => ({
    ...task,
    name: task.key === "slab" && answers.slabType
      ? answers.slabType
      : task.key === "brickwork" && answers.wallConstruction
        ? answers.wallConstruction
        : task.key === "roof" && answers.roofType
          ? `${answers.roofType} Roof`
          : task.name,
    duration: template.durationMultiplier ? Math.ceil(task.duration * template.durationMultiplier) : task.duration,
  }));
}

function applyDependencyRewrites(taskMap, rewrites = []) {
  rewrites.forEach((rewrite) => {
    const task = taskMap.get(rewrite.task);
    if (!task || !rewrite.addAfter || !taskMap.has(rewrite.addAfter)) return;
    if (!task.dependencies.includes(rewrite.addAfter)) task.dependencies.push(rewrite.addAfter);
  });
}

function calculateStartDays(tasks) {
  const byKey = new Map(tasks.map((task) => [task.key, task]));
  const memo = new Map();
  const visiting = new Set();

  function startFor(task) {
    if (memo.has(task.key)) return memo.get(task.key);
    if (visiting.has(task.key)) return 0;
    visiting.add(task.key);
    const dependencyEnds = (task.dependencies || [])
      .map((key) => byKey.get(key))
      .filter(Boolean)
      .map((dependency) => startFor(dependency) + Math.max(1, dependency.duration || 1));
    const start = dependencyEnds.length ? Math.max(...dependencyEnds) : 0;
    memo.set(task.key, start);
    visiting.delete(task.key);
    return start;
  }

  return tasks.map((task) => {
    const startDay = startFor(task);
    const duration = Math.max(1, Math.round(Number(task.duration) || 1));
    return { ...task, start_day: startDay, duration_days: duration, end_day: startDay + duration };
  });
}

function buildTradeSummary(tasks) {
  const summary = new Map();
  tasks.forEach((task) => {
    const trade = task.trade_category || "Unassigned";
    const current = summary.get(trade) || { trade, taskCount: 0, workingDays: 0 };
    current.taskCount += 1;
    current.workingDays += task.duration_days || 0;
    summary.set(trade, current);
  });
  return Array.from(summary.values()).sort((a, b) => b.workingDays - a.workingDays || a.trade.localeCompare(b.trade));
}

function buildGroupBreakdown(tasks) {
  const groups = new Map();
  tasks.forEach((task) => {
    const group = task.group || "Generated tasks";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(task);
  });
  return Array.from(groups.entries())
    .map(([group, groupTasks]) => ({ group, tasks: groupTasks }))
    .sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a.group);
      const bi = GROUP_ORDER.indexOf(b.group);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.group.localeCompare(b.group);
    });
}

export function generateSchedulePlan(answers = {}) {
  const completeAnswers = { ...defaultPlannerAnswers(), ...answers };
  const baseTemplate = getBaseTemplateForAnswers(completeAnswers);
  const appliedRules = isMultiStorey(completeAnswers)
    ? COMPLEXITY_RULES.filter((rule) => ["steep-heavy-earthworks", "retaining-walls", "pool", "basement"].includes(rule.id) && rule.applies(completeAnswers))
    : COMPLEXITY_RULES.filter((rule) => rule.applies(completeAnswers));
  const taskMap = new Map();

  baseTasksForTemplate(baseTemplate, completeAnswers).map(cloneTask).forEach((task) => taskMap.set(task.key, task));
  appliedRules.forEach((rule) => {
    (rule.tasks || []).map(cloneTask).forEach((task) => {
      if (!taskMap.has(task.key)) taskMap.set(task.key, task);
    });
    applyDependencyRewrites(taskMap, rule.dependencyRewrites);
  });

  const scheduledTasks = calculateStartDays(Array.from(taskMap.values()))
    .sort((a, b) => a.start_day - b.start_day || (PHASE_ORDER[a.phase] || 99) - (PHASE_ORDER[b.phase] || 99) || a.name.localeCompare(b.name))
    .map((task, index) => ({
      name: task.name,
      group: task.group || "Generated tasks",
      phase: task.phase,
      phase_order: PHASE_ORDER[task.phase] || 99,
      start_day: task.start_day,
      duration_days: task.duration_days,
      end_day: task.end_day,
      status: "pending",
      progress_percent: 0,
      assigned_trade: task.trade,
      trade_category: task.trade,
      critical_path: !!task.critical,
      is_milestone: task.duration_days === 1 && /completion|set out/i.test(task.name),
      is_long_lead: false,
      dependencies: task.dependencies || [],
      dependency_keys: task.dependencies || [],
      sort_order: index,
      notes: task.critical ? "Critical path" : null,
    }));

  const estimatedWorkingDays = scheduledTasks.length ? Math.max(...scheduledTasks.map((task) => task.end_day)) : 0;
  const criticalPath = scheduledTasks.filter((task) => task.critical_path).map((task) => task.name);

  return {
    answers: completeAnswers,
    baseTemplate: { id: baseTemplate.id, label: baseTemplate.label },
    appliedRules: appliedRules.map((rule) => ({ id: rule.id, label: rule.label })),
    tasks: scheduledTasks,
    taskGroups: buildGroupBreakdown(scheduledTasks),
    estimatedBuildDuration: estimatedWorkingDays,
    workingDays: scheduledTasks.reduce((sum, task) => sum + (task.duration_days || 0), 0),
    criticalPath,
    tradeSchedule: buildTradeSummary(scheduledTasks),
    selectedFeatures: Object.entries(completeAnswers).flatMap(([key, value]) => selectedValues(value).map((item) => ({ key, value: item }))),
  };
}

export { QUESTIONNAIRE_CONFIG };
