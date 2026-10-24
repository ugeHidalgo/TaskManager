/// <reference lib="dom" />

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

interface TaskResponse {
  id: string;
  dayDate: string | null;
  title: string;
  notes: string | null;
  status: string;
  executionTime: string;
  weekWorkspaceId: string;
  createdAtUtc: string;
}

interface BatchResponse {
  data: {
    createdCount: number;
    tasks: TaskResponse[];
    affectedWeekStartDates: string[];
  };
}

// Real frontend/API/PostgreSQL; no routes or API adapters are mocked.
// Occupied weeks are supported: only this run's exact UUID-marked titles are adopted.
for (const originalInsideRange of [true, false]) {
  test(`converts a normal task with its original day ${originalInsideRange ? "inside" : "outside"} the recurring range`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const apiUrl =
      process.env.TASKMANAGER_API_URL ?? "http://localhost:8080/api/v1";
    const marker = `convert-recurring-integration-${randomUUID()}`;
    const originalTitle = `${marker}-original`;
    const draft = {
      title: `${marker}-converted`,
      notes: `Edited notes for ${marker}`,
      status: "In Progress",
      executionTime: "10:15",
    };
    const cleanupTasks = new Map<string, string>();
    const affectedWeeks = new Set<string>();
    const cleanupErrors: string[] = [];
    let authorization = "";
    let scenarioFailed = false;

    function owns(task: TaskResponse) {
      return task.title === originalTitle || task.title === draft.title;
    }

    function track(tasks: TaskResponse[], weekStartDate: string) {
      for (const task of tasks) {
        if (owns(task)) {
          // Include regressions that incorrectly place a marked task in shared week.
          cleanupTasks.set(task.id, task.dayDate ?? weekStartDate);
        }
      }
    }

    async function readTasks(weekStartDate: string) {
      const response = await request.get(`${apiUrl}/tasks`, {
        params: { weekStartDate },
        headers: { Authorization: authorization },
      });
      expect(response.status()).toBe(200);
      return ((await response.json()) as { data: TaskResponse[] }).data;
    }

    // Exclude lane indices/timestamps: moving the original can legitimately compact a lane.
    function unchangedFields(tasks: TaskResponse[]) {
      return tasks
        .filter((task) => !owns(task))
        .map((task) => ({
          id: task.id,
          dayDate: task.dayDate,
          title: task.title,
          notes: task.notes,
          status: task.status,
          executionTime: task.executionTime,
          weekWorkspaceId: task.weekWorkspaceId,
          createdAtUtc: task.createdAtUtc,
        }))
        .sort((left, right) => left.id.localeCompare(right.id));
    }

    try {
      await page.goto("/login");
      // Match the browser's local calendar across DST/month/year boundaries.
      const dates = await page.evaluate((inside) => {
        const monday = new Date();
        monday.setHours(0, 0, 0, 0);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const day = (offset: number) => {
          const date = new Date(monday);
          date.setDate(date.getDate() + offset);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        };
        // Source Monday is current+14d. Both four-day ranges cross a weekend/week boundary.
        const start = inside ? 11 : 18;
        return {
          mondays: [0, 7, 14, 21].map(day),
          source: day(14),
          range: [0, 1, 2, 3].map((offset) => day(start + offset)),
          weeks: inside ? [day(7), day(14)] : [day(14), day(21)],
        };
      }, originalInsideRange);
      for (const week of dates.weeks) affectedWeeks.add(week);

      await page
        .getByLabel("Username", { exact: true })
        .fill(process.env.TASKMANAGER_TEST_USERNAME ?? "admin");
      await page
        .getByLabel("Password", { exact: true })
        .fill(process.env.TASKMANAGER_TEST_PASSWORD ?? "Admin123!");
      const taskRead = (week: string) =>
        page.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            url.pathname.endsWith("/tasks") &&
            response.request().method() === "GET" &&
            url.searchParams.get("weekStartDate") === week
          );
        });
      const initialTasksPromise = taskRead(dates.mondays[0]);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/board$/);
      const initialTasks = await initialTasksPromise;
      expect(initialTasks.status()).toBe(200);
      authorization = initialTasks.request().headers().authorization;
      expect(authorization).toMatch(/^Bearer \S+$/);

      const before = new Map<string, TaskResponse[]>();
      for (const week of affectedWeeks) before.set(week, await readTasks(week));

      let viewedWeekIndex = 0;
      async function showWeek(week: string) {
        const target = dates.mondays.indexOf(week);
        expect(target).toBeGreaterThanOrEqual(0);
        while (viewedWeekIndex !== target) {
          const forward = viewedWeekIndex < target;
          const next = viewedWeekIndex + (forward ? 1 : -1);
          const responsePromise = taskRead(dates.mondays[next]);
          await page
            .getByRole("button", {
              name: forward ? "Go to next week" : "Go to previous week",
              exact: true,
            })
            .click();
          expect((await responsePromise).status()).toBe(200);
          await expect(
            page.locator(`.day-column[data-lane-key="${dates.mondays[next]}"]`),
          ).toBeVisible();
          viewedWeekIndex = next;
        }
      }

      await showWeek(dates.source);
      await page.getByLabel("View", { exact: true }).selectOption("fullweek");
      const sourceLane = page.locator(
        `.day-column[data-lane-key="${dates.source}"]`,
      );
      await sourceLane
        .getByRole("button", { name: "Add task to Monday", exact: true })
        .click();
      const createDialog = page.getByRole("dialog", {
        name: "New task",
        exact: true,
      });
      await createDialog
        .getByLabel("Title", { exact: true })
        .fill(originalTitle);
      await createDialog
        .getByLabel("Notes", { exact: true })
        .fill(`Original ${marker}`);
      await createDialog
        .getByLabel("Execution time", { exact: true })
        .fill("08:30");
      await expect(
        createDialog.getByRole("checkbox", {
          name: "Recurring task",
          exact: true,
        }),
      ).not.toBeChecked();
      const creationPromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith("/tasks") &&
          response.request().method() === "POST",
      );
      await createDialog
        .getByRole("button", { name: "Save", exact: true })
        .click();
      const creation = await creationPromise;
      const created = (await creation.json()) as { data?: TaskResponse };
      if (created.data) track([created.data], dates.source);
      expect(creation.status()).toBe(201);
      expect(created.data).toMatchObject({
        title: originalTitle,
        dayDate: dates.source,
        executionTime: "08:30",
        status: "Not Started",
      });
      const originalId = created.data!.id;
      await expect(createDialog).not.toBeVisible();
      const originalCard = sourceLane
        .locator(`.task-item[data-task-reorder-id="${originalId}"]`)
        .filter({ hasText: originalTitle });
      await expect(originalCard).toHaveCount(1);
      await originalCard.getByRole("button", { name: /Edit task:/ }).click();
      const dialog = page.getByRole("dialog", {
        name: "Edit task",
        exact: true,
      });
      await dialog.getByLabel("Title", { exact: true }).fill(draft.title);
      await dialog.getByLabel("Notes", { exact: true }).fill(draft.notes);
      await dialog
        .getByLabel("Execution time", { exact: true })
        .fill(draft.executionTime);
      await dialog
        .getByLabel("Status", { exact: true })
        .selectOption(draft.status);
      await dialog
        .getByRole("checkbox", { name: "Recurring task", exact: true })
        .check();
      await dialog
        .getByLabel("Start date", { exact: true })
        .fill(dates.range[0]);
      await dialog.getByLabel("End date", { exact: true }).fill(dates.range[3]);

      const conversionPath = `/tasks/${originalId}/recurring`;
      const conversionPromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith(conversionPath) &&
          response.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      const conversion = await conversionPromise;
      const submitted = conversion.request();
      const headers = await submitted.allHeaders();
      const payload = submitted.postDataJSON() as Record<string, unknown>;
      expect(headers.authorization).toBe(authorization);
      expect(headers["idempotency-key"]).toMatch(/^\S{1,100}$/);
      expect(payload).toEqual({
        weekStartDate: dates.source,
        startDate: dates.range[0],
        endDate: dates.range[3],
        ...draft,
      });
      const batch = (await conversion.json()) as BatchResponse;
      // Cleanup also discovers from known weeks in finally, independent of this response shape.
      if (Array.isArray(batch.data?.tasks))
        track(batch.data.tasks, dates.source);
      expect(conversion.status()).toBe(201);

      function expectBatch(body: BatchResponse) {
        expect(body.data.createdCount).toBe(4);
        expect(body.data.tasks).toHaveLength(4);
        expect(body.data.affectedWeekStartDates.slice().sort()).toEqual(
          dates.weeks,
        );
        expect(body.data.tasks.map((task) => task.dayDate).sort()).toEqual(
          dates.range,
        );
        expect(new Set(body.data.tasks.map((task) => task.id)).size).toBe(4);
        for (const task of body.data.tasks) expect(task).toMatchObject(draft);
        expect(
          body.data.tasks.find((task) => task.id === originalId)?.dayDate,
        ).toBe(originalInsideRange ? dates.source : dates.range[0]);
      }
      expectBatch(batch);
      const ids = batch.data.tasks.map((task) => task.id).sort();
      await expect(dialog).not.toBeVisible();

      async function expectPersisted() {
        const marked: TaskResponse[] = [];
        for (const week of affectedWeeks) {
          const tasks = await readTasks(week);
          track(tasks, week);
          expect(unchangedFields(tasks)).toEqual(
            unchangedFields(before.get(week)!),
          );
          const owned = tasks.filter(owns);
          expect(owned.some((task) => task.dayDate === null)).toBe(false);
          marked.push(...owned);
        }
        expect(marked.map((task) => task.id).sort()).toEqual(ids);
        expect(marked.map((task) => task.dayDate).sort()).toEqual(dates.range);
        for (const task of marked) expect(task).toMatchObject(draft);
      }

      async function expectVisibleBatch() {
        for (const week of dates.weeks) {
          await showWeek(week);
          const weekTasks = batch.data.tasks.filter(
            (item) =>
              dates.mondays
                .filter((monday) => monday <= item.dayDate!)
                .at(-1) === week,
          );
          await expect(
            page.locator(".day-column .task-item").filter({ hasText: marker }),
          ).toHaveCount(weekTasks.length);
          for (const task of weekTasks) {
            const card = page
              .locator(`.day-column[data-lane-key="${task.dayDate}"]`)
              .locator(`.task-item[data-task-reorder-id="${task.id}"]`);
            await expect(card.locator(".task-title")).toHaveText(draft.title);
            await expect(card.locator("time.task-execution-time")).toHaveText(
              draft.executionTime,
            );
          }
          await expect(
            page
              .locator('[data-lane-key="shared"] .task-item')
              .filter({ hasText: marker }),
          ).toHaveCount(0);
        }
      }

      // In the outside case the original ID is now visibly Friday, never Monday/shared.
      const retainedDate = originalInsideRange ? dates.source : dates.range[0];
      await expect(
        page.locator(
          `.day-column[data-lane-key="${retainedDate}"] [data-task-reorder-id="${originalId}"]`,
        ),
      ).toBeVisible();
      if (!originalInsideRange) {
        await expect(
          sourceLane.locator(`[data-task-reorder-id="${originalId}"]`),
        ).toHaveCount(0);
      }
      await expectPersisted();
      await expectVisibleBatch();

      const reloadPromise = taskRead(dates.mondays[0]);
      await page.reload();
      expect((await reloadPromise).status()).toBe(200);
      viewedWeekIndex = 0;
      await expect(page.getByLabel("View", { exact: true })).toHaveValue(
        "fullweek",
      );
      await expectVisibleBatch();
      await expectPersisted();

      // Replay the browser's exact JSON and key, not a second intentional conversion.
      const retry = await request.post(`${apiUrl}${conversionPath}`, {
        headers: {
          Authorization: headers.authorization,
          "Content-Type": headers["content-type"],
          "Idempotency-Key": headers["idempotency-key"],
        },
        data: payload,
      });
      expect(retry.status()).toBe(200);
      const retried = (await retry.json()) as BatchResponse;
      expectBatch(retried);
      expect(retried.data.tasks.map((task) => task.id).sort()).toEqual(ids);
      await expectPersisted();
    } catch (error) {
      scenarioFailed = true;
      throw error;
    } finally {
      // Discover partial/committed conversions even after malformed/error responses.
      // Refresh dates before deleting: conversion may have moved the original ID.
      if (authorization) {
        for (const week of affectedWeeks) {
          try {
            track(await readTasks(week), week);
          } catch {
            cleanupErrors.push(`Could not discover marked tasks in ${week}`);
          }
        }
        for (const [id, dayDate] of cleanupTasks) {
          try {
            const response = await request.delete(`${apiUrl}/tasks/${id}`, {
              params: { weekStartDate: dayDate },
              headers: { Authorization: authorization },
            });
            if (response.status() !== 204) {
              cleanupErrors.push(`Task ${id}: HTTP ${response.status()}`);
            }
          } catch {
            cleanupErrors.push(`Task ${id}: cleanup request failed`);
          }
        }
        for (const week of affectedWeeks) {
          try {
            if ((await readTasks(week)).some(owns)) {
              cleanupErrors.push(`Marked tasks remain in ${week}`);
            }
          } catch {
            cleanupErrors.push(`Could not verify cleanup in ${week}`);
          }
        }
      }
      if (cleanupErrors.length > 0 && scenarioFailed) {
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
}
