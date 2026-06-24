import { useState } from "react";
import ConstructionEstimateWorksheet from "./ConstructionEstimateWorksheet";
import EstimateWorksheetV2 from "./EstimateWorksheetV2";
import EstimateWorksheetV3 from "./EstimateWorksheetV3";
import EstimateWorksheetV4 from "./EstimateWorksheetV4";

export default function GanttSchedulePlannerModal({
  S,
  showPlanner,
  setShowPlanner,
  plannerStep,
  setPlannerStep,
  plannerAnswers,
  plannerPlan,
  estimatePreview,
  visiblePlannerQuestions,
  updatePlannerAnswer,
  generatePlannerPreview,
  generateEstimatePreview,
  requestCreateGanttFromPlan,
}) {
  const [fullScreen, setFullScreen] = useState(false);

  if (!showPlanner) return null;

  const modalStyle = fullScreen
    ? {
        ...S.modal,
        width: "calc(100vw - 32px)",
        maxWidth: "none",
        height: "calc(100vh - 32px)",
        maxHeight: "none",
        overflow: "auto",
        padding: 20,
      }
    : { ...S.modal, maxWidth: 980, maxHeight: "88vh", overflow: "auto" };

  return (
    <div
      style={S.overlay}
      onClick={() => setShowPlanner(false)}
    >
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={S.modalTitle}>Plan From Template</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={S.cancelBtn} onClick={() => setFullScreen((current) => !current)}>
              {fullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
            <button style={S.cancelBtn} onClick={() => setShowPlanner(false)}>Close</button>
          </div>
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
              <button style={S.cancelBtn} onClick={() => { setFullScreen(true); setPlannerStep("worksheetV4"); }}>Estimate Worksheet V4</button>
              <button style={S.cancelBtn} onClick={() => { setFullScreen(true); setPlannerStep("worksheetV3"); }}>Estimate Worksheet V3</button>
              <button style={S.cancelBtn} onClick={() => { setFullScreen(true); setPlannerStep("worksheetV2"); }}>Estimate Worksheet V2</button>
              <button style={S.cancelBtn} onClick={() => setPlannerStep("worksheet")}>Detailed Estimate Worksheet</button>
              <button style={S.cancelBtn} onClick={generateEstimatePreview}>Construction Estimate Preview</button>
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
              <button style={S.cancelBtn} onClick={() => { setFullScreen(true); setPlannerStep("worksheetV4"); }}>Estimate Worksheet V4</button>
              <button style={S.cancelBtn} onClick={() => { setFullScreen(true); setPlannerStep("worksheetV3"); }}>Estimate Worksheet V3</button>
              <button style={S.cancelBtn} onClick={() => { setFullScreen(true); setPlannerStep("worksheetV2"); }}>Estimate Worksheet V2</button>
              <button style={S.cancelBtn} onClick={() => setPlannerStep("worksheet")}>Detailed Estimate Worksheet</button>
              <button style={S.cancelBtn} onClick={generateEstimatePreview}>Construction Estimate Preview</button>
              <button style={S.cancelBtn} onClick={() => setShowPlanner(false)}>Close</button>
              <button style={S.primaryBtn} onClick={requestCreateGanttFromPlan}>Create Gantt From Plan</button>
            </div>
          </>
        )}

        {plannerStep === "estimate" && estimatePreview && (
          <>
            <div style={S.plannerStats}>
              <div style={S.plannerStatCard}>
                <span>Project type</span>
                <strong>{estimatePreview.inputs.projectType}</strong>
              </div>
              <div style={S.plannerStatCard}>
                <span>Floor area</span>
                <strong>{estimatePreview.inputs.floorAreaM2} m2</strong>
              </div>
              <div style={S.plannerStatCard}>
                <span>Contract duration</span>
                <strong>{estimatePreview.contractDuration.estimatedContractDays} days</strong>
              </div>
              <div style={S.plannerStatCard}>
                <span>Long-lead items</span>
                <strong>{estimatePreview.procurementItems.filter((item) => item.critical).length}</strong>
              </div>
            </div>

            <div style={S.plannerReviewGrid}>
              <div style={S.plannerReviewPanel}>
                <h3 style={S.plannerPanelTitle}>Project Inputs Summary</h3>
                {[
                  ["Site", estimatePreview.inputs.siteConditions],
                  ["Slab", estimatePreview.inputs.slabType],
                  ["Walls", estimatePreview.inputs.wallConstruction],
                  ["Roof", estimatePreview.inputs.roofType],
                  ["Retaining", estimatePreview.inputs.retainingWalls],
                  ["Access", estimatePreview.inputs.siteAccess],
                ].map(([label, value]) => (
                  <div key={label} style={S.plannerTradeRow}><span>{label}</span><strong>{value}</strong></div>
                ))}
              </div>
              <div style={S.plannerReviewPanel}>
                <h3 style={S.plannerPanelTitle}>Quantities</h3>
                {Object.entries(estimatePreview.quantities).slice(0, 12).map(([key, value]) => (
                  <div key={key} style={S.plannerTradeRow}>
                    <span>{prettyLabel(key)}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.plannerReviewGrid}>
              <div style={S.plannerReviewPanel}>
                <h3 style={S.plannerPanelTitle}>Assemblies Selected</h3>
                <div style={S.plannerGroupTasks}>
                  {estimatePreview.assemblies.map((assembly) => (
                    <span key={assembly.id}>{assembly.name} - {assembly.trade}</span>
                  ))}
                </div>
              </div>
              <div style={S.plannerReviewPanel}>
                <h3 style={S.plannerPanelTitle}>Contract Duration Estimate</h3>
                <div style={S.plannerTradeRow}><span>Base duration</span><strong>{estimatePreview.contractDuration.baseDurationDays} days</strong></div>
                <div style={S.plannerTradeRow}><span>Working days</span><strong>{estimatePreview.contractDuration.estimatedWorkingDays}</strong></div>
                <div style={S.plannerTradeRow}><span>Region placeholder</span><strong>{estimatePreview.contractDuration.region}</strong></div>
                {estimatePreview.contractDuration.complexityAdjustments.map((item) => (
                  <div key={item.reason} style={S.plannerTradeRow}><span>{item.reason}</span><strong>+{item.days} days</strong></div>
                ))}
              </div>
            </div>

            <div style={S.plannerReviewPanel}>
              <h3 style={S.plannerPanelTitle}>Material Takeoff Groups</h3>
              <div style={S.plannerTableWrap}>
                <table style={S.plannerTable}>
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Trade</th>
                      <th>Material</th>
                      <th>Qty</th>
                      <th>Waste</th>
                      <th>Final Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimatePreview.takeoffGroups.flatMap((group) => group.items.map((item) => (
                      <tr key={`${group.assemblyId}-${item.materialId}`}>
                        <td>{group.category}</td>
                        <td>{group.trade}</td>
                        <td>{item.description}</td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>{Math.round(item.wasteFactor * 100)}%</td>
                        <td>{item.finalQuantity} {item.unit}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={S.plannerReviewPanel}>
              <h3 style={S.plannerPanelTitle}>Procurement Items and Lead Times</h3>
              <div style={S.plannerTableWrap}>
                <table style={S.plannerTable}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Supplier</th>
                      <th>Lead Time</th>
                      <th>Required By</th>
                      <th>Order By</th>
                      <th>Critical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimatePreview.procurementItems.map((item) => (
                      <tr key={item.materialId}>
                        <td>{item.name}</td>
                        <td>{item.supplierCategory}</td>
                        <td>{item.leadTimeDays} days</td>
                        <td>Day {item.requiredByDay}</td>
                        <td>Day {item.orderByDay}</td>
                        <td>{item.critical ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={() => setPlannerStep("questions")}>Back to Questions</button>
              {plannerPlan && <button style={S.cancelBtn} onClick={() => setPlannerStep("review")}>Back to Schedule Preview</button>}
              <button style={S.cancelBtn} onClick={() => setShowPlanner(false)}>Close</button>
            </div>
          </>
        )}

        {plannerStep === "worksheet" && (
          <ConstructionEstimateWorksheet
            S={S}
            plannerAnswers={plannerAnswers}
            fullScreen={fullScreen}
            onBack={() => setPlannerStep("questions")}
            onClose={() => setShowPlanner(false)}
          />
        )}

        {plannerStep === "worksheetV2" && (
          <EstimateWorksheetV2
            plannerAnswers={plannerAnswers}
            onBack={() => setPlannerStep("questions")}
            onClose={() => setShowPlanner(false)}
          />
        )}

        {plannerStep === "worksheetV3" && (
          <EstimateWorksheetV3
            plannerAnswers={plannerAnswers}
            onBack={() => setPlannerStep("questions")}
            onClose={() => setShowPlanner(false)}
          />
        )}

        {plannerStep === "worksheetV4" && (
          <EstimateWorksheetV4
            plannerAnswers={plannerAnswers}
            onBack={() => setPlannerStep("questions")}
            onClose={() => setShowPlanner(false)}
          />
        )}
      </div>
    </div>
  );
}

function prettyLabel(value) {
  return value
    .replace(/M2/g, " m2")
    .replace(/Lm/g, " lm")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}
