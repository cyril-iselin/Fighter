using System.Collections.Concurrent;
using FighterGame.Api.Models;
using Microsoft.AspNetCore.SignalR;

namespace FighterGame.Api.Hubs;

public class GameHub : Hub
{
    // Thread-safe collections for matchmaking
    private static readonly ConcurrentDictionary<string, PlayerInfo> Players = new();
    private static readonly ConcurrentDictionary<string, Match> ActiveMatches = new();
    private static readonly ConcurrentQueue<PlayerInfo> MatchmakingQueue = new();
    
    private readonly ILogger<GameHub> _logger;

    public GameHub(ILogger<GameHub> logger)
    {
        _logger = logger;
    }

    // ============================================
    // Connection Lifecycle
    // ============================================
    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Player connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connectionId = Context.ConnectionId;
        _logger.LogInformation("Player disconnected: {ConnectionId}", connectionId);

        // Remove from players
        if (Players.TryRemove(connectionId, out var player))
        {
            // If in a match, notify opponent
            if (player.MatchId != null && ActiveMatches.TryGetValue(player.MatchId, out var match))
            {
                var opponent = match.GetOpponent(connectionId);
                if (opponent != null)
                {
                    await Clients.Client(opponent.ConnectionId).SendAsync("OpponentDisconnected");
                }
                ActiveMatches.TryRemove(player.MatchId, out _);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ============================================
    // Matchmaking
    // ============================================
    public async Task JoinMatchmaking(string playerName)
    {
        var connectionId = Context.ConnectionId;
        _logger.LogInformation("Player {Name} joining matchmaking: {ConnectionId}", playerName, connectionId);

        var player = new PlayerInfo
        {
            ConnectionId = connectionId,
            Name = string.IsNullOrWhiteSpace(playerName) ? $"Fighter{Random.Shared.Next(1000, 9999)}" : playerName,
            JoinedAt = DateTime.UtcNow
        };

        Players[connectionId] = player;

        // Try to find an opponent in the queue
        while (MatchmakingQueue.TryDequeue(out var opponent))
        {
            // Verify opponent is still connected
            if (!Players.ContainsKey(opponent.ConnectionId) || opponent.ConnectionId == connectionId)
            {
                continue;
            }

            // Found a valid opponent - create match!
            await CreateMatch(player, opponent);
            return;
        }

        // No opponent found, add to queue and notify player they're waiting
        MatchmakingQueue.Enqueue(player);
        await Clients.Caller.SendAsync("WaitingForOpponent");
        _logger.LogInformation("Player {Name} added to queue, waiting for opponent", player.Name);
    }

    private async Task CreateMatch(PlayerInfo player1, PlayerInfo player2)
    {
        var matchId = Guid.NewGuid().ToString("N")[..8];
        
        var match = new Match
        {
            Id = matchId,
            Player1 = player1,
            Player2 = player2,
            State = MatchState.Starting,
            CreatedAt = DateTime.UtcNow
        };

        player1.MatchId = matchId;
        player2.MatchId = matchId;
        ActiveMatches[matchId] = match;

        // Add both to a SignalR group for the match
        await Groups.AddToGroupAsync(player1.ConnectionId, matchId);
        await Groups.AddToGroupAsync(player2.ConnectionId, matchId);

        // Notify both players
        await Clients.Client(player1.ConnectionId).SendAsync("MatchFound", new MatchInfo
        {
            MatchId = matchId,
            PlayerNumber = 1,
            OpponentName = player2.Name
        });

        await Clients.Client(player2.ConnectionId).SendAsync("MatchFound", new MatchInfo
        {
            MatchId = matchId,
            PlayerNumber = 2,
            OpponentName = player1.Name
        });

        _logger.LogInformation("Match created: {MatchId} - {Player1} vs {Player2}", 
            matchId, player1.Name, player2.Name);
    }

    public async Task LeaveMatchmaking()
    {
        var connectionId = Context.ConnectionId;
        
        if (Players.TryGetValue(connectionId, out var player))
        {
            // Note: ConcurrentQueue doesn't support removal, but the player will be
            // filtered out when dequeuing (see JoinMatchmaking check)
            _logger.LogInformation("Player {Name} left matchmaking", player.Name);
        }

        Players.TryRemove(connectionId, out _);
    }

    // ============================================
    // Game Input Relay
    // ============================================
    public async Task SendInput(PlayerInput input)
    {
        var connectionId = Context.ConnectionId;

        if (!Players.TryGetValue(connectionId, out var player) || player.MatchId == null)
        {
            return;
        }

        if (!ActiveMatches.TryGetValue(player.MatchId, out var match))
        {
            return;
        }

        var opponent = match.GetOpponent(connectionId);
        if (opponent == null) return;

        // Relay input to opponent
        await Clients.Client(opponent.ConnectionId).SendAsync("OpponentInput", input);
    }

    // ============================================
    // Loadout Sync
    // ============================================
    public async Task SendLoadout(Loadout loadout)
    {
        var connectionId = Context.ConnectionId;

        if (!Players.TryGetValue(connectionId, out var player) || player.MatchId == null)
        {
            return;
        }

        if (!ActiveMatches.TryGetValue(player.MatchId, out var match))
        {
            return;
        }

        var opponent = match.GetOpponent(connectionId);
        if (opponent == null) return;

        // Relay loadout to opponent
        await Clients.Client(opponent.ConnectionId).SendAsync("OpponentLoadoutChanged", loadout);
        _logger.LogDebug("Player {ConnectionId} changed loadout to {Loadout}", connectionId, loadout);
    }

    // ============================================
    // Game State Events
    // ============================================
    public async Task PlayerReady()
    {
        var connectionId = Context.ConnectionId;

        if (!Players.TryGetValue(connectionId, out var player) || player.MatchId == null)
        {
            return;
        }

        player.IsReady = true;

        if (!ActiveMatches.TryGetValue(player.MatchId, out var match))
        {
            return;
        }

        // Check if both players are ready
        if (match.Player1.IsReady && match.Player2.IsReady)
        {
            match.State = MatchState.Fighting;
            await Clients.Group(player.MatchId).SendAsync("FightStart");
            _logger.LogInformation("Match {MatchId} - Fight started!", match.Id);
        }
    }

    // ============================================
    // Ping/Pong for latency measurement
    // ============================================
    public async Task Ping()
    {
        await Clients.Caller.SendAsync("Pong", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    }

    // ============================================
    // Match End
    // ============================================
    public async Task ReportMatchEnd(int winnerPlayerNumber)
    {
        var connectionId = Context.ConnectionId;

        if (!Players.TryGetValue(connectionId, out var player) || player.MatchId == null)
        {
            return;
        }

        if (!ActiveMatches.TryGetValue(player.MatchId, out var match))
        {
            return;
        }

        match.State = MatchState.MatchEnd;
        await Clients.Group(player.MatchId).SendAsync("MatchEnded", winnerPlayerNumber);
        
        _logger.LogInformation("Match {MatchId} ended - Winner: Player {Winner}", 
            match.Id, winnerPlayerNumber);

        // Cleanup
        await CleanupMatch(match);
    }

    private async Task CleanupMatch(Match match)
    {
        await Groups.RemoveFromGroupAsync(match.Player1.ConnectionId, match.Id);
        await Groups.RemoveFromGroupAsync(match.Player2.ConnectionId, match.Id);
        
        match.Player1.MatchId = null;
        match.Player1.IsReady = false;
        match.Player2.MatchId = null;
        match.Player2.IsReady = false;
        
        ActiveMatches.TryRemove(match.Id, out _);
    }
}
