import { test, expect, type Page } from "@playwright/test";
import { defaultState } from "../../src/lib/defaults";
const key = "nba-draft-assistant:v1";
async function read(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function ready(page: Page) {
  await expect(page.locator(".ownership-banner")).toHaveCount(0);
}
async function open(page: Page, slot: number | null = 7) {
  const s = defaultState();
  s.setupDone = true;
  s.leagueSettings.draftSlot = slot;
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(state));
    },
    { key, state: s },
  );
  await page.goto("/");
  await ready(page);
}
async function first(page: Page) {
  await page.locator(".player-row .draft-icon").first().click();
  await page
    .getByRole("button", { name: "Confirm draft pick", exact: true })
    .click();
}
async function queue(page: Page, name: string) {
  await page.locator("#player-search").fill(name);
  await page.locator(".player-name").filter({ hasText: name }).click();
  await page.getByRole("button", { name: "Add to queue", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator("#player-search").fill("");
}
test("Queue persistence, ordering, taken markers, undo and two-pick paths", async ({
  page,
}) => {
  await open(page);
  await queue(page, "Nikola Jokic");
  await queue(page, "Shai Gilgeous-Alexander");
  await page
    .getByLabel("Move up Shai Gilgeous-Alexander", { exact: true })
    .click();
  expect((await read(page)).queues.real[0]).toBe("shai-gilgeous-alexander");
  await page
    .locator(".queue-stack li")
    .filter({ hasText: "Shai Gilgeous-Alexander" })
    .dragTo(
      page.locator(".queue-stack li").filter({ hasText: "Nikola Jokic" }),
    );
  expect((await read(page)).queues.real[0]).toBe("nikola-jokic");
  await page
    .getByLabel("Move up Shai Gilgeous-Alexander", { exact: true })
    .click();
  await first(page);
  await expect(page.locator(".queue-taken")).toContainText("Nikola Jokic");
  await page.reload();
  await ready(page);
  await expect(page.locator(".queue-taken")).toContainText("Nikola Jokic");
  await page
    .getByRole("button", { name: "UNDO LAST PICK", exact: true })
    .click();
  await expect(page.locator(".queue-taken")).toHaveCount(0);
  await expect(page.locator(".path-card")).toHaveCount(3);
  await expect(page.locator(".path-card").first()).toContainText("Fallbacks");
});
test("Recovery restores a checkpoint, preserves current notes and adds history", async ({
  page,
}) => {
  await open(page);
  await first(page);
  await first(page);
  await expect(page.locator(".save-status")).toHaveText("CHECKPOINT SAVED");
  await page.locator("#player-search").fill("Luka Doncic");
  await page.locator(".player-name").click();
  await page
    .getByRole("textbox", { name: "Player note", exact: true })
    .fill("Keep after recovery");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Recovery", exact: true }).click();
  const checkpoint = page
    .locator(".recovery-timeline button")
    .filter({ hasText: "Drafted Nikola Jokic" })
    .filter({ hasText: "Pick 2" });
  await checkpoint.first().click();
  await page
    .getByRole("button", { name: "Confirm restore checkpoint", exact: true })
    .click();
  expect((await read(page)).realDraft.picks).toHaveLength(1);
  expect((await read(page)).personal["luka-doncic"].note).toBe(
    "Keep after recovery",
  );
  await expect(page.locator(".save-status")).toHaveText("CHECKPOINT SAVED");
  await page.getByRole("button", { name: "Recovery", exact: true }).click();
  await expect(page.locator(".recovery-timeline")).toContainText(
    "Restored recovery checkpoint",
  );
  await expect(page.locator(".recovery-timeline")).toContainText("Pick 3");
});
test("Live lock blocks config but allows keyboard draft, queue, undo", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Lock for live draft", exact: true })
    .click();
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save settings", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reset real draft", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Preview workbook", { exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "WAR ROOM", exact: true }).click();
  await page.keyboard.press("/");
  await page.keyboard.type("dur");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toContainText("Jalen Duren");
  expect((await read(page)).realDraft.picks).toHaveLength(0);
  await page.keyboard.press("Enter");
  expect((await read(page)).realDraft.picks[0].playerId).toBe("jalen-duren");
  await page
    .getByRole("button", { name: "UNDO LAST PICK", exact: true })
    .click();
  expect((await read(page)).realDraft.picks).toHaveLength(0);
  await page
    .getByRole("button", {
      name: "LIVE DRAFT LOCKED · Unlock settings",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  expect((await read(page)).draftLocked).toBe(false);
});
test("League eligibility, starter display and true score breakdown", async ({
  page,
}) => {
  await open(page);
  await page.locator("#player-search").fill("Nikola Jokic");
  await page.locator(".player-name").click();
  await expect(page.getByRole("dialog")).toContainText("Best planning slot");
  await page
    .getByRole("button", { name: "League eligibility PG", exact: true })
    .click();
  expect((await read(page)).eligibilityOverrides["nikola-jokic"]).toContain(
    "PG",
  );
  await expect(page.locator(".eligibility-panel")).toContainText("Workbook: C");
  await page.locator("dialog .score-breakdown summary").click();
  await expect(page.locator("dialog .score-breakdown")).toContainText(
    "Research value",
  );
  await page
    .getByRole("button", { name: "Reset override", exact: true })
    .click();
  expect((await read(page)).eligibilityOverrides).toEqual({});
});
for (const fallback of [false, true])
  test(
    "Multi-tab read-only and explicit takeover " +
      (fallback ? "fallback" : "Web Locks"),
    async ({ page, context }) => {
      if (fallback)
        await context.addInitScript(() =>
          Object.defineProperty(navigator, "locks", { value: undefined }),
        );
      await open(page);
      await first(page);
      const second = await context.newPage();
      await second.goto("/");
      await expect(second.locator(".ownership-banner")).toBeVisible();
      await second.locator(".player-row .draft-icon").first().click();
      await expect(second.getByRole("dialog")).toHaveCount(0);
      expect((await read(second)).realDraft.picks).toHaveLength(1);
      await second
        .getByRole("button", { name: "Take control", exact: true })
        .click();
      await second
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await ready(second);
      await expect(page.locator(".ownership-banner")).toBeVisible();
      await first(second);
      await expect
        .poll(async () => (await read(page)).realDraft.picks.length)
        .toBe(2);
      await page
        .getByRole("button", { name: "UNDO LAST PICK", exact: true })
        .click();
      expect((await read(page)).realDraft.picks).toHaveLength(2);
    },
  );
test("Workbook read-only preview and all-slot lab", async ({ page }) => {
  await open(page, null);
  await page
    .getByRole("button", { name: "Draft slot lab", exact: true })
    .click();
  await expect(page.locator(".slot-lab tbody tr")).toHaveCount(10);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await page
    .getByLabel("Preview workbook", { exact: true })
    .setInputFiles(
      "NBA_2026_27_Custom_Draft_Board_600_DraftDay_2026-10-10.xlsx",
    );
  await expect(
    page.getByText("600 matched · 0 new · 0 removed", { exact: true }),
  ).toBeVisible();
  expect((await read(page)).leagueSettings.draftSlot).toBeNull();
});
test("Eight-round isolated live rehearsal: queue, correction, undo, restore, reload, compare", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, 7);
  await queue(page, "Nikola Jokic");
  await queue(page, "Jalen Duren");
  await page
    .getByRole("button", { name: "Lock for live draft", exact: true })
    .click();
  for (let i = 0; i < 80; i++) await first(page);
  expect((await read(page)).realDraft.picks).toHaveLength(80);
  expect(
    (await read(page)).realDraft.picks.filter(
      (p: { teamId: string }) => p.teamId === "team-1",
    ),
  ).toHaveLength(8);
  await expect(page.locator(".queue-taken")).toHaveCount(2);
  await page.reload();
  await ready(page);
  await expect(page.locator(".wait-risks")).toContainText("teams need");
  await expect(page.locator(".path-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "UNDO LAST PICK", exact: true })
    .click();
  await page.getByRole("button", { name: "DRAFT BOARD", exact: true }).click();
  await page.locator(".pick-tile").filter({ hasText: "Nikola Jokic" }).click();
  await page
    .getByRole("textbox", { name: "Search replacement" })
    .fill("Jimmy Butler");
  await page
    .locator(".correction-results button")
    .filter({ hasText: "Jimmy Butler" })
    .click();
  await page.getByRole("button", { name: "Confirm correction" }).click();
  expect((await read(page)).realDraft.picks[0].playerId).toBe("jimmy-butler");
  await page
    .getByRole("button", {
      name: "LIVE DRAFT LOCKED · Unlock settings",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("CHECKPOINT SAVED");
  await page.getByRole("button", { name: "Recovery", exact: true }).click();
  await page
    .locator(".recovery-timeline button")
    .filter({ hasText: "Pick 81" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Confirm restore checkpoint", exact: true })
    .click();
  expect((await read(page)).realDraft.picks).toHaveLength(80);
  expect((await read(page)).realDraft.picks[0].playerId).toBe("nikola-jokic");
  await page.getByRole("button", { name: "WAR ROOM", exact: true }).click();
  for (const name of ["Jimmy Butler", "Kristaps Porzingis"]) {
    await page.locator("#player-search").fill(name);
    await page.locator(".player-name").click();
    await page.getByRole("button", { name: "COMPARE", exact: true }).click();
  }
  await expect(page.getByRole("dialog")).toContainText("SIDE BY SIDE");
  expect(errors).toEqual([]);
});
for (const width of [1920, 1440, 390])
  test("Upgrade responsive panels " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
    await open(page);
    if (width < 760)
      await page.getByRole("button", { name: "BOARD", exact: true }).click();
    await queue(page, "Jalen Duren");
    if (width < 760)
      await page.getByRole("button", { name: "QUEUE", exact: true }).click();
    await expect(page.locator(".queue-panel")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    if (width < 760)
      await page.getByRole("button", { name: "PICK", exact: true }).click();
    await expect(page.locator(".advanced-plans")).toBeVisible();
    await page.getByRole("button", { name: "Recovery", exact: true }).click();
    await expect(page.locator(".recovery-timeline")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });

test("Production schema-1 browser state migrates without losing draft or scouting", async ({
  page,
}) => {
  const s = defaultState();
  s.setupDone = true;
  s.leagueSettings.draftSlot = 7;
  s.realDraft.picks = [
    { overall: 1, playerId: "nikola-jokic", teamId: "team-2" },
  ];
  s.personal["jalen-duren"] = {
    note: "Legacy note",
    watch: true,
    rank: 10,
    target: "PRIORITY",
  };
  const legacy: Record<string, unknown> = {
    ...s,
    schemaVersion: 1,
    appVersion: "1.0.0",
  };
  for (const k of [
    "queues",
    "autoRemoveQueued",
    "eligibilityOverrides",
    "draftLocked",
  ])
    delete legacy[k];
  await page.addInitScript(
    ({ key, legacy }) => localStorage.setItem(key, JSON.stringify(legacy)),
    { key, legacy },
  );
  await page.goto("/");
  await ready(page);
  await page.locator("#player-search").fill("Jalen Duren");
  await page.locator(".player-name").click();
  await expect(
    page.getByRole("textbox", { name: "Player note", exact: true }),
  ).toHaveValue("Legacy note");
  await page.getByRole("button", { name: "Add to queue", exact: true }).click();
  const migrated = await read(page);
  expect(migrated.schemaVersion).toBe(2);
  expect(migrated.appVersion).toBe("1.1.0");
  expect(migrated.realDraft.picks).toEqual(s.realDraft.picks);
  expect(migrated.personal).toEqual(s.personal);
  expect(migrated.queues.real).toEqual(["jalen-duren"]);
});
test("Recovery failure is visible while localStorage still saves the pick", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      value: {
        open() {
          throw Error("Unavailable storage fixture");
        },
      },
    }),
  );
  await open(page);
  await first(page);
  await expect(page.locator(".save-status")).toHaveText("CHECKPOINT FAILED");
  await expect(page.getByRole("status")).toContainText(
    "Recovery storage unavailable",
  );
  expect((await read(page)).realDraft.picks).toHaveLength(1);
});
test("Mock checkpoint restore stays separate and auto-remove is explicit", async ({
  page,
}) => {
  await open(page);
  await first(page);
  const real = (await read(page)).realDraft;
  await page.getByRole("button", { name: "MOCK DRAFT", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Mock draft position" })
    .selectOption("7");
  await queue(page, "Nikola Jokic");
  await page
    .getByRole("checkbox", { name: "Auto-remove taken players (default off)" })
    .check();
  await page.getByRole("button", { name: "Fast forward to my pick" }).click();
  expect((await read(page)).queues.mock).toEqual([]);
  await expect(page.locator(".save-status")).toHaveText("CHECKPOINT SAVED");
  await page.getByRole("button", { name: "Recovery", exact: true }).click();
  await page.getByRole("button", { name: "Mock draft", exact: true }).click();
  await page
    .locator(".recovery-timeline button")
    .filter({ hasText: "Pick 1" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Confirm restore checkpoint", exact: true })
    .click();
  expect((await read(page)).mockDraft.picks).toHaveLength(0);
  expect((await read(page)).realDraft).toEqual(real);
  await expect(page.locator(".save-status")).toHaveText("CHECKPOINT SAVED");
  await page.getByRole("button", { name: "Recovery", exact: true }).click();
  await page.getByRole("button", { name: "Mock draft", exact: true }).click();
  await expect(page.locator(".recovery-timeline")).toContainText(
    "Restored recovery checkpoint",
  );
});

test("Unreadable saved state is protected until an explicit validated restore", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("nba-draft-assistant:v1", "{broken"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Research first", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lock for live draft", exact: true })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("nba-draft-assistant:v1")),
  ).toBe("{broken");
  await expect(page.getByRole("status")).toContainText(
    "original localStorage record is protected",
  );
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await page.locator("input[type=file][accept*=json]").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...defaultState(), setupDone: true })),
  });
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  expect((await read(page)).schemaVersion).toBe(2);
});

