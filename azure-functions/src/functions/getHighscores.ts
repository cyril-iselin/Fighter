// ============================================================================
// GET HIGHSCORES - Azure Function
// ============================================================================
// Returns top 100 highscores from Azure Table Storage
// ============================================================================

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

interface HighscoreEntity {
  partitionKey: string;
  rowKey: string;
  playerName: string;
  score: number;
  level: number;
  bonusPoints: number;
  timestamp: Date;
}

interface LeaderboardEntry {
  id: string;
  rank: number;
  playerName: string;
  score: number;
  level: number;
  bonusPoints: number;
  timestamp: string;
}

async function getHighscores(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('GetHighscores function processing request');

  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
    }

    const tableClient = TableClient.fromConnectionString(connectionString, 'FighterHighScore');

    // Query all entities and sort by score descending
    const entities: HighscoreEntity[] = [];
    const entitiesIter = tableClient.listEntities<HighscoreEntity>();
    
    for await (const entity of entitiesIter) {
      entities.push(entity);
    }

    // Sort by score descending and take top 100
    entities.sort((a, b) => b.score - a.score);
    const top100 = entities.slice(0, 100);

    // Map to response format with ranks
    const leaderboard: LeaderboardEntry[] = top100.map((entity, index) => ({
      id: entity.rowKey,
      rank: index + 1,
      playerName: entity.playerName,
      score: entity.score,
      level: entity.level,
      bonusPoints: entity.bonusPoints || 0,
      timestamp: entity.timestamp?.toISOString() || new Date().toISOString()
    }));

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(leaderboard)
    };

  } catch (error) {
    context.error('Error fetching highscores:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to fetch highscores' })
    };
  }
}

// Register the function
app.http('getHighscores', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler: getHighscores
});
