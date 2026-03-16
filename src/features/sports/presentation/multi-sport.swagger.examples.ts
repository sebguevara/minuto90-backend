export const volleyballSwaggerExamples = {
  seasons: ["2018", "2019", "2020", "2021", "2022", "2023"],
  leagues: {
    response: [
      {
        id: 2,
        name: "SuperLega",
        type: "League",
        logo: "https://media.api-sports.io/volleyball/leagues/2.png",
      },
    ],
  },
  games: {
    response: [
      {
        id: 4410,
        date: "2023-11-20T17:30:00+00:00",
        time: "17:30",
        timezone: "UTC",
        league: { id: 2, name: "SuperLega", season: "2023", logo: "2.png" },
        teams: {
          home: { id: 15, name: "Lube Civitanova", logo: "15.png" },
          away: { id: 18, name: "Trentino Volley", logo: "18.png" },
        },
        scores: {
          home: { set_1: 25, set_2: 21, set_3: 25, set_4: 18, set_5: 15, total: 3 },
          away: { set_1: 23, set_2: 25, set_3: 21, set_4: 25, set_5: 13, total: 2 },
        },
        status: { long: "Finished", short: "FT" },
      },
    ],
  },
  teams: {
    response: [
      {
        id: 15,
        name: "Lube Civitanova",
        logo: "https://media.api-sports.io/volleyball/teams/15.png",
        country: { id: 25, name: "Italy", code: "IT", flag: "it.svg" },
      },
    ],
  },
  standings: {
    response: [
      [
        {
          position: 1,
          team: { id: 18, name: "Trentino Volley", logo: "18.png" },
          games: { played: 22, win: { total: 19 }, lose: { total: 3 } },
          points: { for: 1920, against: 1650 },
          sets: { won: 60, lost: 15, ratio: 4 },
          form: "WWWLW",
        },
      ],
    ],
  },
};

export const rugbySwaggerExamples = {
  seasons: ["2019", "2020", "2021", "2022", "2023"],
  leagues: {
    response: [
      {
        id: 16,
        name: "Six Nations",
        type: "Cup",
        logo: "https://media.api-sports.io/rugby/leagues/16.png",
      },
    ],
  },
  games: {
    response: [
      {
        id: 481,
        date: "2023-10-28T19:00:00+00:00",
        time: "19:00",
        timezone: "UTC",
        league: { id: 18, name: "Rugby World Cup", season: "2023", logo: "18.png" },
        teams: {
          home: { id: 12, name: "New Zealand", logo: "12.png" },
          away: { id: 14, name: "South Africa", logo: "14.png" },
        },
        scores: {
          home: { first_half: 6, second_half: 5, total: 11 },
          away: { first_half: 12, second_half: 0, total: 12 },
        },
        status: { long: "Finished", short: "FT" },
      },
    ],
  },
  teams: {
    response: [
      {
        id: 12,
        name: "New Zealand",
        logo: "https://media.api-sports.io/rugby/teams/12.png",
        country: { id: 36, name: "New Zealand", code: "NZ", flag: "nz.svg" },
      },
    ],
  },
  standings: {
    response: [
      [
        {
          position: 1,
          team: { id: 12, name: "New Zealand", logo: "12.png" },
          games: {
            played: 4,
            win: { total: 3 },
            lose: { total: 1 },
            draw: { total: 0 },
          },
          points: { for: 253, against: 47 },
          bonus: 3,
          form: "WWWL",
        },
      ],
    ],
  },
};

