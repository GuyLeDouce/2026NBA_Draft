import { test, expect, type Page } from "@playwright/test";
const key = "nba-draft-assistant:v1";
async function open(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Research first", exact: true })
    .click();
}
async function read(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function slot(page: Page, value = "7") {
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await page
    .getByRole("combobox", { name: "My draft position", exact: true })
    .selectOption(value);
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.getByRole("button", { name: "WAR ROOM", exact: true }).click();
}
async function pickFirst(page: Page) {
  await page.locator(".player-row .draft-icon").first().click();
  await page
    .getByRole("button", { name: "Confirm draft pick", exact: true })
    .click();
}
test("research, all-player search, filters, deep mode, notes and compare", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  expect((await read(page)).leagueSettings.draftSlot).toBeNull();
  await page.getByRole("button", { name: "BIG BOARD", exact: true }).click();
  const search = page.getByRole("textbox", { name: "Search all 600 players" });
  await search.fill("Matthew Murrell");
  await expect(page.locator(".player-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Matthew Murrell", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(/no reliable/i);
  await page
    .getByRole("textbox", { name: "Player note", exact: true })
    .fill("Deep watch test");
  await page.getByRole("button", { name: "WATCH", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Target category" })
    .selectOption("SLEEPER");
  await page.getByRole("spinbutton", { name: "Personal rank" }).fill("550");
  await page.getByRole("textbox", { name: "Player note", exact: true }).focus();
  await page.keyboard.press("Escape");
  await search.fill("");
  await page
    .getByRole("combobox", { name: "Visible player pool" })
    .selectOption("600");
  await page
    .getByRole("button", { name: "DEEP MODE OFF", exact: true })
    .click();
  await expect(page.locator(".player-row")).toHaveCount(600);
  await page.getByRole("button", { name: "C", exact: true }).click();
  expect(await page.locator(".player-row").count()).toBeLessThan(600);
  await page.getByRole("button", { name: "ALL", exact: true }).click();
  await search.fill("Nikola Jokic");
  await page.getByRole("button", { name: "Nikola Jokic", exact: true }).click();
  await page.getByRole("button", { name: "COMPARE", exact: true }).click();
  await search.fill("Luka Doncic");
  await page.getByRole("button", { name: "Luka Doncic", exact: true }).click();
  await page.getByRole("button", { name: "COMPARE", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("SIDE BY SIDE");
  await expect(page.getByRole("table")).toContainText("Nikola Jokic");
  await page.keyboard.press("Escape");
  await page.reload();
  const saved = await read(page);
  expect(saved.personal["matthew-murrell"]).toEqual({
    note: "Deep watch test",
    watch: true,
    target: "SLEEPER",
    rank: 550,
  });
  expect(errors).toEqual([]);
});
test("live draft across three rounds, correction, multiple undo and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await slot(page);
  for (let i = 0; i < 27; i++) await pickFirst(page);
  let state = await read(page);
  expect(state.realDraft.picks).toHaveLength(27);
  expect(
    state.realDraft.picks.filter(
      (p: { teamId: string }) => p.teamId === state.leagueSettings.myTeamId,
    ),
  ).toHaveLength(3);
  await page.reload();
  await expect(page.getByLabel("Draft status")).toContainText("28");
  await page.getByRole("button", { name: "DRAFT BOARD", exact: true }).click();
  await page.locator(".pick-tile").filter({ hasText: "Nikola Jokic" }).click();
  await page
    .getByRole("textbox", { name: "Search replacement" })
    .fill("Derrick White");
  await page
    .locator(".correction-results button")
    .filter({ hasText: "Derrick White" })
    .click();
  await page.getByRole("button", { name: "Confirm correction" }).click();
  state = await read(page);
  expect(state.realDraft.picks[0].playerId).toBe("derrick-white");
  expect(state.realDraft.picks).toHaveLength(27);
  await page
    .getByRole("button", { name: "UNDO LAST PICK", exact: true })
    .click();
  await page
    .getByRole("button", { name: "UNDO LAST PICK", exact: true })
    .click();
  expect((await read(page)).realDraft.picks).toHaveLength(25);
  await page.getByRole("button", { name: "WAR ROOM", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search all 600 players" })
    .fill("Nikola Jokic");
  await expect(page.locator(".player-row")).toHaveCount(1);
  await page.getByRole("button", { name: "MY TEAM", exact: true }).click();
  await expect(page.locator(".team-layout")).toContainText("Position coverage");
  expect(errors).toEqual([]);
});
test("mock standard and big-heavy runs remain separate from real picks", async ({
  page,
}) => {
  await open(page);
  await slot(page);
  await pickFirst(page);
  const real = (await read(page)).realDraft;
  await page.getByRole("button", { name: "MOCK DRAFT", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Mock draft position" })
    .selectOption("7");
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Fast forward to my pick" }).click();
    await expect(page.getByLabel("Draft status")).toContainText(
      "YOU’RE ON THE CLOCK",
    );
    await page
      .getByRole("button", { name: "MAKE MY PICK", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm draft pick" }).click();
  }
  let state = await read(page);
  expect(state.mockDraft.picks.length).toBeGreaterThan(30);
  expect(state.realDraft).toEqual(real);
  await page.getByRole("button", { name: "Restart mock" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Mock draft style" })
    .selectOption("BIG HEAVY");
  await page.getByRole("button", { name: "Fast forward to my pick" }).click();
  state = await read(page);
  expect(state.mockDraft.picks).toHaveLength(6);
  expect(state.realDraft).toEqual(real);
});
test("export, validated restore, and confirmed resets", async ({ page }) => {
  await open(page);
  await slot(page);
  await pickFirst(page);
  const saved = await read(page);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("nba-draft-backup");
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset real draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await read(page)).realDraft.picks).toHaveLength(1);
  await page
    .getByRole("button", { name: "Reset real draft", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Type RESET", exact: true })
    .fill("RESET");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  expect((await read(page)).realDraft.picks).toHaveLength(0);
  await page.locator("input[type=file][accept*=json]").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  expect((await read(page)).realDraft.picks).toHaveLength(1);
  await page.locator("input[type=file][accept*=json]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole("status")).toContainText("Import rejected");
  expect((await read(page)).realDraft.picks).toHaveLength(1);
});
for (const size of [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test("responsive and keyboard " + size.width, async ({ page }) => {
    await page.setViewportSize(size);
    await open(page);
    await expect(page.locator(".recommendation-hero")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    if (size.width < 760) {
      await page.getByRole("button", { name: "BOARD", exact: true }).click();
    }
    await page.keyboard.press("/");
    await expect(
      page.getByRole("textbox", { name: "Search all 600 players" }),
    ).toBeFocused();
    await page
      .getByRole("textbox", { name: "Search all 600 players" })
      .fill("Jalen Duren");
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("button", { name: "Jalen Duren", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "DRAFT BOARD", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });

test.describe("installed app", () => {
  test.use({ serviceWorkers: "allow" });
  test("production PWA reloads offline with the player database", async ({
    page,
    context,
  }) => {
    await open(page);
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
    await expect(page.locator(".recommendation-hero")).toContainText(
      "Nikola Jokic",
    );
    await page
      .getByRole("textbox", { name: "Search all 600 players" })
      .fill("Matthew Murrell");
    await expect(page.locator(".player-row")).toContainText("Matthew Murrell");
    await context.setOffline(false);
  });
});
