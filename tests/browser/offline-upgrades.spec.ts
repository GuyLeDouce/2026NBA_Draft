import { test, expect } from "@playwright/test";
import { defaultState } from "../../src/lib/defaults";
test.use({ serviceWorkers: "allow" });
test("Offline queue pick checkpoints mock and planning stay local", async ({
  page,
  context,
}) => {
  const state = defaultState();
  state.setupDone = true;
  state.leagueSettings.draftSlot = 7;
  await page.addInitScript((s) => {
    if (!localStorage.getItem("nba-draft-assistant:v1"))
      localStorage.setItem("nba-draft-assistant:v1", JSON.stringify(s));
  }, state);
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".ownership-banner")).toHaveCount(0);
  await page.locator("#player-search").fill("Jalen Duren");
  await page.locator(".player-name").click();
  await page.getByRole("button", { name: "Add to queue", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator(".player-row .draft-icon").click();
  await page
    .getByRole("button", { name: "Confirm draft pick", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("CHECKPOINT SAVED");
  await expect(page.locator(".queue-taken")).toContainText("Jalen Duren");
  await expect(page.locator(".path-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Recovery", exact: true }).click();
  await expect(page.locator(".recovery-timeline")).toContainText("Jalen Duren");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "MOCK DRAFT", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Mock draft position" })
    .selectOption("7");
  await page.getByRole("button", { name: "Fast forward to my pick" }).click();
  await expect(page.getByLabel("Draft status")).toContainText(
    "YOU’RE ON THE CLOCK",
  );
  await context.setOffline(false);
});
