using FighterGame.Api.Hubs;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Add Controllers for REST API with camelCase JSON
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// Add SignalR with MessagePack for better performance
builder.Services.AddSignalR()
    .AddMessagePackProtocol();

// CORS for Angular frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("FighterGame", policy =>
    {
        policy.WithOrigins(
                "http://localhost:4200",  // Angular dev server
                "http://localhost:5000",  // Production
                "https://localhost:5001"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Use CORS
app.UseCors("FighterGame");

// Map Controllers (REST API)
app.MapControllers();

// Map SignalR Hub
app.MapHub<GameHub>("/api/game-hub");

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { Status = "Healthy", Timestamp = DateTime.UtcNow }));

app.Run();
