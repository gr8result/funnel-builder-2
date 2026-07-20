import TakeoffWorkspace from "../takeoff-engine/components/TakeoffWorkspace";

export default function AIPlanTakeoffPage({ sheet }) {
  return <TakeoffWorkspace sheet={sheet} activeRoute="/modules/estimate-builder" />;
}
