// ============================================
// Leaderboard Controller - High Scores API
// Speichert Daten in leaderboard.json
// ============================================

using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace FighterGame.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private static readonly string DataFile = Path.Combine(
        AppDomain.CurrentDomain.BaseDirectory, "leaderboard.json");
    private static readonly object _fileLock = new();
    private static List<LeaderboardEntry>? _cache;
    
    /// <summary>
    /// Load entries from file (with caching)
    /// </summary>
    private static List<LeaderboardEntry> LoadEntries()
    {
        if (_cache != null) return _cache;
        
        lock (_fileLock)
        {
            if (_cache != null) return _cache;
            
            if (System.IO.File.Exists(DataFile))
            {
                try
                {
                    var json = System.IO.File.ReadAllText(DataFile);
                    _cache = JsonSerializer.Deserialize<List<LeaderboardEntry>>(json) ?? [];
                }
                catch
                {
                    _cache = [];
                }
            }
            else
            {
                _cache = [];
            }
            return _cache;
        }
    }
    
    /// <summary>
    /// Save entries to file
    /// </summary>
    private static void SaveEntries(List<LeaderboardEntry> entries)
    {
        lock (_fileLock)
        {
            _cache = entries;
            var json = JsonSerializer.Serialize(entries, new JsonSerializerOptions 
            { 
                WriteIndented = true 
            });
            System.IO.File.WriteAllText(DataFile, json);
        }
    }
    
    /// <summary>
    /// Get top 100 leaderboard entries
    /// </summary>
    [HttpGet]
    public ActionResult<IEnumerable<LeaderboardEntry>> GetLeaderboard()
    {
        var entries = LoadEntries();
        var sorted = entries
            .OrderByDescending(e => e.Score)
            .ThenBy(e => e.Timestamp)
            .Take(100)
            .Select((e, index) => e with { Rank = index + 1 })
            .ToList();
        
        return Ok(sorted);
    }
    
    /// <summary>
    /// Submit a new score
    /// </summary>
    [HttpPost]
    public ActionResult<SubmitScoreResponse> SubmitScore([FromBody] SubmitScoreRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PlayerName))
        {
            return BadRequest("Player name is required");
        }
        
        if (request.PlayerName.Length > 20)
        {
            return BadRequest("Player name must be 20 characters or less");
        }
        
        // Calculate score
        var levelPoints = request.Level * 100;
        var bonusPoints = (int)Math.Round(100 - Math.Clamp(request.EnemyHealthPercent, 0, 100));
        var totalScore = levelPoints + bonusPoints;
        
        var entry = new LeaderboardEntry
        {
            Id = Guid.NewGuid(),
            PlayerName = request.PlayerName.Trim(),
            Score = totalScore,
            Level = request.Level,
            BonusPoints = bonusPoints,
            Timestamp = DateTime.UtcNow
        };
        
        // Load, add, and save
        var entries = LoadEntries();
        entries.Add(entry);
        SaveEntries(entries);
        
        // Calculate rank
        var rank = entries.Count(e => e.Score > totalScore) + 1;
        var isNewHighScore = rank == 1;
        
        return Ok(new SubmitScoreResponse
        {
            Rank = rank,
            Score = totalScore,
            IsNewHighScore = isNewHighScore
        });
    }
}

// ============================================
// Models
// ============================================

public record LeaderboardEntry
{
    public Guid Id { get; init; }
    public int Rank { get; init; }
    public required string PlayerName { get; init; }
    public int Score { get; init; }
    public int Level { get; init; }
    public int BonusPoints { get; init; }
    public DateTime Timestamp { get; init; }
}

public record SubmitScoreRequest
{
    public required string PlayerName { get; init; }
    public int Level { get; init; }
    public double EnemyHealthPercent { get; init; }
}

public record SubmitScoreResponse
{
    public int Rank { get; init; }
    public int Score { get; init; }
    public bool IsNewHighScore { get; init; }
}
