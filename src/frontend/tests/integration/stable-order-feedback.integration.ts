/// <reference lib="dom" />

import { randomUUID } from "node:crypto";
import { expect, test, type Locator } from "@playwright/test";

interface TaskResponse {
  id: string;
  dayDate: string | null;
  title: string;
  notes: string | null;
  status: string;
  executionTime: string;
  orderIndex: number;
  updatedAtUtc: string;
}

interface BoardResponse {
  weekStartDate: string;
  snapshotVersion: string;
}

// Real local frontend/API/PostgreSQL, using the recurring regression's login and cleanup pattern.
// Only the empty week two weeks ahead is used; no existing tasks are reordered or deleted.
test("preserves stable order, accessible move feedback and completed presentation against the real stack", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const apiUrl =
    process.env.TASKMANAGER_API_URL ?? "http://localhost:8080/api/v1";
  const marker = `stable-order-integration-${randomUUID()}`;
  const cleanupTasks = new Map<string, string>();
  const cleanupErrors: string[] = [];
  const browserMutations: string[] = [];
  let authorization = "";
  let scenarioFailed = false;

  page.on("request", (outgoing) => {
    const path = new URL(outgoing.url()).pathname;
    if (
      /\/tasks(?:\/|$)/.test(path) &&
      ["POST", "PUT", "DELETE"].includes(outgoing.method())
    ) {
      browserMutations.push(`${outgoing.method()} ${path}`);
    }
  });

  async function readTasks(weekStartDate: string) {
    const response = await request.get(`${apiUrl}/tasks`, {
      params: { weekStartDate },
      headers: { Authorization: authorization },
    });
    expect(response.status()).toBe(200);
    return ((await response.json()) as { data: TaskResponse[] }).data;
  }

  async function readBoard(weekStartDate: string) {
    const response = await request.get(`${apiUrl}/board`, {
      params: { week_start_date: weekStartDate },
      headers: { Authorization: authorization },
    });
    expect(response.status()).toBe(200);
    const { data } = (await response.json()) as { data: BoardResponse };
    expect(data.weekStartDate).toBe(weekStartDate);
    expect(data.snapshotVersion).toEqual(expect.any(String));
    expect(data.snapshotVersion.length).toBeGreaterThan(0);
    return data;
  }

  function orderedLane(tasks: TaskResponse[], dayDate: string) {
    return tasks
      .filter((task) => task.dayDate === dayDate)
      .sort((left, right) => left.orderIndex - right.orderIndex);
  }

  function expectLane(tasks: TaskResponse[], dayDate: string, ids: string[]) {
    const lane = orderedLane(tasks, dayDate);
    expect(lane.map((task) => task.id)).toEqual(ids);
    expect(lane.map((task) => task.orderIndex)).toEqual(
      ids.map((_, index) => index),
    );
    expect(lane.every((task) => task.title.startsWith(marker))).toBe(true);
    return lane;
  }

  function card(taskId: string) {
    return page.locator(`.task-item[data-task-reorder-id="${taskId}"]`);
  }

  function markedCards(lane: Locator) {
    return lane
      .locator(".task-item[data-task-reorder-id]")
      .filter({ hasText: marker });
  }

  async function expectVisibleOrder(lane: Locator, titles: string[]) {
    await expect(markedCards(lane).locator(".task-title")).toHaveText(titles);
  }

  async function expectCompleted(taskId: string) {
    const completed = card(taskId);
    await expect(completed).toHaveClass(/\btask-item-completed\b/);
    await expect(completed).toHaveCSS("background-color", "rgb(243, 244, 246)");
    await expect(completed.locator(".task-title")).toHaveClass(
      /\btask-title-completed\b/,
    );
    await expect(completed.locator(".task-title")).toHaveCSS(
      "color",
      "rgb(107, 114, 128)",
    );
    await expect(completed.getByRole("checkbox")).toBeChecked();
    await expect(completed.locator("time.task-execution-time")).toHaveText(
      "09:30",
    );
    await expect(completed.locator("time.task-execution-time")).toHaveAttribute(
      "datetime",
      "09:30",
    );
    await expect(completed.locator(".task-description")).toHaveCount(0);
  }

  async function expectStaticMessage(text: string) {
    const message = page.locator(".save-message");
    await expect(message).toHaveText(text);
    await expect(message).toHaveAttribute("role", "status");
    await expect(message).toHaveAttribute("aria-live", "polite");
    await expect(message).not.toHaveClass(/save-message-status-change/);
    await expect(message).toHaveCSS("animation-name", "none");
  }

  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");

    // Browser-local date arithmetic matches the board, including timezone and DST boundaries.
    // Avoid UTC toISOString() and years of navigation to a fixed future Monday.
    const dates = await page.evaluate(() => {
      const monday = new Date();
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const format = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const currentMonday = format(monday);
      monday.setDate(monday.getDate() + 7);
      const nextMonday = format(monday);
      monday.setDate(monday.getDate() + 7);
      const futureMonday = format(monday);
      monday.setDate(monday.getDate() + 1);
      return {
        currentMonday,
        nextMonday,
        futureMonday,
        tuesday: format(monday),
      };
    });
    const weekStartDate = dates.futureMonday;

    await page
      .getByLabel("Username", { exact: true })
      .fill(process.env.TASKMANAGER_TEST_USERNAME ?? "admin");
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.TASKMANAGER_TEST_PASSWORD ?? "Admin123!");
    const initialTasksPromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith("/tasks") &&
        response.request().method() === "GET" &&
        url.searchParams.get("weekStartDate") === dates.currentMonday
      );
    });
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/board$/);
    const initialTasks = await initialTasksPromise;
    expect(initialTasks.status()).toBe(200);
    authorization = initialTasks.request().headers().authorization;
    expect(authorization).toMatch(/^Bearer \S+$/);

    const existingTasks = await readTasks(weekStartDate);
    test.skip(
      existingTasks.length > 0,
      "The week two weeks ahead is occupied; skip rather than mutate unrelated task order.",
    );

    const created: TaskResponse[] = [];
    await test.step("seed three independent Monday tasks, one completed at 09:30", async () => {
      for (const [suffix, status, executionTime] of [
        ["first", "Not Started", "08:00"],
        ["second", "In Progress", "12:00"],
        ["completed", "Completed", "09:30"],
      ]) {
        const title = `${marker}-${suffix}`;
        const response = await request.post(`${apiUrl}/tasks`, {
          headers: { Authorization: authorization },
          data: {
            weekStartDate,
            dayDate: weekStartDate,
            title,
            notes: `Notes preserved for ${title}`,
            status,
            executionTime,
          },
        });
        const body = (await response.json()) as { data?: TaskResponse };
        // Register before asserting, but never adopt an unrelated task returned by a bug.
        if (body.data?.title === title && body.data.title.startsWith(marker)) {
          cleanupTasks.set(body.data.id, weekStartDate);
        }
        expect(response.status()).toBe(201);
        expect(body.data).toMatchObject({
          title,
          dayDate: weekStartDate,
          notes: `Notes preserved for ${title}`,
          status,
          executionTime,
        });
        created.push(body.data!);
      }
      expect(new Set(created.map((task) => task.id)).size).toBe(3);
    });

    const [first, second, completed] = created;
    const apiOrder = [second.id, first.id, completed.id];
    await test.step("reject a stale snapshot with the same lane IDs and leave persisted state unchanged", async () => {
      const before = await readTasks(weekStartDate);
      expect(before).toHaveLength(3);
      expectLane(
        before,
        weekStartDate,
        created.map((task) => task.id),
      );
      const staleBoard = await readBoard(weekStartDate);
      const response = await request.put(`${apiUrl}/tasks/reorder`, {
        headers: { Authorization: authorization },
        data: {
          weekStartDate,
          dayDate: weekStartDate,
          taskIds: apiOrder,
          snapshotVersion: staleBoard.snapshotVersion,
        },
      });
      expect(response.status()).toBe(200);
      const reordered = (await response.json()) as {
        data: { tasks: TaskResponse[] };
      };
      expectLane(reordered.data.tasks, weekStartDate, apiOrder);
      const authoritative = await readTasks(weekStartDate);
      expectLane(authoritative, weekStartDate, apiOrder);
      const currentBoard = await readBoard(weekStartDate);
      expect(currentBoard.snapshotVersion).not.toBe(staleBoard.snapshotVersion);

      // Membership is identical: this must fail due to stale version, not missing/extra IDs.
      const conflict = await request.put(`${apiUrl}/tasks/reorder`, {
        headers: { Authorization: authorization },
        data: {
          weekStartDate,
          dayDate: weekStartDate,
          taskIds: created.map((task) => task.id),
          snapshotVersion: staleBoard.snapshotVersion,
        },
      });
      expect(conflict.status()).toBe(409);
      expect(await conflict.json()).toMatchObject({
        error: { code: "task.order.conflict" },
      });
      // Includes titles, notes, statuses, times, indices and update timestamps, not just order.
      expect(await readTasks(weekStartDate)).toEqual(authoritative);
      expect((await readBoard(weekStartDate)).snapshotVersion).toBe(
        currentBoard.snapshotVersion,
      );
    });

    // Navigate only twice after seeding so the UI loads the authoritative snapshot naturally.
    for (const monday of [dates.nextMonday, weekStartDate]) {
      const tasksPromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname.endsWith("/tasks") &&
          response.request().method() === "GET" &&
          url.searchParams.get("weekStartDate") === monday
        );
      });
      const boardPromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname.endsWith("/board") &&
          response.request().method() === "GET" &&
          url.searchParams.get("week_start_date") === monday
        );
      });
      await page
        .getByRole("button", { name: "Go to next week", exact: true })
        .click();
      expect((await tasksPromise).status()).toBe(200);
      expect((await boardPromise).status()).toBe(200);
      await expect(
        page.locator(`.day-column[data-lane-key="${monday}"]`),
      ).toBeVisible();
    }
    const mondayLane = page.locator(
      `.day-column[data-lane-key="${weekStartDate}"]`,
    );
    const tuesdayLane = page.locator(
      `.day-column[data-lane-key="${dates.tuesday}"]`,
    );
    const visibleOrder = [completed.id, second.id, first.id];
    await expectVisibleOrder(mondayLane, [
      second.title,
      first.title,
      completed.title,
    ]);
    await expect(tuesdayLane.locator(".task-item")).toHaveCount(0);
    await expectCompleted(completed.id);
    await expect
      .poll(() =>
        mondayLane.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            property: style.transitionProperty,
            duration: style.transitionDuration,
          };
        }),
      )
      .toEqual({ property: "none", duration: "0s" });

    await test.step("use a real card drag to prepend the last task, keeping persisted indices stable", async () => {
      const safeTasks = await readTasks(weekStartDate);
      expect(safeTasks).toHaveLength(3);
      expectLane(safeTasks, weekStartDate, apiOrder);
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith("/tasks/reorder") &&
          response.request().method() === "PUT",
      );
      // Card padding avoids starting the drag on nested checkbox/menu controls.
      await card(completed.id).dragTo(card(second.id), {
        sourcePosition: { x: 5, y: 5 },
        targetPosition: { x: 5, y: 5 },
      });
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toMatchObject({
        weekStartDate,
        dayDate: weekStartDate,
        taskIds: visibleOrder,
        snapshotVersion: expect.any(String),
      });
      await expectVisibleOrder(mondayLane, [
        completed.title,
        second.title,
        first.title,
      ]);
      await expect(card(completed.id)).toBeFocused();
      await expectStaticMessage("Task order updated.");
      await expectCompleted(completed.id);
      const persisted = await readTasks(weekStartDate);
      expectLane(persisted, weekStartDate, visibleOrder);
      expect(await readTasks(weekStartDate)).toEqual(persisted);
      expect(browserMutations).toHaveLength(1);
    });

    await test.step("show the empty Tuesday drop marker, then cancel and restore source focus without mutation", async () => {
      const before = await readTasks(weekStartDate);
      const boardBefore = await readBoard(weekStartDate);
      const mutationsBefore = browserMutations.length;
      const source = card(completed.id);
      // Synthetic events inspect/cancel feedback only; the actual reorder above uses dragTo.
      await source.dispatchEvent("dragstart");
      await tuesdayLane
        .getByText("No tasks for Tuesday", { exact: true })
        .dispatchEvent("dragover");
      await expect(tuesdayLane).toHaveAttribute("data-drop-state", "valid");
      await expect(tuesdayLane).toHaveClass(/\bdrop-zone-valid\b/);
      const feedback = tuesdayLane.getByRole("status");
      await expect(feedback).toBeVisible();
      await expect(feedback).toHaveText("Drop here at the end of this lane.");
      await expect(feedback).toHaveAttribute("aria-live", "polite");
      await expect(tuesdayLane).toHaveAttribute(
        "aria-describedby",
        (await feedback.getAttribute("id"))!,
      );
      await expect(tuesdayLane).toHaveCSS("border-top-style", "dashed");
      await expect(feedback).toHaveCSS("animation-name", "none");
      await expect(tuesdayLane).toHaveCSS("transition-property", "none");
      await tuesdayLane.focus();
      await expect(tuesdayLane).toBeFocused();
      await source.dispatchEvent("dragend");
      await expect(source).toBeFocused();
      await expectStaticMessage("Drag canceled. The task has not moved.");
      await expect(tuesdayLane).not.toHaveAttribute("data-drop-state");
      await expect(tuesdayLane).not.toHaveAttribute("aria-describedby");
      await expect(feedback).toHaveCount(0);
      await expectVisibleOrder(mondayLane, [
        completed.title,
        second.title,
        first.title,
      ]);
      expect(await readTasks(weekStartDate)).toEqual(before);
      expect((await readBoard(weekStartDate)).snapshotVersion).toBe(
        boardBefore.snapshotVersion,
      );
      expect(browserMutations).toHaveLength(mutationsBefore);
    });

    await test.step("move the completed task to Tuesday using Enter and preserve focus, styling and task values", async () => {
      const before = await readTasks(weekStartDate);
      expect(before).toHaveLength(3);
      expectLane(before, weekStartDate, visibleOrder);
      expectLane(before, dates.tuesday, []);
      const trigger = card(completed.id).getByRole("button", {
        name: `More actions for ${completed.title}`,
        exact: true,
      });
      await trigger.focus();
      await trigger.press("Enter");
      const move = page.getByRole("menuitem", { name: "Move", exact: true });
      await move.focus();
      await move.press("Enter");
      await expect(
        page.getByRole("button", {
          name: "Move here to shared week",
          exact: true,
        }),
      ).toBeFocused();
      const destination = page.getByRole("button", {
        name: "Move here to Tuesday",
        exact: true,
      });
      await destination.focus();
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith(
            `/tasks/${completed.id}/move`,
          ) && response.request().method() === "POST",
      );
      await destination.press("Enter");
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toMatchObject({
        sourceWeekStartDate: weekStartDate,
        sourceDayDate: weekStartDate,
        sourceIndex: 0,
        destinationWeekStartDate: weekStartDate,
        destinationDayDate: dates.tuesday,
        destinationIndex: 0,
        sourceSnapshotVersion: expect.any(String),
        destinationSnapshotVersion: expect.any(String),
      });
      await expectVisibleOrder(mondayLane, [second.title, first.title]);
      await expectVisibleOrder(tuesdayLane, [completed.title]);
      await expect(
        tuesdayLane.locator(`[data-task-reorder-id="${completed.id}"]`),
      ).toBeFocused();
      await expectStaticMessage("Task moved.");
      await expectCompleted(completed.id);
      await expect(
        page.getByRole("button", { name: "Move here to Tuesday", exact: true }),
      ).toHaveCount(0);
      await expect(tuesdayLane).toHaveCSS("transition-property", "none");
      const persisted = await readTasks(weekStartDate);
      expect(persisted).toHaveLength(3);
      expectLane(persisted, weekStartDate, [second.id, first.id]);
      const [moved] = expectLane(persisted, dates.tuesday, [completed.id]);
      expect(moved).toMatchObject({
        id: completed.id,
        title: completed.title,
        notes: completed.notes,
        status: "Completed",
        executionTime: "09:30",
      });
      expect(await readTasks(weekStartDate)).toEqual(persisted);
      expect(browserMutations).toHaveLength(2);
    });
  } catch (error) {
    scenarioFailed = true;
    throw error;
  } finally {
    // Every daily task stays in the same week, including after the move to Tuesday.
    // Delete only IDs returned with this run's exact unique marker; never delete a whole lane/week.
    for (const [taskId, weekStartDate] of cleanupTasks) {
      try {
        const response = await request.delete(`${apiUrl}/tasks/${taskId}`, {
          params: { weekStartDate },
          headers: { Authorization: authorization },
        });
        if (response.status() !== 204) {
          cleanupErrors.push(`Task ${taskId}: HTTP ${response.status()}`);
        }
      } catch {
        cleanupErrors.push(`Task ${taskId}: cleanup request failed`);
      }
    }
    if (scenarioFailed && cleanupErrors.length > 0) {
      const message = cleanupErrors.join("; ");
      test
        .info()
        .annotations.push({ type: "cleanup-warning", description: message });
      console.warn(`Integration cleanup incomplete: ${message}`);
    }
  }
  if (cleanupErrors.length > 0) {
    throw new Error(
      `Integration cleanup incomplete: ${cleanupErrors.join("; ")}`,
    );
  }
});