test("Queue and search shortcuts navigate safely across mobile sections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole("button", { name: "MY TEAM", exact: true }).click();
  await page.keyboard.press("q");
  await expect(page.locator(".queue-panel")).toBeVisible();
  await expect(page.locator(".queue-panel")).toBeFocused();
  await page.keyboard.press("/");
  await expect(page.locator("#player-search")).toBeFocused();
  await page.locator("#player-search").fill("q");
  expect((await read(page)).realDraft.picks).toHaveLength(0);
  await expect(page.locator("#player-search")).toHaveValue("q");
});

test("Backup validation uses workbook eligibility plus the backup's own overrides", async ({
  page,
}) => {
  await open(page);
  await page.locator("#player-search").fill("Nikola Jokic");
  await page.locator(".player-name").click();
  await page
    .getByRole("button", { name: "League eligibility PG", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "SETTINGS", exact: true }).click();
  const invalid = defaultState();
  invalid.setupDone = true;
  invalid.leagueSettings.draftSlot = 7;
  invalid.realDraft = {
    picks: [{ overall: 1, playerId: "nikola-jokic", teamId: "team-2" }],
    slotOverrides: { "nikola-jokic": "PG-0" },
  };
  await page.locator("input[type=file][accept*=json]").setInputFiles({
    name: "invalid-eligibility.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect(page.getByRole("status")).toContainText("Import rejected");
  expect((await read(page)).realDraft.picks).toHaveLength(0);
});
