import { beforeEach, describe, expect, it, mock } from "bun:test";

const notificationSubscriberUpsert = mock(async () => ({
  id: "subscriber-1",
  userId: "user-1",
  name: "Johan",
}));

const matchSubscriptionFindUnique = mock(async () => null);
const matchSubscriptionCreate = mock(async (args: unknown) => args);
const matchSubscriptionUpdate = mock(async (args: unknown) => args);

const footballGetFixtures = mock(async () => ({
  response: [],
}));

const captureSubscriptionBaseline = mock(async () => {});
const deleteSubscriptionBaseline = mock(async () => {});
const moveSubscriptionBaseline = mock(async () => {});

mock.module("../../../lib/minuto-client", () => ({
  minutoPrismaClient: {
    notificationSubscriber: {
      upsert: notificationSubscriberUpsert,
    },
    matchSubscription: {
      findUnique: matchSubscriptionFindUnique,
      create: matchSubscriptionCreate,
      update: matchSubscriptionUpdate,
    },
    favorite: {
      findUnique: mock(async () => null),
      findFirst: mock(async () => null),
      findMany: mock(async () => []),
    },
  },
}));

mock.module("../../users/application/user.service", () => ({
  userService: {
    findOrCreateByClerkId: mock(async () => ({
      id: "user-1",
      clerkId: "clerk_123",
    })),
  },
}));

mock.module("../../sports/application/football.service", () => ({
  footballService: {
    getFixtures: footballGetFixtures,
  },
}));

mock.module("./subscription-baseline", () => ({
  captureSubscriptionBaseline,
  deleteSubscriptionBaseline,
  moveSubscriptionBaseline,
}));

const { userNotificationSettingsService } = await import("./user-notification-settings.service");

describe("userNotificationSettingsService", () => {
  beforeEach(() => {
    notificationSubscriberUpsert.mockClear();
    matchSubscriptionFindUnique.mockClear();
    matchSubscriptionCreate.mockClear();
    matchSubscriptionUpdate.mockClear();
    footballGetFixtures.mockClear();
    captureSubscriptionBaseline.mockClear();
    deleteSubscriptionBaseline.mockClear();
    moveSubscriptionBaseline.mockClear();
  });

  it("creates WhatsApp subscriptions for upcoming fixtures when a football team favorite is added", async () => {
    footballGetFixtures.mockImplementationOnce(async () => ({
      response: [
        {
          fixture: {
            id: 101,
            date: "2026-04-07T20:00:00.000Z",
          },
          league: {
            id: 39,
            name: "Premier League",
          },
          teams: {
            home: {
              id: 50,
              name: "Manchester City",
            },
            away: {
              id: 40,
              name: "Chelsea",
            },
          },
        },
        {
          fixture: {
            id: 102,
            date: "2026-04-10T18:30:00.000Z",
          },
          league: {
            id: 39,
            name: "Premier League",
          },
          teams: {
            home: {
              id: 70,
              name: "Arsenal",
            },
            away: {
              id: 50,
              name: "Manchester City",
            },
          },
        },
      ],
    }));

    await userNotificationSettingsService.syncFavoriteToggleByUserId({
      userId: "user-1",
      favorite: {
        sport: "football",
        entityType: "team",
        entityId: 50,
        metadata: {
          id: 50,
          name: "Manchester City",
        },
      },
      action: "added",
    });

    expect(notificationSubscriberUpsert).toHaveBeenCalledTimes(1);
    expect(footballGetFixtures).toHaveBeenCalledWith({
      team: 50,
      next: 20,
      timezone: "UTC",
    });
    expect(matchSubscriptionCreate).toHaveBeenCalledTimes(2);
    expect(matchSubscriptionCreate).toHaveBeenNthCalledWith(1, {
      data: {
        subscriberId: "subscriber-1",
        fixtureId: 101,
        homeTeamId: 50,
        awayTeamId: 40,
        homeTeam: "Manchester City",
        awayTeam: "Chelsea",
        leagueName: "Premier League",
        matchDate: new Date("2026-04-07T20:00:00.000Z"),
        sourceType: "team_favorite",
        sourceEntityId: 50,
      },
    });
    expect(matchSubscriptionCreate).toHaveBeenNthCalledWith(2, {
      data: {
        subscriberId: "subscriber-1",
        fixtureId: 102,
        homeTeamId: 70,
        awayTeamId: 50,
        homeTeam: "Arsenal",
        awayTeam: "Manchester City",
        leagueName: "Premier League",
        matchDate: new Date("2026-04-10T18:30:00.000Z"),
        sourceType: "team_favorite",
        sourceEntityId: 50,
      },
    });
    expect(captureSubscriptionBaseline).toHaveBeenCalledTimes(2);
  });
});
