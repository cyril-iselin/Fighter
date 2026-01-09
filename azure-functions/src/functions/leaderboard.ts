// ============================================================================
// LEADERBOARD - Azure Function
// ============================================================================
// Combined GET/POST handler for highscores
// ============================================================================

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from 'crypto';

interface HighscoreEntity {
  partitionKey: string;
  rowKey: string;
  playerName: string;
  score: number;
  level: number;
  bonusPoints: number;
  damageDealt: number;
  createdUtc: string;
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

interface SubmitScoreRequest {
  playerName: string;
  level: number;
  damageDealt: number;
}

function getCorsHeaders(): Record<string, string> {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function getTableClient(): TableClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
  }
  return TableClient.fromConnectionString(connectionString, 'FighterHighScore');
}

// ============================================================================
// GET - Fetch leaderboard
// ============================================================================

async function handleGet(context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Fetching leaderboard');

  try {
    const tableClient = getTableClient();

    // Query only highscore partition
    const entities: HighscoreEntity[] = [];
    const queryFilter = `PartitionKey eq 'highscore'`;
    
    for await (const entity of tableClient.listEntities<HighscoreEntity>({ queryOptions: { filter: queryFilter } })) {
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
      timestamp: entity.createdUtc || new Date().toISOString()
    }));

    return {
      status: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify(leaderboard)
    };

  } catch (error) {
    context.error('Error fetching highscores:', error);
    return {
      status: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: 'Failed to fetch highscores' })
    };
  }
}

// ============================================================================
// POST - Save highscore
// ============================================================================

async function handlePost(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Saving highscore');

  try {
    const body = await request.json() as SubmitScoreRequest;
    
    if (!body.playerName || body.level === undefined) {
      return {
        status: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'playerName and level are required' })
      };
    }

    const tableClient = getTableClient();
    const playerName = body.playerName.substring(0, 50);

    // Calculate score: Level * 1000 + Damage / 10
    const damageDealt = body.damageDealt || 0;
    const newScore = body.level * 1000 + Math.floor(damageDealt / 10);
    const bonusPoints = Math.floor(damageDealt / 10);

    // Check if player already has an entry
    let existingEntity: HighscoreEntity | null = null;
    const queryFilter = `PartitionKey eq 'highscore' and playerName eq '${playerName.replace(/'/g, "''")}'`;
    
    for await (const entity of tableClient.listEntities<HighscoreEntity>({ queryOptions: { filter: queryFilter } })) {
      existingEntity = entity;
      break; // Only need the first match
    }

    let entityId: string;
    let shouldUpdate = false;

    if (existingEntity) {
      // Player exists - only update if new score is higher
      if (newScore > existingEntity.score) {
        entityId = existingEntity.rowKey;
        shouldUpdate = true;
        context.log(`Updating existing player ${playerName}: ${existingEntity.score} -> ${newScore}`);
      } else {
        // New score is not higher - don't save, just return current rank
        context.log(`Player ${playerName} score ${newScore} not higher than existing ${existingEntity.score}`);
        
        // Calculate rank for existing score
        let rank = 1;
        const allEntitiesFilter = `PartitionKey eq 'highscore'`;
        for await (const e of tableClient.listEntities<HighscoreEntity>({ queryOptions: { filter: allEntitiesFilter } })) {
          if (e.score > existingEntity.score) {
            rank++;
          }
        }

        return {
          status: 200,
          headers: getCorsHeaders(),
          body: JSON.stringify({
            rank: rank,
            score: existingEntity.score,
            isNewHighScore: false,
            message: 'Score not improved'
          })
        };
      }
    } else {
      // New player - create new entry
      entityId = randomUUID();
      context.log(`Creating new entry for player ${playerName}`);
    }

    // Create/update entity
    const entity: HighscoreEntity = {
      partitionKey: 'highscore',
      rowKey: entityId,
      playerName: playerName,
      score: newScore,
      level: body.level,
      bonusPoints: bonusPoints,
      damageDealt: damageDealt,
      createdUtc: new Date().toISOString()
    };

    if (shouldUpdate) {
      // Update existing entity
      await tableClient.updateEntity(entity, 'Replace');
    } else {
      // Create new entity
      await tableClient.createEntity(entity);
    }

    // Calculate rank (count entries with higher score)
    let rank = 1;
    const allEntitiesFilter = `PartitionKey eq 'highscore'`;
    for await (const e of tableClient.listEntities<HighscoreEntity>({ queryOptions: { filter: allEntitiesFilter } })) {
      if (e.score > newScore) {
        rank++;
      }
    }

    // Check if this is a new high score (top 10)
    const isNewHighScore = rank <= 10;

    return {
      status: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        rank: rank,
        score: newScore,
        isNewHighScore: isNewHighScore
      })
    };

  } catch (error) {
    context.error('Error saving highscore:', error);
    return {
      status: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: 'Failed to save highscore' })
    };
  }
}

// ============================================================================
// Main Handler
// ============================================================================

async function leaderboard(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return { status: 204, headers: getCorsHeaders() };
  }

  if (request.method === 'GET') {
    return handleGet(context);
  }

  if (request.method === 'POST') {
    return handlePost(request, context);
  }

  return {
    status: 405,
    headers: getCorsHeaders(),
    body: JSON.stringify({ error: 'Method not allowed' })
  };
}

// Register single function for all methods
app.http('leaderboard', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler: leaderboard
});
