FROM mcr.microsoft.com/playwright:v1.49.0-noble

WORKDIR /app

# Install Qualyx and Claude Code CLI
RUN npm install -g qualyx @anthropic-ai/claude-code

# Copy config
COPY qualyx.yml .

# Create directories for reports and data
RUN mkdir -p /app/qualyx-reports /app/.qualyx

# Default: run QA suite
CMD ["qualyx", "run", "--parallel", "--max-parallel", "3", "--report", "--collect-metrics"]
