# Obsidian Voice Sync API Documentation

## Overview

The Jarvis Bot provides a REST API for Obsidian plugins to retrieve voice notes transcribed from WhatsApp audio messages. This allows you to sync your voice notes directly to your Obsidian vault without needing Git integration.

## Why This Approach?

- **No Conflicts with Obsidian Sync**: Since notes are pulled by the plugin rather than pushed via Git, there's no conflict with Obsidian's native sync
- **Works on All Devices**: The Obsidian plugin can run on desktop while mobile devices use Obsidian Sync
- **Better Control**: You decide when and how to sync notes to your vault
- **Maintains Privacy**: Notes stay in your control, stored temporarily in Cloudflare KV

## Authentication

All API endpoints require authentication using a Bearer token in the Authorization header:

```
Authorization: Bearer your-obsidian-api-key
```

Set your API key in the `.dev.vars` file:
```
OBSIDIAN_API_KEY=your-secure-api-key-here
```

## API Endpoints

### 1. Get Unprocessed Notes

Retrieve all voice notes that haven't been synced to Obsidian yet.

**Endpoint**: `GET /api/voice-notes/unprocessed`

**Response**:
```json
[
  {
    "id": "vn_1234567890_abc123",
    "transcription": "Remember to buy groceries and call mom about dinner plans",
    "timestamp": "2025-01-15T14:30:00Z",
    "phone": "5511999999999",
    "processed": false,
    "syncedToObsidian": false,
    "metadata": {
      "classification": "note",
      "confidence": 0.95,
      "audioUrl": "https://...",
      "duration": 15
    }
  }
]
```

### 2. Get All Notes

Retrieve all stored voice notes with optional pagination.

**Endpoint**: `GET /api/voice-notes/all?limit=100&offset=0`

**Query Parameters**:
- `limit` (optional): Maximum number of notes to return (default: 100)
- `offset` (optional): Number of notes to skip for pagination (default: 0)

**Response**: Same format as unprocessed notes

### 3. Get Recent Notes

Retrieve voice notes from the last N hours.

**Endpoint**: `GET /api/voice-notes/recent?hours=24`

**Query Parameters**:
- `hours` (optional): Number of hours to look back (default: 24)

**Response**: Same format as unprocessed notes

### 4. Mark Note as Processed

Mark a note as processed (but not necessarily synced to Obsidian).

**Endpoint**: `POST /api/voice-notes/{noteId}/processed`

**Response**:
```json
{
  "success": true
}
```

### 5. Mark Note as Synced

Mark a note as successfully synced to Obsidian.

**Endpoint**: `POST /api/voice-notes/{noteId}/synced`

**Response**:
```json
{
  "success": true
}
```

## Note Structure

Each voice note contains:

- **id**: Unique identifier for the note
- **transcription**: The transcribed text from the audio message
- **timestamp**: When the audio was received
- **phone**: WhatsApp phone number of the sender
- **processed**: Whether the note has been processed by the system
- **syncedToObsidian**: Whether the note has been synced to Obsidian
- **metadata**: Additional information including:
  - **classification**: Type of content (note, task, fund, etc.)
  - **confidence**: Classification confidence score
  - **audioUrl**: Original audio URL (if available)
  - **duration**: Audio duration in seconds

## CORS Support

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: authorization, content-type`

## Example Obsidian Plugin Code

Here's a simple example of how to fetch notes from your Obsidian plugin:

```javascript
class VoiceSyncPlugin extends Plugin {
  async syncVoiceNotes() {
    const apiKey = this.settings.apiKey;
    const apiUrl = this.settings.apiUrl || 'https://jarvis-bot.workers.dev';
    
    try {
      // Fetch unprocessed notes
      const response = await fetch(`${apiUrl}/api/voice-notes/unprocessed`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const notes = await response.json();
      
      // Process each note
      for (const note of notes) {
        // Create note in Obsidian
        await this.createNoteInVault(note);
        
        // Mark as synced
        await fetch(`${apiUrl}/api/voice-notes/${note.id}/synced`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
      }
      
      new Notice(`Synced ${notes.length} voice notes`);
    } catch (error) {
      console.error('Sync failed:', error);
      new Notice('Voice sync failed: ' + error.message);
    }
  }
  
  async createNoteInVault(voiceNote) {
    const date = new Date(voiceNote.timestamp);
    const fileName = `Voice Notes/${date.toISOString().split('T')[0]}.md`;
    
    // Get or create the daily note
    let content = '';
    const file = this.app.vault.getAbstractFileByPath(fileName);
    if (file instanceof TFile) {
      content = await this.app.vault.read(file);
    }
    
    // Append the new note
    const time = date.toLocaleTimeString();
    const newEntry = `\n## ${time}\n${voiceNote.transcription}\n`;
    content += newEntry;
    
    // Save the file
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(fileName, content);
    }
  }
}
```

## Rate Limits

- Maximum 100 requests per minute per API key
- Notes are stored for 90 days in KV storage
- Maximum response size: 10MB

## Security Considerations

1. **Keep your API key secure** - Never commit it to version control
2. **Use HTTPS only** - The API is only accessible over HTTPS
3. **Rotate keys regularly** - Change your API key periodically
4. **Monitor usage** - Check for unusual activity in your Cloudflare dashboard

## Deployment

1. Set your `OBSIDIAN_API_KEY` in Cloudflare Workers secrets:
   ```bash
   npx wrangler secret put OBSIDIAN_API_KEY
   ```

2. Deploy the worker:
   ```bash
   npm run deploy
   ```

3. Test the API:
   ```bash
   curl -H "Authorization: Bearer your-api-key" \
        https://your-worker.workers.dev/api/voice-notes/unprocessed
   ```

## Support

For issues or questions about the API:
1. Check the worker logs: `npx wrangler tail`
2. Review the KV storage in Cloudflare dashboard
3. Open an issue on the GitHub repository