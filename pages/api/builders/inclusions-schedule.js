const MESSAGE = "Inclusions & Selections is being rebuilt using a new room-based workflow.";

export default function retiredInclusionsScheduleApi(_req, res) {
  res.status(410).json({
    error: MESSAGE,
    retired: true,
  });
}
