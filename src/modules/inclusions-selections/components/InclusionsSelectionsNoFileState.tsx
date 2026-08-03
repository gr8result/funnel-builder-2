import { useRouter } from "next/router";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import { projectDashboardHref } from "../services/projectFileManagementService";

const NEW_FILE_EVENT = "inclusions-selections:new-file";
const OPEN_FILE_EVENT = "inclusions-selections:open-file";

type Props = {
  context: Partial<ProjectSelectionContext>;
};

export function InclusionsSelectionsNoFileState({ context }: Props) {
  const router = useRouter();

  return (
    <section className="noSelectionsFileState" aria-label="No selections file open">
      <h1>No selections file open</h1>
      <p>Create a new selections file or open an existing file from your computer.</p>
      <div className="noFileActions">
        <button type="button" className="primaryButton" onClick={() => window.dispatchEvent(new Event(NEW_FILE_EVENT))}>New File</button>
        <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_FILE_EVENT))}>Open File</button>
        <button type="button" onClick={() => void router.push(projectDashboardHref(context))}>Back to Project Dashboard</button>
      </div>
      <style jsx>{`
        .noSelectionsFileState {
          max-width: 760px;
          margin: 34px auto;
          border: 1px solid #d9e2ee;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(20, 31, 51, 0.08);
          padding: 34px;
          text-align: center;
          color: #172033;
        }
        h1 {
          margin: 0 0 10px;
          font-size: 34px;
          line-height: 1.1;
          letter-spacing: 0;
        }
        p {
          margin: 0 auto 22px;
          max-width: 520px;
          color: #526173;
          font-size: 17px;
          line-height: 1.5;
        }
        .noFileActions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
        }
        button {
          min-height: 42px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          color: #172033;
          font: inherit;
          font-size: 14px;
          font-weight: 750;
          padding: 8px 14px;
          cursor: pointer;
        }
        .primaryButton {
          background: #155e75;
          border-color: #155e75;
          color: #ffffff;
        }
        @media (max-width: 640px) {
          .noSelectionsFileState {
            margin: 20px auto;
            padding: 24px 16px;
          }
          h1 {
            font-size: 28px;
          }
          .noFileActions {
            display: grid;
          }
        }
      `}</style>
    </section>
  );
}
