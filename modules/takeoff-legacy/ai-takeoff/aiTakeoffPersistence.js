import { createProject } from "./takeoffTypes.js";

export function hasSavedTakeoffState(project) {
  return Boolean(project && (
    Array.isArray(project.pages) ||
    Array.isArray(project.plans)
  ));
}

export function hasTakeoffContent(project) {
  return Boolean(project && (
    (Array.isArray(project.pages) && project.pages.length > 0) ||
    (Array.isArray(project.plans) && project.plans.length > 0)
  ));
}

export function takeoffProjectSignature(project) {
  if (!project) return "";
  const pages = Array.isArray(project.pages) ? project.pages : [];
  const plans = Array.isArray(project.plans) ? project.plans : [];
  return [project.id || "", project.jobId || "", pages.length, plans.length, project.updatedAt || ""].join(":");
}

export function resolveTakeoffProject(savedTakeoffProject, jobId) {
  if (hasSavedTakeoffState(savedTakeoffProject)) {
    return savedTakeoffProject;
  }

  return {
    ...createProject(jobId),
    plans: [],
    activePageId: null,
    selectedPageId: null,
    measurements: [],
    areas: [],
    scale: null,
    orientation: null,
    settings: {},
  };
}

export function countTakeoffPages(project) {
  return Array.isArray(project?.pages) ? project.pages.length : 0;
}

export function countTakeoffPlans(workbookOrProject) {
  return Array.isArray(workbookOrProject?.plans) ? workbookOrProject.plans.length : 0;
}

export function activeTakeoffPageId(project, selectedPageId = null) {
  if (selectedPageId) return selectedPageId;
  return Array.isArray(project?.pages) && project.pages[0]?.id ? project.pages[0].id : null;
}
