// Reads the existing Job Board (job_board_jobs / job_board_boards / job_board_tasks) for the trade payment schedule, with the signed-in
// user's own session. Read-only: the Job Board page stays the only place its cards are written.

async function signedInUser(db) {
  const { data } = await db.auth.getUser();
  return data?.user || null;
}

// The user's Job Board jobs, each with its board's columns (the stable task keys a milestone can be linked to).
export async function loadJobBoardJobs(db) {
  const user = await signedInUser(db);
  if (!user) return { ok: false, code: "SIGN_IN_REQUIRED", message: "Sign in to read the Job Board." };
  const [{ data: jobs, error: jobsError }, { data: boards, error: boardsError }] = await Promise.all([
    db.from("job_board_jobs").select("id, name, board_id").eq("user_id", user.id).order("sort_order", { ascending: true }),
    db.from("job_board_boards").select("id, name, task_list").eq("user_id", user.id),
  ]);
  if (jobsError || boardsError) return { ok: false, code: "JOB_BOARD_UNAVAILABLE", message: (jobsError || boardsError).message };
  const boardById = new Map((boards || []).map((board) => [board.id, board]));
  return {
    ok: true,
    jobs: (jobs || []).map((job) => {
      const board = boardById.get(job.board_id);
      return { id: String(job.id), name: job.name || "", boardName: board?.name || "", columns: (Array.isArray(board?.task_list) ? board.task_list : []).map((column) => ({ key: column.key, label: column.label || column.key })) };
    }),
  };
}

// Every task record of the given Job Board jobs. The jobs are filtered to the signed-in user's own, so an id copied from another
// account's job returns nothing.
export async function loadJobBoardTaskRecords(db, jobIds = []) {
  const wanted = [...new Set(jobIds.filter(Boolean).map(String))];
  if (!wanted.length) return { ok: true, records: [], jobIds: [] };
  const user = await signedInUser(db);
  if (!user) return { ok: false, code: "SIGN_IN_REQUIRED", message: "Sign in to read the Job Board." };
  const { data: jobs, error: jobsError } = await db.from("job_board_jobs").select("id").eq("user_id", user.id).in("id", wanted);
  if (jobsError) return { ok: false, code: "JOB_BOARD_UNAVAILABLE", message: jobsError.message };
  const owned = (jobs || []).map((job) => String(job.id));
  if (!owned.length) return { ok: true, records: [], jobIds: [] };
  const { data, error } = await db.from("job_board_tasks").select("job_id, task_key, status, card_order").in("job_id", owned);
  if (error) return { ok: false, code: "JOB_BOARD_UNAVAILABLE", message: error.message };
  return { ok: true, records: data || [], jobIds: owned };
}
