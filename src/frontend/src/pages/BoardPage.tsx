import { useEffect, useRef, useState } from "react";
import { sha256 } from "js-sha256";
import { useNavigate } from "react-router-dom";
import {
  formatDateOnly,
  BoardMutationError,
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
  getWeekRange,
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

type DropTarget = {
  laneKey: string;
  taskId: string | null;
  valid: boolean;
  message: string;
};
type BoardMutation = {
  id: number;
  kind: "move" | "reorder";
  phase: "pending" | "reconciling";
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
  const [boardMutation, setBoardMutation] = useState<BoardMutation | null>(
    null,
  );
  const boardGeneration = useRef(0);
  const activeMutationId = useRef<number | null>(null);
  const dragWasDropped = useRef(false);
  const [snapshotVersion, setSnapshotVersion] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<{
    taskId: string;
    laneKey: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [activeTaskMenuId, setActiveTaskMenuId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
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

  useEffect(
    () => () => {
      boardGeneration.current += 1;
      activeMutationId.current = null;
    },
    [],
  );

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
    if (!activeTaskMenuId && !pendingMove && !draggedTask) {
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
        cancelPendingMove(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (pendingMove) {
          cancelPendingMove();
        } else if (draggedTask) {
          cancelDrag(draggedTask.taskId);
        } else if (activeTaskMenuId) {
          focusTask(activeTaskMenuId);
        }
        setActiveTaskMenuId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    const sessionToken = token;
    let isCurrentRequest = true;
    const generation = boardGeneration.current;
    const weekStartDate = new Date(`${weekStartDateParam}T00:00:00`);

    async function loadBoardWeek() {
      try {
        const [board, weekTasks] = await Promise.all([
          getBoardForWeek(sessionToken, weekStartDate),
          getTasksForWeek(sessionToken, weekStartDate),
        ]);
        if (!isCurrentRequest || generation !== boardGeneration.current) {
          return;
        }
        setTasks(weekTasks);
        setSnapshotVersion(board.snapshotVersion ?? null);
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
    invalidateBoardRequests();
    // Functional updates ensure rapid clicks apply in order without stale state.
    setSelectedDate((current) => shiftDateByDays(current, -7));
  }

  const visibleTasks = loadedWeekStartDate === weekStartDateParam ? tasks : [];
  const disableTaskActions =
    isEditorOpen ||
    isSaving ||
    boardMutation !== null ||
    pendingMove !== null ||
    pendingStatusTaskIds.size > 0 ||
    pendingDeleteTaskIds.size > 0;
  const taskAccessiblePositions = new Map(
    visibleTasks.map((task, index) => [task.id, index + 1]),
  );

  function handleNextWeek() {
    invalidateBoardRequests();
    // Functional updates ensure rapid clicks apply in order without stale state.
    setSelectedDate((current) => shiftDateByDays(current, 7));
  }

  function handleCurrentWeek() {
    // A no-op navigation must not invalidate an in-flight mutation/load.
    if (
      formatDateOnly(getWeekRange(new Date()).weekStart) === weekStartDateParam
    ) {
      return;
    }
    invalidateBoardRequests();
    // Return to the actual current week.
    setSelectedDate(new Date());
  }

  function invalidateBoardRequests() {
    boardGeneration.current += 1;
    activeMutationId.current = null;
    setBoardMutation(null);
    setSnapshotVersion(null);
    setDraggedTask(null);
    setDropTarget(null);
    setSaveMessage(null);
  }

  function beginMutation(kind: BoardMutation["kind"]) {
    if (activeMutationId.current !== null) {
      return null;
    }
    const id = ++boardGeneration.current;
    activeMutationId.current = id;
    setBoardMutation({ id, kind, phase: "pending" });
    return id;
  }

  function isCurrentMutation(id: number) {
    return activeMutationId.current === id && boardGeneration.current === id;
  }

  function focusTask(
    taskId: string,
    laneKey?: string,
    generation = boardGeneration.current,
  ) {
    window.requestAnimationFrame(() => {
      if (generation !== boardGeneration.current) {
        return;
      }
      const task = Array.from(
        document.querySelectorAll<HTMLElement>("[data-task-reorder-id]"),
      ).find((element) => element.dataset.taskReorderId === taskId);
      const lane = Array.from(
        document.querySelectorAll<HTMLElement>("[data-lane-key]"),
      ).find((element) => element.dataset.laneKey === laneKey);
      (
        task ??
        lane ??
        document.querySelector<HTMLElement>(".week-nav button")
      )?.focus();
    });
  }

  function finishMutation(id: number, taskId: string, laneKey?: string) {
    if (!isCurrentMutation(id)) {
      return;
    }
    activeMutationId.current = null;
    setBoardMutation(null);
    setPendingMove(null);
    focusTask(taskId, laneKey, id);
  }

  function cancelPendingMove(restoreFocus = true) {
    if (!pendingMove) return;
    const move = pendingMove;
    setPendingMove(null);
    setSaveMessage(`Move canceled for “${move.title}”.`);
    setStatusMessagePhase(null);
    if (restoreFocus) focusTask(move.taskId, getLaneKey(move.sourceDayDate));
  }

  function cancelDrag(taskId: string) {
    setDraggedTask(null);
    setDropTarget(null);
    setSaveMessage("Drag canceled. The task has not moved.");
    setStatusMessagePhase(null);
    focusTask(taskId);
  }

  async function reconcileMutation(
    id: number,
    error: unknown,
    fallback: TaskPayload[],
  ) {
    if (!token || !isCurrentMutation(id)) return;
    setBoardMutation((current) =>
      current ? { ...current, phase: "reconciling" } : current,
    );
    let refreshed = false;
    try {
      const [board, authoritativeTasks] = await Promise.all([
        getBoardForWeek(token, weekStart),
        getTasksForWeek(token, weekStart),
      ]);
      if (!isCurrentMutation(id)) return;
      setTasks(authoritativeTasks);
      setLoadedWeekStartDate(weekStartDateParam);
      setSnapshotVersion(board.snapshotVersion ?? null);
      refreshed = true;
    } catch {
      if (!isCurrentMutation(id)) return;
      setTasks(fallback);
      setSnapshotVersion(null);
    }
    if (!isCurrentMutation(id)) return;
    const message =
      error instanceof Error
        ? error.message
        : "Could not update the task order.";
    const conflict =
      error instanceof BoardMutationError && error.status === 409;
    setSaveMessage(
      `${conflict ? "The board changed. " : ""}${message} ${refreshed ? "The latest board has been loaded." : "Reload the board before trying again."}`,
    );
    setStatusMessagePhase(null);
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

    return sha256(snapshotContent).toUpperCase();
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
    const operationId = beginMutation("move");
    if (operationId === null) return;
    const previousTasks = tasks;

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
        if (isCurrentMutation(operationId)) {
          setSaveMessage(
            "The board changed. The task is no longer in its source lane.",
          );
          await reconcileMutation(
            operationId,
            new Error("The task is no longer in its source lane."),
            previousTasks,
          );
        }
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

      if (!isCurrentMutation(operationId)) return;

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

      if (!isCurrentMutation(operationId)) return;

      setLoadedWeekStartDate(weekStartDateParam);
      if (destinationWeekStartDate === weekStartDateParam) {
        setTasks(response.destination.tasks);
        setSnapshotVersion(response.destination.snapshotVersion);
      } else if (sourceWeekStartDate === weekStartDateParam) {
        setTasks(response.source.tasks);
        setSnapshotVersion(response.source.snapshotVersion);
      } else {
        const refreshedTasks = await getTasksForWeek(token, weekStart);
        if (!isCurrentMutation(operationId)) return;
        setTasks(refreshedTasks);
        setSnapshotVersion(null);
      }

      setSaveMessage("Task moved.");
      setStatusMessagePhase(null);
    } catch (error) {
      await reconcileMutation(operationId, error, previousTasks);
    } finally {
      finishMutation(operationId, taskId, getLaneKey(destinationDayDate));
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
    setSaveMessage(null);
    const generation = boardGeneration.current;
    window.requestAnimationFrame(() => {
      if (generation === boardGeneration.current) {
        document.querySelector<HTMLElement>("[data-move-here]")?.focus();
      }
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
    dragWasDropped.current = true;
    setDropTarget(null);
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

    const nextLaneTasks = [...orderedLaneTasks];
    const [movedTask] = nextLaneTasks.splice(sourceIndex, 1);
    nextLaneTasks.splice(targetIndex, 0, movedTask);
    const laneKey = getLaneKey(dayDate);
    const optimisticLaneTasks = nextLaneTasks.map((task, index) => ({
      ...task,
      orderIndex: index,
    }));

    const operationId = beginMutation("reorder");
    if (operationId === null) return;
    const previousTasks = tasks;
    setDropTarget(null);

    try {
      const version =
        snapshotVersion ??
        (await getWeekSnapshotVersion(weekStartDateParam, previousTasks));
      if (!isCurrentMutation(operationId)) return;
      setTasks((currentTasks) =>
        replaceLaneTasks(currentTasks, dayDate, optimisticLaneTasks),
      );
      const response = await reorderTasks(token, {
        weekStartDate: weekStartDateParam,
        dayDate,
        taskIds: optimisticLaneTasks.map((task) => task.id),
        snapshotVersion: version,
      });
      if (!isCurrentMutation(operationId)) return;
      const nextTasks = replaceLaneTasks(
        previousTasks,
        dayDate,
        response.tasks,
      );
      const nextVersion = await getWeekSnapshotVersion(
        weekStartDateParam,
        nextTasks,
      );
      if (!isCurrentMutation(operationId)) return;
      setTasks(nextTasks);
      setLoadedWeekStartDate(weekStartDateParam);
      setSnapshotVersion(nextVersion);
      setSaveMessage("Task order updated.");
      setStatusMessagePhase(null);
    } catch (error) {
      await reconcileMutation(operationId, error, previousTasks);
    } finally {
      finishMutation(operationId, sourceTaskId, laneKey);
    }
  }

  function updateLaneDropTarget(
    event: React.DragEvent<HTMLElement>,
    dayDate: string | null,
  ) {
    if (!draggedTask) return;
    const laneKey = getLaneKey(dayDate);
    const valid = !disableTaskActions && draggedTask.laneKey !== laneKey;
    if (valid) event.preventDefault();
    setDropTarget({
      laneKey,
      taskId: null,
      valid,
      message: valid
        ? "Drop here at the end of this lane."
        : "Cannot drop here. Choose a task to reorder within this lane.",
    });
  }

  function rejectDrop(taskId: string, message: string) {
    dragWasDropped.current = true;
    setDraggedTask(null);
    setDropTarget(null);
    setSaveMessage(message);
    setStatusMessagePhase(null);
    focusTask(taskId);
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
        setSnapshotVersion(null);
        closeTaskEditor();
        setSaveMessage(`${result.createdCount} tasks created.`);
        setStatusMessagePhase(null);
        return;
      } else {
        await createTask(token, input);
      }

      const refreshedTasks = await getTasksForWeek(token, weekStart);
      setTasks(refreshedTasks);
      setSnapshotVersion(null);
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
      const updatedTask = await updateTask(token, task.id, {
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
            ? { ...currentTask, ...updatedTask, status: nextStatus }
            : currentTask,
        ),
      );
      setSnapshotVersion(null);
      setSaveMessage(
        nextStatus === "Completed"
          ? "Task completed."
          : nextStatus === "In Progress"
            ? "Task started."
            : nextStatus === "Not done"
              ? "Task marked not done."
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
    const generation = boardGeneration.current;
    try {
      await deleteTask(token, task.id, weekStartDateParam);
      if (generation !== boardGeneration.current) return;
      setTasks((currentTasks) =>
        currentTasks.filter((currentTask) => currentTask.id !== task.id),
      );
      setSnapshotVersion(null);
      // Deletion compacts sibling indexes on the server; reload before the next reorder.
      const [board, authoritativeTasks] = await Promise.all([
        getBoardForWeek(token, weekStart),
        getTasksForWeek(token, weekStart),
      ]);
      if (generation !== boardGeneration.current) return;
      setTasks(authoritativeTasks);
      setSnapshotVersion(board.snapshotVersion ?? null);
      setSaveMessage("Task deleted.");
      setStatusMessagePhase(null);
    } catch (error) {
      if (generation !== boardGeneration.current) return;
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
    invalidateBoardRequests();

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
            onClick={() => cancelPendingMove()}
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
        laneDropFeedback={dropTarget?.taskId === null ? dropTarget : undefined}
        onLaneDragLeave={(event) => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          ) {
            setDropTarget(null);
          }
        }}
        onAddTask={(dayDate) => openTaskEditor(dayDate)}
        onWeekLaneDragOver={(event) => updateLaneDropTarget(event, null)}
        onWeekLaneDrop={(event) => {
          event.preventDefault();
          if (!draggedTask) return;
          dragWasDropped.current = true;
          setDropTarget(null);
          if (draggedTask.laneKey === "shared" || disableTaskActions) {
            rejectDrop(
              draggedTask.taskId,
              "Cannot drop here. The task remains in its previous position.",
            );
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
        onDayLaneDragOver={updateLaneDropTarget}
        onDayLaneDrop={(event, dayDate) => {
          event.preventDefault();
          if (!draggedTask) {
            return;
          }
          dragWasDropped.current = true;
          setDropTarget(null);
          const sourceDayDate =
            draggedTask.laneKey === "shared" ? null : draggedTask.laneKey;
          if (sourceDayDate === dayDate || disableTaskActions) {
            rejectDrop(
              draggedTask.taskId,
              "Cannot drop here. The task remains in its previous position.",
            );
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
          (value) => {
            if (value) dragWasDropped.current = false;
            setDraggedTask(value);
          },
          dropTarget,
          setDropTarget,
          pendingStatusTaskIds,
          pendingDeleteTaskIds,
          taskAccessiblePositions,
          disableTaskActions,
          activeTaskMenuId,
          setActiveTaskMenuId,
          (task) => beginPendingMove(task, null),
          rejectDrop,
          (taskId) => {
            if (!dragWasDropped.current) cancelDrag(taskId);
          },
          () => {
            dragWasDropped.current = true;
          },
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
            (value) => {
              if (value) dragWasDropped.current = false;
              setDraggedTask(value);
            },
            dropTarget,
            setDropTarget,
            pendingStatusTaskIds,
            pendingDeleteTaskIds,
            taskAccessiblePositions,
            disableTaskActions,
            activeTaskMenuId,
            setActiveTaskMenuId,
            (task) => beginPendingMove(task, dayDate),
            rejectDrop,
            (taskId) => {
              if (!dragWasDropped.current) cancelDrag(taskId);
            },
            () => {
              dragWasDropped.current = true;
            },
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
  dropTarget: DropTarget | null,
  setDropTarget: (value: DropTarget | null) => void,
  pendingStatusTaskIds: ReadonlySet<string>,
  pendingDeleteTaskIds: ReadonlySet<string>,
  taskAccessiblePositions: ReadonlyMap<string, number>,
  disableTaskActions: boolean,
  activeTaskMenuId: string | null,
  setActiveTaskMenuId: (taskId: string | null) => void,
  onRequestMove: (task: TaskPayload) => void,
  onInvalidDrop: (taskId: string, message: string) => void,
  onDragCancel: (taskId: string) => void,
  onDropHandled: () => void,
) {
  if (tasks.length === 0) {
    return undefined;
  }

  return tasks.map((task) => {
    const isCompleted = task.status === "Completed";
    const isNotDone = task.status === "Not done";
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
        data-task-reorder-id={task.id}
        tabIndex={-1}
        data-drop-state={
          isDropTarget ? (dropTarget.valid ? "valid" : "invalid") : undefined
        }
        aria-describedby={isDropTarget ? `drop-task-${task.id}` : undefined}
        className={`task-item${isCompleted ? " task-item-completed" : ""}${isNotDone ? " task-item-not-done" : ""}${isDropTarget ? (dropTarget.valid ? " task-item-drop-target" : " task-item-drop-invalid") : ""}`}
        aria-busy={isUpdatingStatus || isDeleting}
        draggable={!disableTaskActions}
        onDragStart={() => setDraggedTask({ taskId: task.id, laneKey })}
        onDragEnd={() => {
          onDragCancel(task.id);
          setDraggedTask(null);
          setDropTarget(null);
        }}
        onDragOver={(event) => {
          if (!draggedTask) return;
          event.stopPropagation();
          const sourceIndex = tasks.findIndex(
            (candidate) => candidate.id === draggedTask.taskId,
          );
          const targetIndex =
            sourceIndex < taskIndex ? taskIndex - 1 : taskIndex;
          const valid =
            !disableTaskActions &&
            draggedTask.taskId !== task.id &&
            (draggedTask.laneKey !== laneKey ||
              (sourceIndex >= 0 && sourceIndex !== targetIndex));
          if (valid) event.preventDefault();
          setDropTarget({
            laneKey,
            taskId: task.id,
            valid,
            message: valid
              ? `Drop here before “${task.title}”.`
              : "Cannot drop here. The task is already in this position.",
          });
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!draggedTask) return;
          onDropHandled();
          setDropTarget(null);
          if (disableTaskActions || draggedTask.taskId === task.id) {
            onInvalidDrop(
              draggedTask.taskId,
              "Cannot drop here. The task remains in its previous position.",
            );
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
          if (sourceIndex < 0 || sourceIndex === targetIndex) {
            onInvalidDrop(
              draggedTask.taskId,
              "The task is already in this position.",
            );
            return;
          }
          setDraggedTask(null);
          void onReorder(tasks, dayDate, draggedTask.taskId, targetIndex);
        }}
      >
        <div className="task-content">
          {isDropTarget ? (
            <span
              id={`drop-task-${task.id}`}
              role="status"
              aria-live="polite"
              className={`task-drop-indicator${dropTarget.valid ? "" : " task-drop-indicator-invalid"}`}
            >
              {dropTarget.message}
            </span>
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
              className={`task-title${isCompleted ? " task-title-completed" : ""}${isNotDone ? " task-title-not-done" : ""}`}
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
            {isNotDone ? (
              <span className="task-not-done-label">Not done</span>
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
  if (status === "Not done") {
    return "Not Started";
  }

  if (status === "Completed") {
    return "Not done";
  }

  if (status === "Not Started") {
    return "In Progress";
  }

  return "Completed";
}

function getTaskStatusAction(status: TaskPayload["status"]): string {
  if (status === "In Progress") {
    return "Start";
  }

  if (status === "Completed") {
    return "Complete";
  }

  if (status === "Not done") {
    return "Mark as not done";
  }

  return "Reopen";
}
