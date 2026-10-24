import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

interface TaskResponse {
  id: string;
  dayDate: string;
  title: string;
}

// Reproduces the seven-column layout with a narrow daily task card in Chromium.
test("keeps task status and controls inside a card in full-week view", async ({
  page,
  request,
}) => {
  const apiUrl =
    process.env.TASKMANAGER_API_URL ?? "http://localhost:8080/api/v1";
  const title = `full-week-overflow-${randomUUID()}`;
  let authorization = "";
  let createdTask: TaskResponse | null = null;

  try {
    await page.goto("/login");
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
        url.searchParams.has("weekStartDate")
      );
    });
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/board$/);
    authorization = (await initialTasksPromise)
      .request()
      .headers().authorization;

    const sunday = await page.evaluate(() => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      const mondayOffset = (date.getDay() + 6) % 7;
      const monday = new Date(date);
      monday.setDate(date.getDate() - mondayOffset);
      date.setDate(date.getDate() + ((7 - date.getDay()) % 7));
      const format = (value: Date) =>
        `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
      return { weekStart: format(monday), date: format(date) };
    });
    const createResponse = await request.post(`${apiUrl}/tasks`, {
      headers: { Authorization: authorization },
      data: {
        weekStartDate: sunday.weekStart,
        dayDate: sunday.date,
        title,
        notes:
          "A narrow full-week task card must contain its status and controls.",
        status: "In Progress",
        executionTime: "09:30",
      },
    });
    expect(createResponse.status()).toBe(201);
    createdTask = ((await createResponse.json()) as { data: TaskResponse })
      .data;
    expect(createdTask.title).toBe(title);

    await page.reload();
    await page.getByRole("combobox", { name: "View" }).selectOption("fullweek");
    const card = page.locator(
      `.task-item[data-task-reorder-id="${createdTask.id}"]`,
    );
    await expect(card).toBeVisible();
    const status = card.locator(".task-progress-label");
    await expect(status).toHaveText("In progress");

    const cardBounds = await card.boundingBox();
    const statusBounds = await status.boundingBox();
    expect(cardBounds).not.toBeNull();
    expect(statusBounds).not.toBeNull();
    expect(
      statusBounds!.x,
      "Status should stay within the card's left edge",
    ).toBeGreaterThanOrEqual(cardBounds!.x);
    expect(
      statusBounds!.x + statusBounds!.width,
      "Status currently spills out of narrow full-week cards",
    ).toBeLessThanOrEqual(cardBounds!.x + cardBounds!.width + 1);
  } finally {
    if (createdTask && authorization) {
      const cleanup = await request.delete(
        `${apiUrl}/tasks/${createdTask.id}`,
        {
          params: { weekStartDate: createdTask.dayDate! },
          headers: { Authorization: authorization },
        },
      );
      expect(
        cleanup.status(),
        "Delete only the task created by this test",
      ).toBe(204);
    }
  }
});
