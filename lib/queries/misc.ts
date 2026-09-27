import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayIso, weekStartIso } from "@/lib/dates";
import type { Alert, DailyTask, Goal, GoalEntry, WeeklyScore, WeeklyTarget } from "@/lib/types";

export async function getGoals(): Promise<Goal[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("goals").select("*").order("sort");
  return data ?? [];
}

export async function getGoalEntries(goalId?: string): Promise<GoalEntry[]> {
  const supabase = await createClient();
  let query = supabase.from("goal_entries").select("*").order("date", { ascending: false });
  if (goalId) query = query.eq("goal_id", goalId);
  const { data } = await query;
  return data ?? [];
}

export async function getWeeklyTargets(): Promise<WeeklyTarget[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("weekly_targets").select("*").order("sort");
  return data ?? [];
}

export async function getWeeklyScores(weeks = 12): Promise<WeeklyScore[]> {
  const supabase = await createClient();
  const from = weekStartIso(todayIso());
  const earliest = new Date(`${from}T00:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - weeks * 7);
  const { data } = await supabase
    .from("weekly_scores")
    .select("*")
    .gte("week_start", earliest.toISOString().slice(0, 10))
    .order("week_start");
  return data ?? [];
}

export async function getDailyTasks(date: string): Promise<DailyTask[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("daily_tasks").select("*").eq("date", date).order("sort");
  return data ?? [];
}

export async function getOpenAlerts(): Promise<Alert[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .is("resolved_at", null)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}
