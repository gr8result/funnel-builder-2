export default function GanttSchedulePlannerModal({
  S,
  showPlanner,
  setShowPlanner,
  plannerStep,
  setPlannerStep,
  plannerAnswers,
  plannerPlan,
  visiblePlannerQuestions,
  updatePlannerAnswer,
  generatePlannerPreview,
  requestCreateGanttFromPlan,
}) {
  if (!showPlanner) return null;

  return (
    <div
      style={S.overlay}
      onClick={() => setShowPlanner(false)}
    >
      <div style={{ ...S.modal, maxWidth: 980, maxHeight: "88vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={S.modalTitle}>Plan From Template</h2>
          <button style={S.cancelBtn} onClick={() => setShowPlanner(false)}>Close</button>
        </div>

        {plannerStep === "questions" && (
          <>
            <div style={S.plannerGrid}>
              {visiblePlannerQuestions.map((question) => (
                <div key={question.key} style={S.plannerSection}>
                  <div style={S.plannerLabel}>{question.label}</div>
                  <div style={question.multiple ? S.plannerOptionGrid : S.plannerSelectWrap}>
                    {question.multiple ? question.options.map((option) => {
                      const selected = (plannerAnswers[question.key] || []).includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          style={{ ...S.plannerChoice, ...(selected ? S.plannerChoiceActive : {}) }}
                          onClick={() => updatePlannerAnswer(question.key, option, true)}
                        >
                          {option}
                        </button>
                      );
                    }) : (
                      <select
                        style={S.input}
                        value={plannerAnswers[question.key] || question.options[0]}
                        onChange={(e) => updatePlannerAnswer(question.key, e.target.value)}
                      >
                        {question.options.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={() => setShowPlanner(false)}>Cancel</button>
              <button style={S.primaryBtn} onClick={generatePlannerPreview}>Generate Preview</button>
            </div>
          </>
        )}

        {plannerStep === "review" && plannerPlan && (
          <>
            <div style={S.plannerStats}>
              <div style={S.plannerStatCard}>
                <span>Template</span>
                <strong>{plannerPlan.baseTemplate.label}</strong>
              </div>
              <div style={S.plannerStatCard}>
                <span>Estimated build duration</span>
                <strong>{plannerPlan.estimatedBuildDuration} days</strong>
              </div>
              <div style={S.plannerStatCard}>
                <span>Working days</span>
                <strong>{plannerPlan.workingDays}</strong>
              </div>
              <div style={S.plannerStatCard}>
                <span>Critical path</span>
                <strong>{plannerPlan.criticalPath.length} tasks</strong>
              </div>
            </div>

            <div style={S.plannerReviewGrid}>
              <div style={S.plannerReviewPanel}>
                <h3 style={S.plannerPanelTitle}>Applied Rules</h3>
                {plannerPlan.appliedRules.length ? plannerPlan.appliedRules.map((rule) => (
                  <span key={rule.id} style={S.plannerPill}>{rule.label}</span>
                )) : <span style={S.plannerEmpty}>No complexity rules added.</span>}
              </div>
              <div style={S.plannerReviewPanel}>
                <h3 style={S.plannerPanelTitle}>Trade Schedule Summary</h3>
                <div style={S.plannerTradeList}>
                  {plannerPlan.tradeSchedule.map((trade) => (
                    <div key={trade.trade} style={S.plannerTradeRow}>
                      <span>{trade.trade}</span>
                      <strong>{trade.taskCount} task{trade.taskCount !== 1 ? "s" : ""} · {trade.workingDays} days</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={S.plannerReviewPanel}>
              <h3 style={S.plannerPanelTitle}>Generated Task List</h3>
              <div style={S.plannerGroupList}>
                {plannerPlan.taskGroups.map((group) => (
                  <div key={group.group} style={S.plannerGroupBlock}>
                    <div style={S.plannerGroupTitle}>{group.group}</div>
                    <div style={S.plannerGroupTasks}>
                      {group.tasks.map((task) => (
                        <span key={`${group.group}-${task.name}`}>{task.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={S.plannerTableWrap}>
                <table style={S.plannerTable}>
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Group</th>
                      <th>Task</th>
                      <th>Phase</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Duration</th>
                      <th>Trade</th>
                      <th>Critical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plannerPlan.tasks.map((task, index) => (
                      <tr key={`${task.name}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{task.group}</td>
                        <td>{task.name}</td>
                        <td>{task.phase}</td>
                        <td>{task.start_day}</td>
                        <td>{task.end_day}</td>
                        <td>{task.duration_days}</td>
                        <td>{task.trade_category}</td>
                        <td>{task.critical_path ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={() => setPlannerStep("questions")}>Back</button>
              <button style={S.cancelBtn} onClick={() => setShowPlanner(false)}>Close</button>
              <button style={S.primaryBtn} onClick={requestCreateGanttFromPlan}>Create Gantt From Plan</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
