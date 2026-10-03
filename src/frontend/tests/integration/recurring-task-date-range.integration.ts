import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

interface TaskResponse {
  id: string;
  dayDate: string;
  title: string;
  notes: string;
  status: string;
  executionTime: string;
}

interface BatchResponse {
  data: {
    createdCount: number;
    tasks: TaskResponse[];
    affectedWeekStartDates: string[];
  };
}

// Requires the local frontend, API and PostgreSQL stack, with development login enabled.
// The custom suffix keeps Playwright integration tests out of Vitest's unit-test discovery.
test("creates one independent task per inclusive date for a new submission after page reload", async ({
  page,
  request,
}) => {
  const apiUrl =
    process.env.TASKMANAGER_API_URL ?? "http://localhost:8080/api/v1";
  const marker = `recurring-integration-${randomUUID()}`;
  const cleanupTasks = new Map<string, string>();
  const cleanupErrors: string[] = [];
  let authorization = "";
  let scenarioFailed = false;

  async function createBatch(title: string, dates: string[]) {
    await page
      .getByRole("button", { name: "Add task to shared week", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "New task", exact: true });
    await dialog.getByLabel("Title", { exact: true }).fill(title);
    await dialog
      .getByRole("checkbox", { name: "Recurring task", exact: true })
      .check();
    await dialog.getByLabel("Start date", { exact: true }).fill(dates[0]);
    await dialog.getByLabel("End date", { exact: true }).fill(dates.at(-1)!);
    await dialog
      .getByLabel("Notes", { exact: true })
      .fill("Preserve every submitted value");
    await dialog.getByLabel("Execution time", { exact: true }).fill("09:30");
    await dialog
      .getByLabel("Status", { exact: true })
      .selectOption("In Progress");

    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/tasks/recurring") &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    const response = await responsePromise;
    authorization = response.request().headers().authorization;
    const body = (await response.json()) as BatchResponse;

    // Never clean up a pre-existing batch returned incorrectly by the current bug.
    for (const task of body.data?.tasks ?? []) {
      if (task.title.startsWith(marker)) {
        cleanupTasks.set(task.id, task.dayDate);
      }
    }

    expect(response.ok(), "Recurring creation must succeed").toBe(true);
    expect(
      body.data.tasks.map((task) => task.dayDate).sort(),
      "The returned tasks must belong to the submitted inclusive date range, not an earlier batch",
    ).toEqual(dates);
    expect(
      response.status(),
      "A new submission must create a new batch, not reuse a previous one",
    ).toBe(201);
    expect(body.data.createdCount).toBe(dates.length);
    expect(body.data.tasks).toHaveLength(dates.length);
    expect(new Set(body.data.tasks.map((task) => task.id)).size).toBe(
      dates.length,
    );
    for (const task of body.data.tasks) {
      expect(task).toMatchObject({
        title,
        notes: "Preserve every submitted value",
        status: "In Progress",
        executionTime: "09:30",
      });
    }
    await expect(dialog).not.toBeVisible();
    return body.data;
  }

  try {
    await page.goto("/login");
    await page
      .getByLabel("Username", { exact: true })
      .fill(process.env.TASKMANAGER_TEST_USERNAME ?? "admin");
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.TASKMANAGER_TEST_PASSWORD ?? "Admin123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/board$/);

    // Friday through Monday: includes weekends, both endpoints, and two containing weeks.
    const firstDates = ["2037-01-02", "2037-01-03", "2037-01-04", "2037-01-05"];
    const first = await createBatch(`${marker}-first`, firstDates);
    expect(first.affectedWeekStartDates.sort()).toEqual([
      "2036-12-29",
      "2037-01-05",
    ]);

    // A reload is a new intentional creation, not a retry of the first submission.
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Add task to shared week",
        exact: true,
      }),
    ).toBeVisible();
    const secondDates = [
      "2037-01-06",
      "2037-01-07",
      "2037-01-08",
      "2037-01-09",
    ];
    const second = await createBatch(`${marker}-second`, secondDates);
    expect(second.affectedWeekStartDates).toEqual(["2037-01-05"]);
    expect(
      new Set([...first.tasks, ...second.tasks].map((task) => task.id)).size,
    ).toBe(8);

    const persistedTasks: TaskResponse[] = [];
    for (const weekStartDate of ["2036-12-29", "2037-01-05"]) {
      const response = await request.get(`${apiUrl}/tasks`, {
        params: { weekStartDate },
        headers: { Authorization: authorization },
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { data: TaskResponse[] };
      persistedTasks.push(
        ...body.data.filter((task) => task.title.startsWith(marker)),
      );
    }
    expect(persistedTasks.map((task) => task.dayDate).sort()).toEqual([
      ...firstDates,
      ...secondDates,
    ]);
    expect(persistedTasks.map((task) => task.id).sort()).toEqual(
      [...first.tasks, ...second.tasks].map((task) => task.id).sort(),
    );
  } catch (error) {
    scenarioFailed = true;
    throw error;
  } finally {
    for (const [taskId, dayDate] of cleanupTasks) {
      try {
        const response = await request.delete(`${apiUrl}/tasks/${taskId}`, {
          params: { weekStartDate: dayDate },
          headers: { Authorization: authorization },
        });
        if (response.status() !== 204) {
          cleanupErrors.push(`Task ${taskId}: HTTP ${response.status()}`);
        }
      } catch {
        cleanupErrors.push(`Task ${taskId}: cleanup request failed`);
      }
    }
    if (cleanupErrors.length > 0) {
      const message = cleanupErrors.join("; ");
      if (scenarioFailed) {
        test
          .info()
          .annotations.push({ type: "cleanup-warning", description: message });
        console.warn(`Integration cleanup incomplete: ${message}`);
      }
    }
  }
  if (cleanupErrors.length > 0) {
    throw new Error(
      `Integration cleanup incomplete: ${cleanupErrors.join("; ")}`,
    );
  }
});
