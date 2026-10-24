import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

interface TaskResponse {
  id: string;
  dayDate: string;
  title: string;
}

// Holds the destination's first board GET to reproduce clicking Move here before that week is initialized.
test("moves a task to the previous week while its initial board snapshot is still loading", async ({
  page,
  request,
}) => {
  const apiUrl =
    process.env.TASKMANAGER_API_URL ?? "http://localhost:8080/api/v1";
  const title = `previous-week-move-${randomUUID()}`;
  let authorization = "";
  let createdTask: TaskResponse | null = null;
  let movedToWeek: string | null = null;
  let releaseInitialBoard!: () => void;
  const initialBoardRelease = new Promise<void>((resolve) => {
    releaseInitialBoard = resolve;
  });
  let signalInitialBoard!: () => void;
  const initialBoardIntercepted = new Promise<void>((resolve) => {
    signalInitialBoard = resolve;
  });
  let destinationBoardRequestCount = 0;

  try {
    await page.goto("/login");
    await page
      .getByLabel("Username", { exact: true })
      .fill(process.env.TASKMANAGER_TEST_USERNAME ?? "admin");
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.TASKMANAGER_TEST_PASSWORD ?? "Admin123!");
    const initialLoad = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith("/tasks") &&
        response.request().method() === "GET" &&
        url.searchParams.has("weekStartDate")
      );
    });
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/board$/);
    authorization = (await initialLoad).request().headers().authorization;

    const weeks = await page.evaluate(() => {
      const monday = new Date();
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const format = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      monday.setDate(monday.getDate() + 35);
      const destination = format(monday);
      monday.setDate(monday.getDate() + 7);
      return { destination, source: format(monday) };
    });
    const sourceWeek = weeks.source;
    const destinationWeek = weeks.destination;

    const createResponse = await request.post(`${apiUrl}/tasks`, {
      headers: { Authorization: authorization },
      data: {
        weekStartDate: sourceWeek,
        dayDate: sourceWeek,
        title,
        notes: "Move to the previous week using Move here.",
        status: "In Progress",
        executionTime: "09:30",
      },
    });
    expect(createResponse.status()).toBe(201);
    createdTask = ((await createResponse.json()) as { data: TaskResponse })
      .data;

    // Navigate to the source week, which is six weeks ahead of the initial view.
    for (let week = 0; week < 6; week += 1) {
      await page
        .getByRole("button", { name: "Go to next week", exact: true })
        .click();
    }
    const card = page.locator(
      `.task-item[data-task-reorder-id="${createdTask.id}"]`,
    );
    await expect(card).toBeVisible();
    await card
      .getByRole("button", { name: `More actions for ${title}`, exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Move", exact: true }).click();

    await page.route(
      (url) => {
        const parsed = new URL(url);
        return (
          parsed.pathname.endsWith("/board") &&
          parsed.searchParams.get("week_start_date") === destinationWeek
        );
      },
      async (route) => {
        destinationBoardRequestCount += 1;
        if (destinationBoardRequestCount === 1) {
          signalInitialBoard();
          await initialBoardRelease;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                weekStartDate: destinationWeek,
                lanes: [],
                snapshotVersion: "delayed-initial-snapshot",
              },
            }),
          });
          return;
        }
        await route.continue();
      },
    );

    await page
      .getByRole("button", { name: "Go to previous week", exact: true })
      .click();
    await initialBoardIntercepted;
    const destinationButton = page.getByRole("button", {
      name: "Move here to Monday",
      exact: true,
    });
    await expect(destinationButton).toBeVisible();

    // Do not wait for the initial board GET: this is the timing that previously yielded a stale/nonexistent destination snapshot.
    const authoritativeDestinationBoard = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith("/board") &&
        url.searchParams.get("week_start_date") === destinationWeek
      );
    });
    await destinationButton.click();
    const boardResponse = await authoritativeDestinationBoard;
    expect(boardResponse.status()).toBe(200);
    const destinationSnapshot = (
      (await boardResponse.json()) as { data: { snapshotVersion: string } }
    ).data.snapshotVersion;

    const moveResponse = await page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(
        `/tasks/${createdTask!.id}/move`,
      ),
    );
    expect(
      moveResponse.status(),
      "Move here to the previous Monday should succeed using the current destination snapshot",
    ).toBe(200);
    movedToWeek = destinationWeek;
    await expect(page.getByRole("status")).toHaveText("Task moved.");
    expect(moveResponse.request().postDataJSON()).toMatchObject({
      sourceWeekStartDate: sourceWeek,
      destinationWeekStartDate: destinationWeek,
      destinationDayDate: destinationWeek,
      destinationSnapshotVersion: destinationSnapshot,
    });

    const destinationTasksResponse = await request.get(`${apiUrl}/tasks`, {
      params: { weekStartDate: destinationWeek },
      headers: { Authorization: authorization },
    });
    expect(destinationTasksResponse.status()).toBe(200);
    expect(
      ((await destinationTasksResponse.json()) as { data: TaskResponse[] })
        .data,
    ).toContainEqual(
      expect.objectContaining({
        id: createdTask.id,
        dayDate: destinationWeek,
        title,
      }),
    );
  } finally {
    releaseInitialBoard();
    if (createdTask && authorization) {
      const taskWeek = movedToWeek ?? createdTask.dayDate;
      const cleanup = await request.delete(
        `${apiUrl}/tasks/${createdTask.id}`,
        {
          params: { weekStartDate: taskWeek },
          headers: { Authorization: authorization },
        },
      );
      expect(
        cleanup.status(),
        "Clean up only the task created by this regression",
      ).toBe(204);
    }
  }
});
