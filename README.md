# Lore SDK Claude session uploader

A tiny CLI that lists local Claude Code sessions and uploads the selected session to Lore on demand.

## Setup

```sh
npm install
cp .env.example .env
# edit .env and set LORE_UPLOAD_API_KEY
```

## Run

```sh
npm start
```

The CLI scans `~/.claude/projects/**/*.jsonl`, shows a TUI picker, then calls `@loredotlink/sdk` with the selected session id.

For non-interactive use, pass `--headless` to upload the first discovered session automatically. The CLI prints the selected session ID and title before uploading.

```sh
npm start --headless
```

## Timing/debugging uploads

To see where an upload spends time, run the traced upload helper with an explicit Claude Code session id:

```sh
npm run trace:upload -- <session-id>
```

For example:

```sh
/usr/bin/time -p npm run trace:upload -- 95278505-b3de-4f66-a524-6d7ef7871b87
```

To save a full timing log:

```sh
LOG="/tmp/lore-upload-trace-$(date +%s).log"
(/usr/bin/time -p npm run trace:upload -- <session-id>) 2>&1 | tee "$LOG"
echo "$LOG"
```

The trace prints timing for upload session creation, S3 upload, upload completion, parse-status polling, and the total SDK call duration. Presigned S3 query parameters are redacted before printing.
