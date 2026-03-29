import { hydrateProblemSetGlobalRules } from "./problemSetGlobalRules";
import { hydrateQuizGlobalRules } from "./quizGlobalRules";
import { hydrateWeekFormatInstructions } from "./weekFormatInstructions";
import { hydrateWeekSummaryCache } from "./weekSummaryCache";

/** Restore localStorage-backed week editor state (summaries, format rules). */
export function hydrateWeekWorkspace(): void {
  hydrateWeekSummaryCache();
  hydrateWeekFormatInstructions();
  hydrateProblemSetGlobalRules();
  hydrateQuizGlobalRules();
}
