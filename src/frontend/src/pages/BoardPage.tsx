import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  formatDateOnly,
  createTask,
  createRecurringTasks,
  deleteTask,
  getBoardForWeek,
  getTasksForWeek,
  moveTask,
  reorderTasks,
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
type PendingMove = {
  taskId: string;
  title: string;
  sourceWeekStartDate: string;
  sourceDayDate: string | null;
};

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
  const [pendingReorderLane, setPendingReorderLane] = useState<string | null>(
    null,
  );
  const [draggedTask, setDraggedTask] = useState<{
    taskId: string;
    laneKey: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    laneKey: string;
    taskId: string;
  } | null>(null);
  const [activeTaskMenuId, setActiveTaskMenuId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [isMoving, setIsMoving] = useState(false);
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
    if (!activeTaskMenuId && !pendingMove) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (
        activeTaskMenuId &&
        !target.closest(".task-context-menu, [data-task-menu-trigger]")
      ) {
        setActiveTaskMenuId(null);
      }

      if (
        pendingMove &&
        !target.closest(".week-nav, .pending-move-flow, [data-move-here]")
      ) {
        setPendingMove(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveTaskMenuId(null);
        setPendingMove(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTaskMenuId, pendingMove]);

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
    isMoving ||
    pendingMove !== null ||
    pendingStatusTaskIds.size > 0 ||
    pendingDeleteTaskIds.size > 0 ||
    pendingReorderLane !== null;
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

  function getDotNetUtcTicks(value: string): string {
    const fractionalSeconds =
      value.match(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/)?.[1] ?? "";
    const fractionalTicks = BigInt(fractionalSeconds.padEnd(7, "0"));
    const millisecondFraction = BigInt(
      fractionalSeconds.padEnd(3, "0").slice(0, 3),
    );
    const unixEpochTicks = 621355968000000000n;
    const millisecondsSinceUnixEpoch = BigInt(new Date(value).getTime());

    return (
      unixEpochTicks +
      millisecondsSinceUnixEpoch * 10000n +
      fractionalTicks -
      millisecondFraction * 10000n
    ).toString();
  }

  async function getWeekSnapshotVersion(
    weekStartDateValue: string,
    weekTasks: TaskPayload[],
  ) {
    const orderedTasks = [...weekTasks].sort((left, right) => {
      const leftKey = left.dayDate ?? "0000-00-00";
      const rightKey = right.dayDate ?? "0000-00-00";
      return (
        leftKey.localeCompare(rightKey) ||
        (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
          (right.orderIndex ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id)
      );
    });

    let snapshotContent = `${weekStartDateValue}`;
    for (const task of orderedTasks) {
      snapshotContent += `|${task.id}|${task.dayDate ?? "shared"}|${task.orderIndex ?? 0}|${task.title}|${task.notes ?? ""}|${task.status}|${task.executionTime}|${getDotNetUtcTicks(task.updatedAtUtc)}`;
    }

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(snapshotContent),
    );
    return Array.from(new Uint8Array(hashBuffer), (byte) =>
      byte.toString(16).padStart(2, "0"),
    )
      .join("")
      .toUpperCase();
  }

  async function handleMoveTask(
    taskId: string,
    sourceDayDate: string | null,
    destinationDayDate: string | null,
    destinationIndex: number,
    sourceWeekStartDateValue = weekStartDateParam,
    destinationWeekStartDateValue = weekStartDateParam,
  ) {
    if (!token) {
      return;
    }

    const sourceWeekStartDate = sourceWeekStartDateValue;
    const sourceWeekDate = new Date(`${sourceWeekStartDate}T00:00:00`);
    const destinationWeekStartDate = destinationWeekStartDateValue;
    setIsMoving(true);

    try {
      const sourceTasks = await getTasksForWeek(token, sourceWeekDate);
      const sourceBoard = await getBoardForWeek(token, sourceWeekDate);
      const sourceLaneTasks = sortTasks(
        sourceTasks.filter((task) => task.dayDate === sourceDayDate),
      );
      const sourceIndex = sourceLaneTasks.findIndex(
        (task) => task.id === taskId,
      );
      if (sourceIndex < 0) {
        setPendingMove(null);
        return;
      }

      const destinationTasks =
        destinationWeekStartDate === sourceWeekStartDate
          ? sourceTasks
          : await getTasksForWeek(
              token,
              new Date(`${destinationWeekStartDate}T00:00:00`),
            );
      const destinationLaneTasks = sortTasks(
        destinationTasks.filter((task) => task.dayDate === destinationDayDate),
      );
      const normalizedDestinationIndex = Math.max(
        0,
        Math.min(destinationIndex, destinationLaneTasks.length),
      );
      const sourceSnapshotVersion =
        sourceBoard.snapshotVersion ??
        (await getWeekSnapshotVersion(sourceWeekStartDate, sourceTasks));
      const destinationSnapshotVersion =
        destinationWeekStartDate === sourceWeekStartDate
          ? sourceSnapshotVersion
          : await getWeekSnapshotVersion(
              destinationWeekStartDate,
              destinationTasks,
            );

      const response = await moveTask(token, taskId, {
        sourceWeekStartDate,
        sourceDayDate,
        sourceIndex,
        destinationWeekStartDate: destinationWeekStartDate,
        destinationDayDate,
        destinationIndex: normalizedDestinationIndex,
        sourceSnapshotVersion,
        destinationSnapshotVersion,
      });

      if (destinationWeekStartDate === weekStartDateParam) {
        setTasks(response.destination.tasks);
      } else if (sourceWeekStartDate === weekStartDateParam) {
        setTasks(response.source.tasks);
      } else {
        const refreshedTasks = await getTasksForWeek(token, weekStart);
        setTasks(refreshedTasks);
      }

      setSaveMessage("Task moved.");
      setStatusMessagePhase(null);
    } catch (error) {
      try {
        const authoritativeTasks = await getTasksForWeek(token, weekStart);
        setTasks(authoritativeTasks);
      } catch {
        // Keep the current board until the next successful week load.
      }
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Could not move the task. Please try again.",
      );
      setStatusMessagePhase(null);
    } finally {
      setPendingMove(null);
      setIsMoving(false);
    }
  }

  function beginPendingMove(task: TaskPayload, sourceDayDate: string | null) {
    setActiveTaskMenuId(null);
    setPendingMove({
      taskId: task.id,
      title: task.title,
      sourceWeekStartDate: weekStartDateParam,
      sourceDayDate,
    });
  }

  function movePendingTaskHere(destinationDayDate: string | null) {
    if (!pendingMove) {
      return;
    }

    const destinationLaneTasks = sortTasks(
      visibleTasks.filter((task) => task.dayDate === destinationDayDate),
    );
    const isSameSourceLane =
      pendingMove.sourceWeekStartDate === weekStartDateParam &&
      pendingMove.sourceDayDate === destinationDayDate;
    const destinationIndex = destinationLaneTasks.filter(
      (task) => !isSameSourceLane || task.id !== pendingMove.taskId,
    ).length;
    setPendingMove(null);
    void handleMoveTask(
      pendingMove.taskId,
      pendingMove.sourceDayDate,
      destinationDayDate,
      destinationIndex,
      pendingMove.sourceWeekStartDate,
      weekStartDateParam,
    );
  }

  function handleViewModeChange(mode: BoardViewMode) {
    setViewMode(mode);
    window.localStorage.setItem(BOARD_VIEW_MODE_KEY, mode);
  }

  function handleCrossLaneDrop(
    taskId: string,
    sourceLaneKey: string,
    destinationDayDate: string | null,
    destinationIndex: number,
  ) {
    const sourceDayDate = sourceLaneKey === "shared" ? null : sourceLaneKey;
    void handleMoveTask(
      taskId,
      sourceDayDate,
      destinationDayDate,
      destinationIndex,
    );
    setDraggedTask(null);
  }

  async function handleTaskReorder(
    laneTasks: TaskPayload[],
    dayDate: string | null,
    sourceTaskId: string,
    targetIndex: number,
  ) {
    if (!token || laneTasks.length < 2) {
      return;
    }

    const orderedLaneTasks = sortTasks(laneTasks);
    const sourceIndex = orderedLaneTasks.findIndex(
      (task) => task.id === sourceTaskId,
    );
    if (sourceIndex < 0 || sourceIndex === targetIndex) {
      return;
    }

    const previousLaneTasks = orderedLaneTasks;
    const nextLaneTasks = [...orderedLaneTasks];
    const [movedTask] = nextLaneTasks.splice(sourceIndex, 1);
    nextLaneTasks.splice(targetIndex, 0, movedTask);
    const laneKey = getLaneKey(dayDate);
    const optimisticLaneTasks = nextLaneTasks.map((task, index) => ({
      ...task,
      orderIndex: index,
    }));

    setPendingReorderLane(laneKey);
    setTasks((currentTasks) =>
      replaceLaneTasks(currentTasks, dayDate, optimisticLaneTasks),
    );
    setDropTarget(null);

    try {
      const response = await reorderTasks(token, {
        weekStartDate: weekStartDateParam,
        dayDate,
        taskIds: optimisticLaneTasks.map((task) => task.id),
      });
      setTasks((currentTasks) =>
        replaceLaneTasks(currentTasks, dayDate, response.tasks),
      );
      setSaveMessage("Task order updated.");
      setStatusMessagePhase(null);
    } catch (error) {
      setTasks((currentTasks) =>
        replaceLaneTasks(currentTasks, dayDate, previousLaneTasks),
      );
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Could not reorder tasks. Reload the lane and try again.",
      );
      setStatusMessagePhase(null);
    } finally {
      setPendingReorderLane(null);
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            `[data-task-reorder-id="${sourceTaskId}"]`,
          )
          ?.focus();
      });
    }
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

      {pendingMove ? (
        <div className="pending-move-flow" role="status" aria-live="polite">
          <span>Moving “{pendingMove.title}”. Choose a destination lane.</span>
          <button
            type="button"
            className="cancel-move-button"
            aria-label="Cancel move"
            onClick={() => setPendingMove(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <WeekLayout
        weekStart={weekStart}
        weekEnd={weekEnd}
        viewMode={viewMode}
        taskActionsDisabled={disableTaskActions}
        onAddTask={(dayDate) => openTaskEditor(dayDate)}
        onWeekLaneDragOver={(event) => {
          if (!draggedTask || draggedTask.laneKey === "shared") {
            return;
          }
          event.preventDefault();
        }}
        onWeekLaneDrop={(event) => {
          event.preventDefault();
          if (!draggedTask || draggedTask.laneKey === "shared") {
            return;
          }
          const sourceDayDate = draggedTask.laneKey;
          if (sourceDayDate === "shared") {
            return;
          }
          const destinationIndex = sortTasks(
            visibleTasks.filter((task) => task.dayDate === null),
          ).length;
          void handleMoveTask(
            draggedTask.taskId,
            sourceDayDate,
            null,
            destinationIndex,
          );
          setDraggedTask(null);
        }}
        onWeekLaneMoveHere={
          pendingMove ? () => movePendingTaskHere(null) : undefined
        }
        onDayLaneDragOver={(event) => {
          if (!draggedTask) {
            return;
          }
          event.preventDefault();
        }}
        onDayLaneDrop={(event, dayDate) => {
          event.preventDefault();
          if (!draggedTask) {
            return;
          }
          const sourceDayDate =
            draggedTask.laneKey === "shared" ? null : draggedTask.laneKey;
          if (sourceDayDate === dayDate) {
            return;
          }
          const destinationIndex = sortTasks(
            visibleTasks.filter((task) => task.dayDate === dayDate),
          ).length;
          void handleMoveTask(
            draggedTask.taskId,
            sourceDayDate,
            dayDate,
            destinationIndex,
          );
          setDraggedTask(null);
        }}
        onDayLaneMoveHere={
          pendingMove ? (dayDate) => movePendingTaskHere(dayDate) : undefined
        }
        weekContent={renderTasks(
          sortTasks(visibleTasks.filter((task) => task.dayDate === null)),
          null,
          (task) => openTaskEditor(null, task),
          handleTaskStatusToggle,
          handleTaskDelete,
          handleTaskReorder,
          handleCrossLaneDrop,
          draggedTask,
          setDraggedTask,
          dropTarget,
          setDropTarget,
          pendingStatusTaskIds,
          pendingDeleteTaskIds,
          taskAccessiblePositions,
          disableTaskActions,
          activeTaskMenuId,
          setActiveTaskMenuId,
          (task) => beginPendingMove(task, null),
        )}
        dayContent={Array.from({ length: 7 }, (_, dayIndex) => {
          const dayDate = formatDateOnly(shiftDateByDays(weekStart, dayIndex));

          return renderTasks(
            sortTasks(visibleTasks.filter((task) => task.dayDate === dayDate)),
            dayDate,
            (task) => openTaskEditor(new Date(`${dayDate}T00:00:00`), task),
            handleTaskStatusToggle,
            handleTaskDelete,
            handleTaskReorder,
            handleCrossLaneDrop,
            draggedTask,
            setDraggedTask,
            dropTarget,
            setDropTarget,
            pendingStatusTaskIds,
            pendingDeleteTaskIds,
            taskAccessiblePositions,
            disableTaskActions,
            activeTaskMenuId,
            setActiveTaskMenuId,
            (task) => beginPendingMove(task, dayDate),
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
  dayDate: string | null,
  onEdit: (task: TaskPayload) => void,
  onStatusToggle: (task: TaskPayload) => void,
  onDelete: (task: TaskPayload) => void,
  onReorder: (
    laneTasks: TaskPayload[],
    dayDate: string | null,
    sourceTaskId: string,
    targetIndex: number,
  ) => void,
  onCrossLaneDrop: (
    taskId: string,
    sourceLaneKey: string,
    destinationDayDate: string | null,
    destinationIndex: number,
  ) => void,
  draggedTask: { taskId: string; laneKey: string } | null,
  setDraggedTask: (value: { taskId: string; laneKey: string } | null) => void,
  dropTarget: { laneKey: string; taskId: string } | null,
  setDropTarget: (value: { laneKey: string; taskId: string } | null) => void,
  pendingStatusTaskIds: ReadonlySet<string>,
  pendingDeleteTaskIds: ReadonlySet<string>,
  taskAccessiblePositions: ReadonlyMap<string, number>,
  disableTaskActions: boolean,
  activeTaskMenuId: string | null,
  setActiveTaskMenuId: (taskId: string | null) => void,
  onRequestMove: (task: TaskPayload) => void,
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
    const laneKey = getLaneKey(dayDate);
    const taskIndex = tasks.findIndex((laneTask) => laneTask.id === task.id);
    const isDropTarget =
      dropTarget?.laneKey === laneKey && dropTarget.taskId === task.id;

    return (
      <div
        key={task.id}
        className={`task-item${isCompleted ? " task-item-completed" : ""}${isDropTarget ? " task-item-drop-target" : ""}`}
        aria-busy={isUpdatingStatus || isDeleting}
        draggable={!disableTaskActions}
        onDragStart={() => setDraggedTask({ taskId: task.id, laneKey })}
        onDragEnd={() => {
          setDraggedTask(null);
          setDropTarget(null);
        }}
        onDragOver={(event) => {
          if (!draggedTask || draggedTask.taskId === task.id) {
            return;
          }
          event.preventDefault();
          setDropTarget({ laneKey, taskId: task.id });
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!draggedTask || draggedTask.taskId === task.id) {
            return;
          }
          if (draggedTask.laneKey !== laneKey) {
            onCrossLaneDrop(
              draggedTask.taskId,
              draggedTask.laneKey,
              dayDate,
              taskIndex,
            );
            return;
          }
          const sourceIndex = tasks.findIndex(
            (laneTask) => laneTask.id === draggedTask.taskId,
          );
          const targetIndex =
            sourceIndex < taskIndex ? taskIndex - 1 : taskIndex;
          setDraggedTask(null);
          void onReorder(tasks, dayDate, draggedTask.taskId, targetIndex);
        }}
      >
        <div className="task-content">
          {isDropTarget ? (
            <span className="task-drop-indicator">Drop here</span>
          ) : null}
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
            <button
              type="button"
              className="task-drag-handle"
              draggable={false}
              disabled={disableTaskActions}
              aria-label={`Drag task ${taskPosition}: ${task.title}`}
              title="Drag to reorder"
            >
              ⋮⋮
            </button>
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
            <button
              type="button"
              className="task-menu-button"
              data-task-menu-trigger="true"
              disabled={disableTaskActions}
              aria-label={`More actions for ${task.title}`}
              aria-haspopup="menu"
              aria-expanded={activeTaskMenuId === task.id}
              onClick={() =>
                setActiveTaskMenuId(
                  activeTaskMenuId === task.id ? null : task.id,
                )
              }
            >
              ⋯
            </button>
            {activeTaskMenuId === task.id ? (
              <div
                className="task-context-menu"
                role="menu"
                aria-label={`Actions for ${task.title}`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onRequestMove(task)}
                >
                  Move
                </button>
              </div>
            ) : null}
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

function getLaneKey(dayDate: string | null): string {
  return dayDate ?? "shared";
}

function sortTasks(tasks: TaskPayload[]): TaskPayload[] {
  return [...tasks].sort(
    (left, right) =>
      (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.orderIndex ?? Number.MAX_SAFE_INTEGER),
  );
}

function replaceLaneTasks(
  allTasks: TaskPayload[],
  dayDate: string | null,
  laneTasks: TaskPayload[],
): TaskPayload[] {
  const laneTaskIds = new Set(
    allTasks.filter((task) => task.dayDate === dayDate).map((task) => task.id),
  );
  const firstLaneIndex = allTasks.findIndex((task) => laneTaskIds.has(task.id));
  const remainingTasks = allTasks.filter((task) => !laneTaskIds.has(task.id));
  const insertionIndex =
    firstLaneIndex < 0 ? remainingTasks.length : firstLaneIndex;
  return [
    ...remainingTasks.slice(0, insertionIndex),
    ...laneTasks,
    ...remainingTasks.slice(insertionIndex),
  ];
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
