const STORE_VERSION = 1;

export const STANDARD_INCLUSIONS_STAGE2_DB = "standard-inclusions-stage2-db";
export const STANDARD_INCLUSIONS_STAGE2_STORE = "records";
export const ACTIVE_MASTER_KEY = "active-master";
export const PROJECTS_KEY = "project-copies";

export function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function createStandardInclusionsMaster(document, {
  organisationId = "local-builder",
  templateId = `standard-inclusions-master-${Date.now()}`,
  templateName = document?.name || "Premier Inclusions Schedule",
  source = document?.metadata?.sourceFileName || document?.metadata?.documentSource || "stage-1-import",
  now = new Date().toISOString(),
} = {}) {
  const pages = cloneJson(document?.pages || []);
  const version = Number(document?.metadata?.version || 1) || 1;
  const master = {
    templateId,
    organisationId,
    templateName,
    status: "ACTIVE MASTER",
    version,
    pageCount: pages.length,
    pages,
    document: stampDocument(document, { isMaster: true, templateId, organisationId, templateName, version, now }),
    source,
    isMaster: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  };
  return {
    ...master,
    versions: [createMasterVersionSnapshot(master, { version, source, now, change: "Initial master save" })],
  };
}

export function saveStandardInclusionsMasterVersion(master, document, {
  source = "master-edit",
  change = "Master saved",
  now = new Date().toISOString(),
} = {}) {
  if (!master?.isMaster) throw new Error("A Standard Inclusions master is required.");
  const version = Number(master.version || 0) + 1;
  const documentClone = stampDocument(document || master.document, {
    isMaster: true,
    templateId: master.templateId,
    organisationId: master.organisationId,
    templateName: master.templateName,
    version,
    now,
  });
  const next = {
    ...cloneJson(master),
    version,
    pageCount: Array.isArray(documentClone?.pages) ? documentClone.pages.length : 0,
    pages: cloneJson(documentClone?.pages || []),
    document: documentClone,
    source,
    updatedAt: now,
  };
  return {
    ...next,
    versions: [...(Array.isArray(master.versions) ? master.versions : []), createMasterVersionSnapshot(next, { version, source, now, change })],
  };
}

export function restoreStandardInclusionsMasterVersion(master, versionNumber, {
  now = new Date().toISOString(),
} = {}) {
  const snapshot = (master?.versions || []).find((item) => Number(item.version) === Number(versionNumber));
  if (!snapshot) throw new Error(`Standard Inclusions master version ${versionNumber} was not found.`);
  return saveStandardInclusionsMasterVersion(master, snapshot.document, {
    source: `restore-version-${versionNumber}`,
    change: `Restored version ${versionNumber}`,
    now,
  });
}