export const nflSwaggerExamples = {
  seasons: {
    get: "seasons",
    parameters: [],
    errors: [],
    results: 4,
    response: ["2020", "2021", "2022", "2023"],
  },
  leagues: {
    response: [
      {
        id: 1,
        name: "NFL",
        type: "league",
        logo: "https://media.api-sports.io/american-football/leagues/1.png",
      },
    ],
  },
  games: {
    response: [
      {
        id: 1145,
        date: "2023-09-08T00:20:00+00:00",
        time: "00:20",
        timezone: "UTC",
        league: { id: 1, name: "NFL", season: "2023", logo: "1.png" },
        teams: {
          home: { id: 15, name: "Kansas City Chiefs", logo: "15.png" },
          away: { id: 10, name: "Detroit Lions", logo: "10.png" },
        },
        scores: {
          home: { quarter_1: 0, quarter_2: 14, quarter_3: 3, quarter_4: 3, overtime: 0, total: 20 },
          away: { quarter_1: 7, quarter_2: 0, quarter_3: 7, quarter_4: 7, overtime: 0, total: 21 },
        },
        status: { long: "Finished", short: "FT" },
      },
    ],
  },
  teams: {
    response: [
      {
        id: 15,
        name: "Kansas City Chiefs",
        logo: "https://media.api-sports.io/american-football/teams/15.png",
        country: { id: 1, name: "USA", code: "US", flag: "us.svg" },
      },
    ],
  },
  standings: {
    response: [
      [
        {
          position: 1,
          team: { id: 15, name: "Kansas City Chiefs", logo: "15.png" },
          games: { played: 17, win: { total: 11 }, lose: { total: 6 }, tie: { total: 0 } },
          points: { for: 371, against: 294 },
          form: "WWLWW",
        },
      ],
    ],
  },
};

export const nbaSwaggerExamples = {
  seasons: {
    get: "seasons",
    parameters: [],
    errors: [],
    results: 6,
    response: ["2018", "2019", "2020", "2021", "2022", "2023"],
  },
  leagues: {
    response: [
      {
        id: 12,
        name: "NBA",
        type: "League",
        logo: "https://media.api-sports.io/basketball/leagues/12.png",
      },
    ],
  },
  games: {
    response: [
      {
        id: 10456,
        date: "2023-10-25T23:30:00+00:00",
        time: "23:30",
        timezone: "UTC",
        league: { id: 12, name: "NBA", season: "2023-2024" },
        teams: {
          home: { id: 145, name: "Boston Celtics", logo: "145.png" },
          away: { id: 146, name: "New York Knicks", logo: "146.png" },
        },
        scores: {
          home: { quarter_1: 25, quarter_2: 30, quarter_3: 20, quarter_4: 25, total: 100 },
          away: { quarter_1: 20, quarter_2: 25, quarter_3: 30, quarter_4: 20, total: 95 },
        },
        status: { long: "Finished", short: "FT" },
      },
    ],
  },
  teams: {
    response: [
      {
        id: 145,
        name: "Boston Celtics",
        logo: "https://media.api-sports.io/basketball/teams/145.png",
        country: { id: 5, name: "USA", code: "US", flag: "us.svg" },
      },
    ],
  },
  standings: {
    response: [
      [
        {
          position: 1,
          team: { id: 145, name: "Boston Celtics", logo: "145.png" },
          games: { played: 82, win: { total: 64 }, lose: { total: 18 } },
          points: { for: 9668, against: 8900 },
          form: "WWWWW",
        },
      ],
    ],
  },
};

export const basketballSwaggerExamples = {
  seasons: { response: ["2018", "2019", "2020", "2021", "2022", "2023"] },
  leagues: {
    response: [
      {
        id: 117,
        name: "Euroleague",
        type: "Cup",
        logo: "https://media.api-sports.io/basketball/leagues/117.png",
      },
    ],
  },
  games: nbaSwaggerExamples.games,
  teams: {
    response: [
      {
        id: 357,
        name: "Real Madrid",
        logo: "https://media.api-sports.io/basketball/teams/357.png",
        country: { id: 42, name: "Spain", code: "ES", flag: "es.svg" },
      },
    ],
  },
  standings: {
    response: [
      [
        {
          position: 1,
          team: { id: 357, name: "Real Madrid", logo: "357.png" },
          games: { played: 34, win: { total: 27 }, lose: { total: 7 } },
          points: { for: 2924, against: 2681 },
          form: "WWLWW",
        },
      ],
    ],
  },
};

