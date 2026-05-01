# RustPlusPlus Bot - Agent Guidelines

## Deployment Procedure

When the user asks to deploy changes, follow this exact procedure:

0. **Confirm deployment branch**
   ```bash
   git branch --show-current
   git status --short
   ```
   The deployment target is `develop`. If you are not already on `develop`, do not assume the correct action.
   Ask whether to merge/cherry-pick the current work into `develop` or push the current commit to `develop`.
   Never include unrelated dirty worktree files in a deployment commit.

1. **Commit changes**
   ```bash
   git add <changed-files>
   git commit -m "<conventional-commit-message>"
   ```

2. **Push to develop branch** (triggers CI pipeline)
   ```bash
   git push origin develop
   ```
   If you are intentionally deploying a commit from another local branch, use an explicit refspec only after the user confirms:
   ```bash
   git push origin HEAD:develop
   ```

3. **Wait for CI to finish building**
   ```bash
   git rev-parse HEAD
   gh run list --branch develop -L 10
   ```
   Poll every 30-60 seconds until the GitHub Actions run for the deployed commit is `completed success`.
   Use the run ID from `gh run list`, then inspect jobs when needed:
   ```bash
   gh run view <run-id> --json status,conclusion,headSha,jobs
   ```
   Confirm the Docker image build job and build/code quality jobs completed successfully for the expected `headSha`.
   
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
   If rollout status fails or times out, inspect the deployment and recent pods before taking further action:
   ```bash
   kubectl get pods -n rustplusplus
   kubectl describe deploy/rpp-public -n rustplusplus
   ```
   Do not run rollback commands unless the user explicitly approves them.

## Project Architecture

- **Language:** TypeScript (Node.js)
- **Framework:** Discord.js v14 with @discordjs/voice
- **Package Manager:** pnpm (always use pnpm, not npm)
- **Build:** `pnpm build` (tsc)
- **Lint:** `pnpm lint` (biome; currently may report "No files were processed" from the repo root)
- **Format:** `pnpm format` (biome)

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

- Always run `pnpm build` after making changes to verify TypeScript compiles
- If `pnpm lint` reports no processed files, check touched files directly with `pnpm exec biome check <files>`
- `pnpm build` runs `proto:gen`; commit generated protobuf changes only when the proto schema or generator output intentionally changed
- The project uses conventional commits (feat:, fix:, style:, etc.)
- The `develop` branch is the deployment target
- Do not print, commit, or include credentials/runtime data in logs, commits, or summaries. This includes FCM Android IDs, FCM security tokens, Discord tokens, Rust+ player tokens, and files under runtime credential/storage directories
- Piper models are stored in `/app/models` inside the container
- The bot connects to Rust+ Companion App via WebSocket
