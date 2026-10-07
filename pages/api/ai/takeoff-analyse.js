import { withAuth } from '../../../lib/withWorkspace';
import { createTakeoffAnalysisHandler } from '../../../lib/construction-estimation/aiTakeoffAnalysis.js';

export const config = {
  api: { bodyParser: { sizeLimit: '12mb' }, responseLimit: '2mb' },
  maxDuration: 300,
};

// Reuse the existing authenticated AI boundary. The legacy plan-detect route is
// deliberately independent: its overlays are never the canonical Takeoff objects.
export default withAuth(createTakeoffAnalysisHandler());
