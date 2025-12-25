using System.Text.Json.Serialization;

namespace FighterGame.Api.Models;

// ============================================
// Match Info - Sent when match is found
// ============================================
public class MatchInfo
{
    public required string MatchId { get; set; }
    public int PlayerNumber { get; set; }
    public required string OpponentName { get; set; }
}

// ============================================
// Enums für PlayerInput (kompakte Werte)
// ============================================
public enum MoveDirection : byte
{
    None = 0,
    Left = 1,
    Right = 2
}

public enum AttackType : byte
{
    None = 0,
    Light = 1,   // J - Schnell, wenig Schaden
    Heavy = 2,   // K - Langsam, viel Schaden
    Special = 3  // L - Spezial-Attacke
}

public enum BlockZone : byte
{
    None = 0,
    Top = 1,     // U - Kopf blocken
    Center = 2,  // I - Mitte blocken  
    Bottom = 3   // O - Beine blocken
}

// ============================================
// Player Input - Sent each frame
// ============================================
public class PlayerInput
{
    [JsonPropertyName("m")]
    public MoveDirection MoveDir { get; set; } = MoveDirection.None;
    
    [JsonPropertyName("j")]
    public bool Jump { get; set; }
    
    [JsonPropertyName("a")]
    public AttackType Attack { get; set; } = AttackType.None;
    
    [JsonPropertyName("b")]
    public BlockZone Block { get; set; } = BlockZone.None;
    
    [JsonPropertyName("r")]
    public bool Run { get; set; }
}

// ============================================
// Player Info - Internal tracking
// ============================================
public class PlayerInfo
{
    public required string ConnectionId { get; set; }
    public required string Name { get; set; }
    public string? MatchId { get; set; }
    public bool IsReady { get; set; }
    public DateTime JoinedAt { get; set; }
}

// ============================================
// Match - Active game session
// ============================================
public class Match
{
    public required string Id { get; set; }
    public required PlayerInfo Player1 { get; set; }
    public required PlayerInfo Player2 { get; set; }
    public MatchState State { get; set; }
    public DateTime CreatedAt { get; set; }
    
    public PlayerInfo? GetOpponent(string connectionId)
    {
        if (Player1.ConnectionId == connectionId) return Player2;
        if (Player2.ConnectionId == connectionId) return Player1;
        return null;
    }
}

// ============================================
// Match State
// ============================================
public enum MatchState
{
    Starting,
    Fighting,
    RoundEnd,
    MatchEnd,
    Paused
}

// ============================================
// Loadout - Equipment selection
// ============================================
public enum Loadout : byte
{
    Bare = 0,
    Sword = 1
    // Erweiterbar: Spear = 2, Hammer = 3, etc.
}
