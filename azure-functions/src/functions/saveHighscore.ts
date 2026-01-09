// ============================================================================
// SAVE HIGHSCORE - Azure Function
// ============================================================================
// Saves a new highscore to Azure Table Storage
// ============================================================================

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { v4 as uuidv4 } from 'uuid';

interface SubmitScoreRequest {
  playerName: string;
  level: number;
  damageDealt: number;
}

interface HighscoreEntity {
  partitionKey: string;
  rowKey: string;
  playerName: string;
  score: number;
  level: number;
  bonusPoints: number;
  damageDealt: number;
}

async function saveHighscore(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SaveHighscore function processing request');

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  try {
    const body = await request.json() as SubmitScoreRequest;
    
    if (!body.playerName || body.level === undefined) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'playerName and level are required' })
      };
    }

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
    }

    const tableClient = TableClient.fromConnectionString(connectionString, 'FighterHighScore');

    // Calculate score: Level * 1000 + Damage / 10
    const damageDealt = body.damageDealt || 0;
    const score = body.level * 1000 + Math.floor(damageDealt / 10);
    const bonusPoints = Math.floor(damageDealt / 10);

    // Generate unique ID
    const id = uuidv4();

    // Create entity
    const entity: HighscoreEntity = {
      partitionKey: 'highscore',  // Single partition for simplicity
      rowKey: id,
      playerName: body.playerName.substring(0, 50), // Limit name length
      score: score,
      level: body.level,
      bonusPoints: bonusPoints,
      damageDealt: damageDealt
    };

    // Insert into table
    await tableClient.createEntity(entity);

    // Calculate rank (count entries with higher score)
    let rank = 1;
    const entitiesIter = tableClient.listEntities<HighscoreEntity>();
    for await (const e of entitiesIter) {
      if (e.score > score) {
        rank++;
      }
    }

    // Check if this is a new high score (top 10)
    const isNewHighScore = rank <= 10;

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        rank: rank,
        score: score,
        isNewHighScore: isNewHighScore
      })
    };

  } catch (error) {
    context.error('Error saving highscore:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to save highscore' })
    };
  }
}

// Register the function
app.http('saveHighscore', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler: saveHighscore
});