export const hockeySwaggerExamples = {
  seasons: ["2018", "2019", "2020", "2021", "2022", "2023"],
  leagues: {
    response: [
      {
        id: 57,
        name: "NHL",
        type: "League",
        logo: "https://media.api-sports.io/hockey/leagues/57.png",
      },
    ],
  },
  games: {
    response: [
      {
        id: 9945,
        date: "2023-11-05T00:30:00+00:00",
        time: "00:30",
        timezone: "UTC",
        league: { id: 57, name: "NHL", season: "2023", logo: "57.png" },
        teams: {
          home: { id: 13, name: "Boston Bruins", logo: "13.png" },
          away: { id: 16, name: "Toronto Maple Leafs", logo: "16.png" },
        },
        scores: {
          home: { period_1: 1, period_2: 2, period_3: 1, overtime: 0, penalties: 0, total: 4 },
          away: { period_1: 0, period_2: 1, period_3: 2, overtime: 0, penalties: 0, total: 3 },
        },
        status: { long: "Finished", short: "FT" },
      },
    ],
  },
  teams: {
    response: [
      {
        id: 13,
        name: "Boston Bruins",
        logo: "https://media.api-sports.io/hockey/teams/13.png",
        country: { id: 5, name: "USA", code: "US", flag: "us.svg" },
      },
    ],
  },
  standings: {
    response: [
      [
        {
          position: 1,
          team: { id: 13, name: "Boston Bruins", logo: "13.png" },
          games: { played: 82, win: { total: 65 }, lose: { total: 12 }, overtime_loss: 5 },
          points: 135,
          goals: { for: 305, against: 177 },
          form: "WWLWW",
        },
      ],
    ],
  },
};

export const handballSwaggerExamples = {
  seasons: ["2019", "2020", "2021", "2022", "2023"],
  leagues: {
    response: [
      {
        id: 1,
        name: "EHF Champions League",
        type: "League",
        logo: "https://media.api-sports.io/handball/leagues/1.png",
      },
    ],
  },
  games: {
    response: [
      {
        id: 1500,
        date: "2023-10-15T18:00:00+00:00",
        time: "18:00",
        timezone: "UTC",
        league: { id: 1, name: "EHF Champions League", season: "2023", logo: "1.png" },
        teams: {
          home: { id: 40, name: "FC Barcelona", logo: "40.png" },
          away: { id: 55, name: "THW Kiel", logo: "55.png" },
        },
        scores: {
          home: { first_half: 15, second_half: 18, total: 33 },
          away: { first_half: 14, second_half: 16, total: 30 },
        },
        status: { long: "Finished", short: "FT" },
      },
    ],
  },
  teams: {
    response: [
      {
        id: 40,
        name: "FC Barcelona",
        logo: "https://media.api-sports.io/handball/teams/40.png",
        country: { id: 42, name: "Spain", code: "ES", flag: "es.svg" },
      },
    ],
  },
  standings: {
    response: [
      [
        {
          position: 1,
          team: { id: 40, name: "FC Barcelona", logo: "40.png" },
          games: { played: 14, win: { total: 12 }, lose: { total: 1 }, draw: { total: 1 } },
          points: { for: 450, against: 390 },
          form: "WWDLW",
        },
      ],
    ],
  },
};

export const baseballSwaggerExamples = {
  seasons: ["2019", "2020", "2021", "2022", "2023"],
  leagues: {
    response: [
      {
        id: 1,
        name: "MLB",
        type: "League",
        logo: "https://media.api-sports.io/baseball/leagues/1.png",
      },
    ],
  },
  games: {
    response: [
      {
        id: 5515,
        date: "2023-11-01T00:00:00+00:00",
        time: "00:00",
        timezone: "UTC",
        league: { id: 1, name: "MLB", season: "2023", logo: "1.png" },
        teams: {
          home: { id: 43, name: "Texas Rangers", logo: "43.png" },
          away: { id: 7, name: "Arizona Diamondbacks", logo: "7.png" },
        },
        scores: {
          home: { innings: { "1": 0, "2": 0, "3": 3, "7": 4 }, total: 7 },
          away: { innings: { "1": 0, "2": 0, "3": 0, "8": 1 }, total: 1 },
        },
        status: { long: "Finished", short: "FT" },
      },
    ],
  },
  teams: {
    response: [
      {
        id: 43,
        name: "Texas Rangers",
        logo: "https://media.api-sports.io/baseball/teams/43.png",
        country: { id: 1, name: "USA", code: "US", flag: "us.svg" },
      },
    ],
  },
  standings: {
    response: [
      [
        {
          position: 1,
          team: { id: 43, name: "Texas Rangers", logo: "43.png" },
          games: { played: 162, win: { total: 90 }, lose: { total: 72 } },
          points: { for: 881, against: 716 },
          form: "WWWLW",
        },
      ],
    ],
  },
};

