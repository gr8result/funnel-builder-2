// Asks what to do with a job file that is older than the stored copy of the same job. A native
// <dialog>, so it works from any screen without a host component. Resolves to one of
// JOB_FILE_CHOICES; closing it any other way is Cancel.
import { JOB_FILE_CHOICES } from "../../lib/construction-estimation/jobFileImportDecision.js";

export function chooseJobFileAction(conflict = {}, fileName = "") {
  if (typeof document === "undefined") return Promise.resolve(JOB_FILE_CHOICES.CANCEL);
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("data-testid", "job-file-conflict");
    dialog.style.cssText = "max-width:560px;padding:24px;border:1px solid #94a3b8;border-radius:10px;font:16px/1.5 system-ui,sans-serif;color:#0f172a";
    const title = document.createElement("h2");
    title.textContent = "This file is older than the stored job";
    title.style.cssText = "margin:0 0 12px;font-size:20px";
    const body = document.createElement("p");
    body.textContent = `${fileName ? `${fileName}: ` : ""}${conflict.message || "The stored copy of this job is newer than the file."}`;
    body.style.cssText = "margin:0 0 20px";
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end";
    const finish = (choice) => { dialog.close(); dialog.remove(); resolve(choice); };
    const button = (label, choice, style) => {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = label;
      element.setAttribute("data-choice", choice);
      element.style.cssText = `padding:10px 16px;border-radius:6px;font:inherit;font-weight:600;cursor:pointer;${style}`;
      element.addEventListener("click", () => finish(choice));
      actions.appendChild(element);
      return element;
    };
    const separate = button("Open separately", JOB_FILE_CHOICES.SEPARATE, "background:#1976d2;color:#fff;border:1px solid #1976d2");
    button("Cancel", JOB_FILE_CHOICES.CANCEL, "background:#fff;color:#0f172a;border:1px solid #94a3b8");
    button("Restore this revision", JOB_FILE_CHOICES.RESTORE, "background:#fff;color:#b91c1c;border:1px solid #b91c1c");
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(JOB_FILE_CHOICES.CANCEL); });
    dialog.append(title, body, actions);
    document.body.appendChild(dialog);
    dialog.showModal();
    separate.focus();
  });
}