export function createProjectInclusionsCopy(master, {
  projectId,
  projectName = "Untitled Project",
  organisationId = master?.organisationId || "local-builder",
  projectInclusionsId = `project-inclusions-${projectId || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  now = new Date().toISOString(),
} = {}) {
  if (!projectId) throw new Error("projectId is required.");
  if (!master?.isMaster) throw new Error("An active Standard Inclusions master is required.");
  const pages = cloneJson(master.pages || master.document?.pages || []);
  const document = stampDocument(master.document || { pages }, {
    isMaster: false,
    templateId: master.templateId,
    organisationId,
    templateName: `${projectName} Inclusions`,
    version: master.version,
    now,
  });
  return {
    projectInclusionsId,
    projectId,
    projectName,
    organisationId,
    sourceMasterTemplateId: master.templateId,
    sourceMasterVersion: Number(master.version || 1),
    sourceMasterName: master.templateName,
    status: "Project Copy",
    pageCount: pages.length,
    pages,
    document: {
      ...document,
      id: projectInclusionsId,
      name: `${projectName} Standard Inclusions`,
    },
    isMaster: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function saveProjectInclusionsCopy(projectCopy, document, {
  now = new Date().toISOString(),
} = {}) {
  if (!projectCopy?.projectInclusionsId) throw new Error("A project inclusions copy is required.");
  const documentClone = stampDocument(document || projectCopy.document, {
    isMaster: false,
    templateId: projectCopy.sourceMasterTemplateId,
    organisationId: projectCopy.organisationId,
    templateName: projectCopy.document?.name || `${projectCopy.projectName} Standard Inclusions`,
    version: projectCopy.sourceMasterVersion,
    now,
  });
  return {
    ...cloneJson(projectCopy),
    pageCount: Array.isArray(documentClone?.pages) ? documentClone.pages.length : 0,
    pages: cloneJson(documentClone?.pages || []),
    document: documentClone,
    updatedAt: now,
  };
}

export function resetProjectCopyFromCurrentMaster(projectCopy, master, {
  confirmed = false,
  now = new Date().toISOString(),
} = {}) {
  if (!confirmed) throw new Error("Reset From Current Master requires explicit confirmation.");
  return createProjectInclusionsCopy(master, {
    projectId: projectCopy.projectId,
    projectName: projectCopy.projectName,
    organisationId: projectCopy.organisationId,
    projectInclusionsId: projectCopy.projectInclusionsId,
    now,
  });
}

export function replaceFirstText(document, fromText, toText) {
  const next = cloneJson(document);
  for (const page of next.pages || []) {
    for (const object of page.objects || []) {
      if (!["text", "dynamicField"].includes(object.type)) continue;
      const text = String(object.data?.text || "");
      if (!text.includes(fromText)) continue;
      object.data = { ...(object.data || {}), text: text.replace(fromText, toText), edited: true, acceptedEdit: true, maskOriginal: true };
      return next;
    }
  }
  return next;
}

export function replaceFirstImage(document, imageRef) {
  const next = cloneJson(document);
  for (const page of next.pages || []) {
    for (const object of page.objects || []) {
      if (!["image", "logo"].includes(object.type)) continue;
      object.data = { ...(object.data || {}), imageRef, edited: true, acceptedEdit: true, maskOriginal: true };
      return next;
    }
  }
  return next;
}

export async function saveStage2Record(key, value) {
  const db = await openStage2Db();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STANDARD_INCLUSIONS_STAGE2_STORE, "readwrite");
    tx.objectStore(STANDARD_INCLUSIONS_STAGE2_STORE).put(cloneJson(value), key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not save Standard Inclusions stage 2 record."));
  });
  db.close();
}

export async function loadStage2Record(key, fallback = null) {
  const db = await openStage2Db();
  const value = await new Promise((resolve) => {
    const tx = db.transaction(STANDARD_INCLUSIONS_STAGE2_STORE, "readonly");
    const request = tx.objectStore(STANDARD_INCLUSIONS_STAGE2_STORE).get(key);
    request.onsuccess = () => resolve(request.result ?? fallback);
    request.onerror = () => resolve(fallback);
  });
  db.close();
  return value;
}

export async function saveStage2State({ activeMaster, projects }) {
  await saveStage2Record(ACTIVE_MASTER_KEY, activeMaster || null);
  await saveStage2Record(PROJECTS_KEY, Array.isArray(projects) ? projects : []);
}

export async function loadStage2State() {
  const [activeMaster, projects] = await Promise.all([
    loadStage2Record(ACTIVE_MASTER_KEY, null),
    loadStage2Record(PROJECTS_KEY, []),
  ]);
  return { activeMaster, projects: Array.isArray(projects) ? projects : [] };
}

function stampDocument(document, { isMaster, templateId, organisationId, templateName, version, now }) {
  const clone = cloneJson(document || { pages: [] });
  return {
    ...clone,
    name: templateName || clone.name || "Premier Inclusions Schedule",
    metadata: {
      ...(clone.metadata || {}),
      documentType: "standardInclusions",
      isMaster,
      templateId,
      organisationId,
      templateName,
      version,
      updatedAt: now,
      lastSavedAt: now,
    },
  };
}

function createMasterVersionSnapshot(master, { version, source, now, change }) {
  return {
    version,
    savedAt: now,
    pageCount: master.pageCount,
    source,
    change,
    document: cloneJson(master.document),
  };
}

function openStage2Db() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = indexedDB.open(STANDARD_INCLUSIONS_STAGE2_DB, STORE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STANDARD_INCLUSIONS_STAGE2_STORE)) db.createObjectStore(STANDARD_INCLUSIONS_STAGE2_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open Standard Inclusions stage 2 database."));
  });
}
