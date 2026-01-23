# Logamizer

A lightweight log insight and security signal SaaS tool that turns raw access/error logs into clear signals, explanations, and actionable next steps.

## Features

- **Log Ingestion**: Upload Apache/Nginx access and error logs, or configure automated log sources
- **Parsing & Normalization**: Structured event extraction with quality metrics
- **Security Signals**: Rule-based detection for scanning, abuse, and misconfigurations
- **Anomaly Detection**: Statistical baseline comparison for traffic and error spikes
- **Error Tracking**: Automated error log parsing with grouping, deduplication, and trend analysis
- **IP Filtering**: Filter traffic by IP address to hide internal/test traffic from analytics
- **Scheduled Log Fetching**: Automated log collection from remote sources (SFTP, HTTP, S3)
- **LLM Explanations**: Ollama-powered insights grounded in computed facts (optional)

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   frontend  │────>│     api     │────>│   worker    │
│   (React)   │     │  (FastAPI)  │     │  (Celery)   │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                          │                    │
                    ┌─────▼─────┐        ┌─────▼─────┐
                    │  postgres │        │   redis   │
                    └───────────┘        └───────────┘
                          │
                    ┌─────▼─────┐        ┌───────────┐
                    │   minio   │        │  ollama   │
                    └───────────┘        └───────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/ryanlane/logamizer.git
cd logamizer

# Copy environment file
cp .env.example .env

# Start all services
docker-compose -f infra/docker-compose.yml up -d

# Run migrations
docker-compose -f infra/docker-compose.yml exec api alembic -c infra/migrations/alembic.ini upgrade head
```

### Access

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

### GPU Support for Ollama (Optional)

By default, Ollama runs on CPU. For better performance, you can enable GPU support:

**With GPU (NVIDIA):**
```bash
# Prerequisites: NVIDIA GPU, nvidia-docker2 installed
docker-compose -f infra/docker-compose.yml -f infra/docker-compose.gpu.yml up -d
```

**Without GPU (CPU only):**
```bash
# Explicitly use CPU mode with memory limits
docker-compose -f infra/docker-compose.yml -f infra/docker-compose.nogpu.yml up -d
```

**GPU Setup Requirements:**
1. Install [nvidia-docker2](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
2. Verify GPU is available: `docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi`
3. Use the GPU compose override as shown above

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Sites
- `GET /api/sites` - List all sites
- `POST /api/sites` - Create a site
- `GET /api/sites/{id}` - Get site details
- `PUT /api/sites/{id}` - Update site settings (including IP filtering)
- `DELETE /api/sites/{id}` - Delete site
- `GET /api/sites/{id}/dashboard` - Get dashboard analytics with IP filtering applied

### Uploads
- `POST /api/sites/{id}/upload-url` - Get presigned upload URL
- `POST /api/sites/{id}/uploads` - Confirm upload and start processing
- `GET /api/sites/{id}/log-files` - List uploaded log files

### Log Sources
- `GET /api/sites/{id}/log-sources` - List configured log sources
- `POST /api/sites/{id}/log-sources` - Create a new log source
- `PUT /api/sites/{id}/log-sources/{source_id}` - Update log source
- `DELETE /api/sites/{id}/log-sources/{source_id}` - Delete log source
- `POST /api/sites/{id}/log-sources/{source_id}/fetch-now` - Trigger immediate fetch

### Jobs
- `GET /api/jobs/{id}` - Get job details
- `GET /api/jobs/{id}/status` - Get job status (for polling)
- `GET /api/jobs` - List all jobs

### Findings
- `GET /api/sites/{id}/findings` - List security findings for a site
- `GET /api/sites/{id}/findings/{finding_id}` - Get a single finding
- `POST /api/findings/{finding_id}/explain` - Get AI explanation for a finding
- `POST /api/findings/{finding_id}/verify` - Verify finding with live probes

### Error Tracking
- `GET /api/sites/{id}/errors/groups` - List error groups
- `GET /api/sites/{id}/errors/groups/{group_id}` - Get error group details
- `GET /api/sites/{id}/errors/stats` - Get error statistics and trends
- `PUT /api/sites/{id}/errors/groups/{group_id}` - Update error group status
- `POST /api/sites/{id}/errors/groups/{group_id}/explain` - Get AI explanation
- `POST /api/sites/{id}/errors/analyze` - Analyze error logs

### Utilities
- `GET /api/public-ip` - Discover client's public IP address

### Explain
- `POST /api/sites/{id}/explain` - Explain findings/anomalies with Ollama

## Development

### Project Structure

```
logamizer/
├── apps/
│   ├── api/          # FastAPI backend
│   └── worker/       # Celery worker
│   └── frontend/     # React + Vite frontend
├── packages/
│   └── shared/       # Shared types and constants
├── infra/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   └── migrations/   # Alembic migrations
├── scripts/
│   └── setup.sh
└── tests/
```

### Running in Development Mode

```bash
# Start with hot reload
docker-compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up

### Frontend (React + Vite)

```bash
# Install frontend dependencies
cd apps/frontend
npm install

# Start the dev server
npm run dev
```
```

### Running Tests

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest
```

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.x, Celery
- **Frontend**: React 18, TypeScript, Vite, TanStack Query, Recharts, CSS Modules
- **Database**: PostgreSQL 16
- **Queue**: Redis 7
- **Storage**: MinIO (S3-compatible)
- **Auth**: JWT with refresh tokens

## Key Features

### IP Filtering & Privacy
Hide traffic from specific IP addresses (e.g., your own public IP, internal IPs, CI/CD systems) to focus on real user traffic. Configured per-site in Settings:
- Automatic public IP discovery tool
- Server-side filtering applied to all analytics
- Dashboard shows filtered metrics instantly

### Scheduled Log Fetching
Configure automated log collection from remote sources:
- **SFTP**: Fetch from remote servers via SSH
- **HTTP/HTTPS**: Download from web URLs
- **S3**: Pull from S3-compatible storage
- Flexible scheduling (hourly, daily, weekly, or cron expressions)
- Automatic processing pipeline

### Error Tracking
Automated error log analysis with intelligent grouping:
- Fingerprint-based deduplication
- Trend analysis and occurrence tracking
- Stack trace parsing and context extraction
- Deployment-aware error grouping
- AI-powered root cause explanations

## Roadmap

- [x] Phase 1: Foundations (Auth, Sites, Uploads, Jobs)
- [x] Phase 2: Log Parsing (Nginx/Apache combined formats)
- [x] Phase 3: Security Signals (Rule-based detection)
- [x] Phase 4: Anomaly Detection (Statistical baselines)
- [x] Phase 5: Ollama Integration (LLM explanations)
- [x] Phase 6: React Frontend
- [x] Phase 7: Error Tracking & Analysis
- [x] Phase 8: Scheduled Log Sources
- [x] Phase 9: IP Filtering & Privacy Controls

## License

MIT
