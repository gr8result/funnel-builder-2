import { useMemo, useState } from "react";
import { defaultPlannerAnswers, generateSchedulePlan, visibleQuestionnaireConfig } from "../../lib/gantt/scheduleEngine";

export function useGanttPlanner() {
  const [showPlanner, setShowPlanner] = useState(false);
  const [plannerStep, setPlannerStep] = useState("questions");
  const [plannerAnswers, setPlannerAnswers] = useState(defaultPlannerAnswers);
  const [plannerPlan, setPlannerPlan] = useState(null);

  const visiblePlannerQuestions = useMemo(() => visibleQuestionnaireConfig(plannerAnswers), [plannerAnswers]);

  function openPlanner() {
    setPlannerAnswers(defaultPlannerAnswers());
    setPlannerPlan(null);
    setPlannerStep("questions");
    setShowPlanner(true);
  }

  function updatePlannerAnswer(key, value, multiple = false) {
    setPlannerAnswers((current) => {
      if (!multiple) return { ...current, [key]: value };
      const nextValues = new Set(current[key] || []);
      if (nextValues.has(value)) nextValues.delete(value);
      else nextValues.add(value);
      return { ...current, [key]: Array.from(nextValues) };
    });
  }

  function generatePlannerPreview() {
    const plan = generateSchedulePlan(plannerAnswers);
    setPlannerPlan(plan);
    setPlannerStep("review");
  }

  function requestCreateGanttFromPlan() {
    alert("Stage 1 stops at preview. I have not wired this into gantt_tasks yet, so the existing manual Gantt stays untouched.");
  }

  return {
    showPlanner,
    setShowPlanner,
    plannerStep,
    setPlannerStep,
    plannerAnswers,
    plannerPlan,
    visiblePlannerQuestions,
    openPlanner,
    updatePlannerAnswer,
    generatePlannerPreview,
    requestCreateGanttFromPlan,
  };
}
