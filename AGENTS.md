# RustPlusPlus Bot - Agent Guidelines

## Deployment Procedure

When the user asks to deploy changes, follow this exact procedure:

1. **Commit changes**
   ```bash
   git add <changed-files>
   git commit -m "<conventional-commit-message>"
   ```

2. **Push to develop branch** (triggers CI pipeline)
   ```bash
   git push origin develop
   ```

3. **Wait for CI to finish building**
   ```bash
   gh run list -L 5
   ```
   Poll every 30-60 seconds until the "Docker image build" job shows `completed success`.
   
   If CI fails:
   - Check logs: `gh run view <run-id>`
   - Fix the issue locally
   - Commit and push again
   - Wait for CI again

4. **Rollout the deployment**
   ```bash
   kubectl rollout restart -n rustplusplus deploy/rpp-public
   ```

5. **Verify rollout completed**
   ```bash
   kubectl rollout status -n rustplusplus deploy/rpp-public
   ```

## Project Architecture

- **Language:** TypeScript (Node.js)
- **Framework:** Discord.js v14 with @discordjs/voice
- **Build:** `npm run build` (tsc)
- **Lint:** `npm run lint` (biome)
- **Format:** `npm run format` (biome)

### Key Directories
- `src/discordTools/` - Discord integration utilities
- `src/tts/providers/` - TTS provider implementations
- `src/structures/` - Core bot classes (DiscordBot, RustPlus)
- `src/handlers/` - Event handlers
- `src/discordCommands/` - Slash commands
- `src/discordEvents/` - Discord event listeners

### TTS System
- **Providers:** Piper (local), Oddcast (external API)
- **Piper streaming:** Uses `--output_raw` + ffmpeg for real-time Ogg Opus encoding
- **Queue system:** Single AudioPlayer per guild with queued resources to prevent message stomping
- **Voice channel cleanup:** TTS state is destroyed when bot leaves voice channel

### Infrastructure
- **Container:** Docker image built by CI on push to `develop`
- **Orchestration:** Kubernetes (namespace: `rustplusplus`)
- **Deployment:** `deploy/rpp-public`
- **CI/CD:** GitHub Actions (Docker image build + Build/code quality)

## Important Notes

- Always run `npm run build` after making changes to verify TypeScript compiles
- The project uses conventional commits (feat:, fix:, style:, etc.)
- The `develop` branch is the deployment target
- Piper models are stored in `/app/models` inside the container
- The bot connects to Rust+ Companion App via WebSocket
