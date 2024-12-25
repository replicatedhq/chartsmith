# Chartsmith

Build Better Helm Charts

## Overview

Chartsmith is an AI-powered tool that helps you build better Helm charts.

## Prerequisites

- Go 1.23+
- Node.js 18+
- PostgreSQL 16+
- Make
- Docker

## Getting Started

### Environment Setup

1. Clone the repository

2. Set requisite environment variables:

```bash
export CHARTSMITH_PG_URI=postgresql://user:password@localhost:5432/chartsmith
export ANTHROPIC_API_KEY=your_anthropic_api_key
export POSTGRES_SSL_DISABLE=true #optional
export NEXT_PUBLIC_MOCK_AUTH=true #optional
```

3. Start the PostgreSQL database:

```bash
make postgres
```

4. Apply the database schema:

```bash
make schema
```

### Worker Setup

1. Build and start the Go backend service:

```bash
make run-worker
```

### Frontend Setup

1. Navigate to the web application directory:

```bash
cd chartsmith-app
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`