export const aflSwaggerExamples = {
  seasons: { response: ["2018", "2019", "2020", "2021", "2022", "2023"] },
  leagues: {
    response: [
      {
        id: 1,
        name: "AFL",
        type: "league",
        logo: "https://media.api-sports.io/aussie-rules/leagues/1.png",
      },
    ],
  },
  games: {
    response: [
      {
        id: 1690,
        date: "2023-09-30T04:30:00+00:00",
        time: "04:30",
        timezone: "UTC",
        league: { id: 1, name: "AFL", season: "2023", logo: "1.png" },
        teams: {
          home: { id: 2, name: "Collingwood Magpies", logo: "2.png" },
          away: { id: 9, name: "Brisbane Lions", logo: "9.png" },
        },
        scores: { home: 90, away: 86 },
        status: { long: "Finished", short: "FT" },
      },
    ],
  },
  teams: {
    response: [
      {
        id: 2,
        name: "Collingwood Magpies",
        logo: "https://media.api-sports.io/aussie-rules/teams/2.png",
        country: { id: 1, name: "Australia", code: "AU", flag: "au.svg" },
      },
    ],
  },
  standings: {
    response: [
      [
        {
          position: 1,
          team: { id: 2, name: "Collingwood Magpies", logo: "2.png" },
          games: { played: 23, win: { total: 18 }, lose: { total: 5 }, draw: { total: 0 } },
          points: { for: 2142, against: 1687, percentage: 127 },
          form: "LWWWW",
        },
      ],
    ],
  },
};

export const mmaSwaggerExamples = {
  seasons: { response: ["2020", "2021", "2022", "2023"] },
  leagues: {
    response: [
      {
        id: 1,
        name: "UFC",
        type: "MMA",
        logo: "https://media.api-sports.io/mma/leagues/1.png",
      },
    ],
  },
  fights: {
    response: [
      {
        id: 5510,
        date: "2023-09-10T02:00:00+00:00",
        time: "02:00",
        timezone: "UTC",
        league: { id: 1, name: "UFC", season: "2023", logo: "1.png" },
        fighters: {
          first: { id: 204, name: "Israel Adesanya", logo: "204.png" },
          second: { id: 501, name: "Sean Strickland", logo: "501.png" },
        },
        scores: { first: "Decision", second: "Win (Unanimous)" },
        status: { long: "Finished", short: "FT" },
      },
    ],
  },
  fighters: {
    response: [
      {
        id: 204,
        name: "Israel Adesanya",
        nickname: "The Last Stylebender",
        weight: "84 kg",
        height: "193 cm",
        reach: "203 cm",
        stance: "Orthodox",
        birth_date: "1989-07-22",
        photo: "https://media.api-sports.io/mma/fighters/204.png",
      },
    ],
  },
};

export const formula1SwaggerExamples = {
  seasons: ["2020", "2021", "2022", "2023"],
  races: {
    response: [
      {
        id: 12,
        competition: { id: 1, name: "Formula 1" },
        circuit: { id: 5, name: "Monza", image: "monza.png" },
        season: 2023,
        type: "Race",
        status: "Completed",
        date: "2023-09-03T13:00:00+00:00",
      },
    ],
  },
  teams: {
    response: [
      {
        id: 1,
        name: "Red Bull Racing",
        logo: "https://media.api-sports.io/formula-1/teams/1.png",
        president: "Christian Horner",
        director: "Dietrich Mateschitz",
        technical_manager: "Adrian Newey",
        engine: "Honda RBPT",
      },
    ],
  },
  drivers: {
    response: [
      {
        id: 25,
        name: "Max Verstappen",
        abbr: "VER",
        number: 1,
        team: { id: 1, name: "Red Bull Racing" },
        image: "https://media.api-sports.io/formula-1/drivers/25.png",
      },
    ],
  },
  driverRankings: {
    response: [
      {
        position: 1,
        driver: { id: 25, name: "Max Verstappen", abbr: "VER", number: 1 },
        team: { id: 1, name: "Red Bull Racing" },
        points: 575,
        wins: 19,
        behind: 0,
        season: 2023,
      },
    ],
  },
  teamRankings: {
    response: [
      {
        position: 1,
        team: { id: 1, name: "Red Bull Racing", logo: "1.png" },
        points: 860,
        wins: 21,
        behind: 0,
        season: 2023,
      },
    ],
  },
};
