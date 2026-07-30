import Link from "next/link";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import {
  INCLUSIONS_SELECTIONS_STAGES,
  PROJECT_REQUIRED_MESSAGE,
  hrefForStage,
  stageIndex,
  type InclusionsSelectionsStageId,
} from "../routing/stageNavigation";

type Props = {
  currentStage: InclusionsSelectionsStageId;
  context: Partial<ProjectSelectionContext>;
  maxAvailableStage?: InclusionsSelectionsStageId;
};

export function InclusionsSelectionsStageNav({ currentStage, context, maxAvailableStage = "documents-export" }: Props) {
  const currentIndex = stageIndex(currentStage);
  const maxAvailableIndex = Math.max(stageIndex(maxAvailableStage), currentIndex);
  const hasProject = Boolean(context.organisationId && context.projectId);
  const projectLabel = context.projectName || context.projectId || "Project";
  const projectMeta = [context.clientName, context.siteAddress].filter(Boolean).join(" / ");

  return (
    <nav className="inclusionsStageNav" aria-label="Inclusions and Selections stages">
      <div className="stageProject">
        <span>Inclusions & Selections</span>
        <strong>{hasProject ? projectLabel : "Project required"}</strong>
        {hasProject && projectMeta ? <small>{projectMeta}</small> : null}
        {!hasProject ? (
          <p>
            {PROJECT_REQUIRED_MESSAGE} <Link href="/modules/construction">Back to Projects Hub</Link>
          </p>
        ) : null}
      </div>
      <ol>
        {INCLUSIONS_SELECTIONS_STAGES.map((stage, index) => {
          const current = stage.id === currentStage;
          const complete = index < currentIndex;
          const available = hasProject && index <= maxAvailableIndex;
          const className = current ? "current" : complete ? "complete" : available ? "available" : "blocked";
          return (
            <li key={stage.id} className={className}>
              {available ? (
                <Link href={hrefForStage(stage.id, context)} aria-current={current ? "page" : undefined}>
                  <span>{index + 1}</span>
                  {stage.label}
                </Link>
              ) : (
                <button type="button" disabled aria-disabled="true">
                  <span>{index + 1}</span>
                  {stage.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <style jsx>{`
        .inclusionsStageNav {
          max-width: 1320px;
          margin: 0 auto 18px;
          display: grid;
          grid-template-columns: minmax(220px, 320px) 1fr;
          gap: 14px;
          align-items: stretch;
        }
        .stageProject, ol {
          background: #fff;
          border: 1px solid #dfe6ef;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(20, 31, 51, 0.04);
        }
        .stageProject {
          padding: 14px;
          min-width: 0;
        }
        .stageProject span, .stageProject small {
          display: block;
          color: #647082;
          font-size: 12px;
        }
        .stageProject strong {
          display: block;
          margin: 4px 0;
          color: #172033;
          overflow-wrap: anywhere;
        }
        .stageProject p {
          margin: 8px 0 0;
          color: #7f1d1d;
          font-size: 13px;
          line-height: 1.4;
        }
        ol {
          list-style: none;
          padding: 10px;
          margin: 0;
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          min-width: 0;
        }
        li {
          min-width: 0;
        }
        a, button {
          width: 100%;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 6px;
          border: 1px solid #d7e0eb;
          background: #f8fafc;
          color: #293449;
          text-decoration: none;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          padding: 8px;
          text-align: center;
          cursor: pointer;
        }
        button:disabled {
          cursor: not-allowed;
          color: #94a3b8;
          background: #f1f5f9;
        }
        span {
          flex: 0 0 auto;
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #e2e8f0;
          color: #334155;
          font-size: 12px;
        }
        .current a {
          background: #155e75;
          border-color: #155e75;
          color: #fff;
        }
        .current span {
          background: #fff;
          color: #155e75;
        }
        .complete a {
          background: #ecfdf5;
          border-color: #bbf7d0;
          color: #14532d;
        }
        .complete span {
          background: #22c55e;
          color: #fff;
        }
        @media (max-width: 980px) {
          .inclusionsStageNav {
            grid-template-columns: 1fr;
          }
          ol {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .inclusionsStageNav {
            margin-bottom: 14px;
          }
          ol {
            grid-template-columns: 1fr;
          }
          a, button {
            justify-content: flex-start;
          }
        }
      `}</style>
    </nav>
  );
}
