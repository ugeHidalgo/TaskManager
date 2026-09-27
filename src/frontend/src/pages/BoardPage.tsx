import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  formatDateOnly,
  createTask,
  createRecurringTasks,
  deleteTask,
  getBoardForWeek,
  getTasksForWeek,
  updateTask,
  type SaveTaskInput,
  type TaskPayload,
} from "../api/board";
import { useAuth } from "../auth/useAuth";
import {
  TaskEditor,
  WeekLayout,
  type BoardViewMode,
} from "../features/board/components";
import {
  useWeekCalculation,
  formatWeekDisplay,
  shiftDateByDays,
} from "../features/board/hooks/useWeekCalculation";
import { getToken } from "../lib/session";

const BOARD_VIEW_MODE_KEY = "taskmanager.boardViewMode";
type StatusMessagePhase = "blinking" | "static" | null;

function getInitialBoardViewMode(): BoardViewMode {
  const storedMode = window.localStorage.getItem(BOARD_VIEW_MODE_KEY);
  return storedMode === "fullweek" ? "fullweek" : "workweek";
}

export function BoardPage() {
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const token = getToken();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<BoardViewMode>(
    getInitialBoardViewMode,
  );
  const [tasks, setTasks] = useState<TaskPayload[]>([]);
  const [pendingStatusTaskIds, setPendingStatusTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingDeleteTaskIds, setPendingDeleteTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadedWeekStartDate, setLoadedWeekStartDate] = useState<string | null>(
    null,
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTask, setEditorTask] = useState<TaskPayload | undefined>();
  const [editorOpener, setEditorOpener] = useState<HTMLElement | null>(null);
  const [editorDayDate, setEditorDayDate] = useState<Date | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [statusMessagePhase, setStatusMessagePhase] =
    useState<StatusMessagePhase>(null);
  const { weekStart, weekEnd } = useWeekCalculation(selectedDate);
  const weekStartDateParam = formatDateOnly(weekStart);
  const weekDisplay = formatWeekDisplay(weekStart, weekEnd);

  useEffect(() => {
    if (statusMessagePhase === "blinking") {
      const timeoutId = window.setTimeout(
        () => setStatusMessagePhase("static"),
        10_000,
      );

      return () => window.clearTimeout(timeoutId);
    }

    if (statusMessagePhase === "static") {
      const timeoutId = window.setTimeout(() => {
        setSaveMessage(null);
        setStatusMessagePhase(null);
      }, 5_000);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [statusMessagePhase]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const sessionToken = token;
    let isCurrentRequest = true;
    const weekStartDate = new Date(`${weekStartDateParam}T00:00:00`);

    async function loadBoardWeek() {
      try {
        const [, weekTasks] = await Promise.all([
          getBoardForWeek(sessionToken, weekStartDate),
          getTasksForWeek(sessionToken, weekStartDate),
        ]);
        if (!isCurrentRequest) {
          return;
        }
        setTasks(weekTasks);
        setLoadedWeekStartDate(weekStartDateParam);
      } catch {
        if (!isCurrentRequest) {
          return;
        }
        // Error loading board data - will be displayed by backend error boundaries if needed
      }
    }

    void loadBoardWeek();

    return () => {
      isCurrentRequest = false;
    };
  }, [token, weekStartDateParam]);

  function handlePreviousWeek() {
    // Functional updates ensure rapid clicks apply in order without stale state.
    setSelectedDate((current) => shiftDateByDays(current, -7));
  }

  const visibleTasks = loadedWeekStartDate === weekStartDateParam ? tasks : [];
  const disableTaskActions =
    isEditorOpen ||
    isSaving ||
    pendingStatusTaskIds.size > 0 ||
    pendingDeleteTaskIds.size > 0;
  const taskAccessiblePositions = new Map(
    visibleTasks.map((task, index) => [task.id, index + 1]),
  );

  function handleNextWeek() {
    // Functional updates ensure rapid clicks apply in order without stale state.
    setSelectedDate((current) => shiftDateByDays(current, 7));
  }

  function handleCurrentWeek() {
    // Return to the actual current week.
    setSelectedDate(new Date());
  }

  function handleViewModeChange(mode: BoardViewMode) {
    setViewMode(mode);
    window.localStorage.setItem(BOARD_VIEW_MODE_KEY, mode);
  }

  function openTaskEditor(dayDate: Date | null, task?: TaskPayload) {
    setEditorOpener(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
    setIsEditorOpen(true);
    setEditorTask(task);
    setEditorDayDate(dayDate);
    setEditorError(null);
    setSaveMessage(null);
    setStatusMessagePhase(null);
  }

  function closeTaskEditor() {
    setIsEditorOpen(false);
    setEditorTask(undefined);
    if (editorOpener) {
      window.requestAnimationFrame(() => {
        if (editorOpener.isConnected) {
          editorOpener.focus();
        }
      });
    }
    setEditorOpener(null);
  }

  async function handleTaskSave(input: SaveTaskInput) {
    if (!token) {
      return;
    }

    setIsSaving(true);
    setEditorError(null);

    try {
      if (editorTask) {
        await updateTask(token, editorTask.id, input);
      } else if (input.isRecurring) {
        const result = await createRecurringTasks(token, input);
        const refreshedTasks = await getTasksForWeek(token, weekStart);
        setTasks(refreshedTasks);
        closeTaskEditor();
        setSaveMessage(`${result.createdCount} tasks created.`);
        setStatusMessagePhase(null);
        return;
      } else {
        await createTask(token, input);
      }

      const refreshedTasks = await getTasksForWeek(token, weekStart);
      setTasks(refreshedTasks);
      closeTaskEditor();
      setSaveMessage(editorTask ? "Task updated." : "Task created.");
      setStatusMessagePhase(null);
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : "Could not save the task.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTaskStatusToggle(task: TaskPayload) {
    if (!token) {
      return;
    }

    const nextStatus = getNextTaskStatus(task.status);
    setPendingStatusTaskIds((current) => new Set(current).add(task.id));
    try {
      await updateTask(token, task.id, {
        weekStartDate: weekStartDateParam,
        title: task.title,
        dayDate: task.dayDate,
        notes: task.notes,
        status: nextStatus,
        executionTime: task.executionTime ?? "",
      });
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id
            ? { ...currentTask, status: nextStatus }
            : currentTask,
        ),
      );
      setSaveMessage(
        nextStatus === "Completed"
          ? "Task completed."
          : nextStatus === "In Progress"
            ? "Task started."
            : "Task reopened.",
      );
      setStatusMessagePhase("blinking");
    } catch (error) {
      setStatusMessagePhase(null);
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Could not update task status. Please try again.",
      );
    } finally {
      setPendingStatusTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  async function handleTaskDelete(task: TaskPayload) {
    if (!token || !window.confirm(`Delete task "${task.title}" permanently?`)) {
      return;
    }

    setPendingDeleteTaskIds((current) => new Set(current).add(task.id));
    try {
      await deleteTask(token, task.id, weekStartDateParam);
      setTasks((currentTasks) =>
        currentTasks.filter((currentTask) => currentTask.id !== task.id),
      );
      setSaveMessage("Task deleted.");
      setStatusMessagePhase(null);
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Could not delete the task. Please try again.",
      );
      setStatusMessagePhase(null);
    } finally {
      setPendingDeleteTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  function handleLogout() {
    const confirmed = window.confirm("Are you sure you want to log out?");
    if (!confirmed) {
      return;
    }

    logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div className="topbar-title-nav">
          <h1>{weekDisplay}</h1>
          <div className="week-nav" role="group" aria-label="Week navigation">
            <button
              type="button"
              onClick={handlePreviousWeek}
              aria-label="Go to previous week"
              title="Previous Week"
              className="nav-arrow-btn"
            >
              ◄
            </button>
            <button
              type="button"
              onClick={handleCurrentWeek}
              aria-label="Go to current week"
              title="Actual Week"
              className="nav-arrow-btn nav-square-btn"
            >
              ■
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              aria-label="Go to next week"
              title="Next Week"
              className="nav-arrow-btn"
            >
              ►
            </button>
          </div>
        </div>
        <div className="topbar-actions">
          <label htmlFor="board-view-mode">View</label>
          <select
            id="board-view-mode"
            value={viewMode}
            onChange={(event) =>
              handleViewModeChange(event.target.value as BoardViewMode)
            }
          >
            <option value="workweek">Workweek (Mon-Fri)</option>
            <option value="fullweek">Full week (Mon-Sun)</option>
          </select>
          <span className="muted">Signed in as {username ?? "unknown"}</span>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {saveMessage ? (
        <p
          className={`save-message${statusMessagePhase === "blinking" ? " save-message-status-change" : ""}`}
          role="status"
          aria-live="polite"
        >
          {saveMessage}
        </p>
      ) : null}

      <WeekLayout
        weekStart={weekStart}
        weekEnd={weekEnd}
        viewMode={viewMode}
        taskActionsDisabled={disableTaskActions}
        onAddTask={(dayDate) => openTaskEditor(dayDate)}
        weekContent={renderTasks(
          visibleTasks.filter((task) => task.dayDate === null),
          (task) => openTaskEditor(null, task),
          handleTaskStatusToggle,
          handleTaskDelete,
          pendingStatusTaskIds,
          pendingDeleteTaskIds,
          taskAccessiblePositions,
          disableTaskActions,
        )}
        dayContent={Array.from({ length: 7 }, (_, dayIndex) => {
          const dayDate = formatDateOnly(shiftDateByDays(weekStart, dayIndex));

          return renderTasks(
            visibleTasks.filter((task) => task.dayDate === dayDate),
            (task) => openTaskEditor(new Date(`${dayDate}T00:00:00`), task),
            handleTaskStatusToggle,
            handleTaskDelete,
            pendingStatusTaskIds,
            pendingDeleteTaskIds,
            taskAccessiblePositions,
            disableTaskActions,
          );
        })}
      />

      {token && isEditorOpen ? (
        <TaskEditor
          weekStart={weekStart}
          viewMode={viewMode}
          initialDayDate={editorDayDate}
          task={editorTask}
          isSaving={isSaving}
          errorMessage={editorError}
          onCancel={closeTaskEditor}
          onSave={handleTaskSave}
        />
      ) : null}
    </main>
  );
}

function renderTasks(
  tasks: TaskPayload[],
  onEdit: (task: TaskPayload) => void,
  onStatusToggle: (task: TaskPayload) => void,
  onDelete: (task: TaskPayload) => void,
  pendingStatusTaskIds: ReadonlySet<string>,
  pendingDeleteTaskIds: ReadonlySet<string>,
  taskAccessiblePositions: ReadonlyMap<string, number>,
  disableTaskActions: boolean,
) {
  if (tasks.length === 0) {
    return undefined;
  }

  return tasks.map((task) => {
    const isCompleted = task.status === "Completed";
    const nextStatus = getNextTaskStatus(task.status);
    const isUpdatingStatus = pendingStatusTaskIds.has(task.id);
    const isDeleting = pendingDeleteTaskIds.has(task.id);
    const taskPosition = taskAccessiblePositions.get(task.id) ?? 1;

    return (
      <div
        key={task.id}
        className={`task-item${isCompleted ? " task-item-completed" : ""}`}
        aria-busy={isUpdatingStatus || isDeleting}
      >
        <div className="task-content">
          <div className="task-title-row">
            {task.dayDate !== null && task.executionTime ? (
              <time
                className="task-execution-time"
                dateTime={task.executionTime}
              >
                {task.executionTime}
              </time>
            ) : null}
            <strong
              className={`task-title${isCompleted ? " task-title-completed" : ""}`}
            >
              {task.title}
            </strong>
          </div>
          <div className="task-controls-row">
            <input
              type="checkbox"
              className="task-completion-checkbox"
              checked={isCompleted}
              disabled={disableTaskActions}
              onChange={() => void onStatusToggle(task)}
              aria-label={`Task ${taskPosition}: ${getTaskStatusAction(nextStatus)} ${task.title}`}
            />
            <button
              type="button"
              className="edit-task-button"
              disabled={disableTaskActions}
              onClick={() => onEdit(task)}
              aria-label={`Task ${taskPosition}: Edit task: ${task.title}`}
              title="Edit task"
            >
              ✎
            </button>
            <button
              type="button"
              className="delete-task-button"
              disabled={disableTaskActions}
              onClick={() => void onDelete(task)}
              aria-label={`Task ${taskPosition}: Delete task: ${task.title}`}
              title="Delete task"
            >
              ✕
            </button>
            {task.status === "In Progress" ? (
              <span className="task-progress-label">In progress</span>
            ) : null}
            {task.status === "Not Started" ? (
              <span className="task-not-started-label">Not Started</span>
            ) : null}
          </div>
          {!isCompleted && task.notes ? (
            <div className="task-description">{task.notes}</div>
          ) : null}
        </div>
      </div>
    );
  });
}

function getNextTaskStatus(
  status: TaskPayload["status"],
): TaskPayload["status"] {
  if (status === "Completed") {
    return "Not Started";
  }

  if (status === "Not Started") {
    return "In Progress";
  }

  return "Completed";
}

function getTaskStatusAction(status: TaskPayload["status"]): string {
  if (status === "Completed") {
    return "Complete";
  }

  if (status === "In Progress") {
    return "Start";
  }

  return "Reopen";
}
