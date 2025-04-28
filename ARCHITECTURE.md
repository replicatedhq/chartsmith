# Architecture

This file exists to describe the principles of this code architecture. 
It's made for both the developer working on it and for AI models to read and apply when making changes.

## Key Architecture Principles
- The Frontend is a NextJS application in chartsmith-app
- The's a single worker, written in go, run with `make run-worker`.
- We have a Postres/pgvector database and Centrifugo for realtime notifications.
- The intent is to keep this system design and avoid new databases, queues, components. Simplicity matters.

## API Design Principles
- Prefer consolidated data endpoints over granular ones to minimize API calls and database load
- Structure API routes using Next.js's file-based routing with resource-oriented paths
- Implement consistent authentication and error handling patterns across endpoints
- Return complete data objects rather than fragments to reduce follow-up requests
- Prioritize server-side data processing over client-side assembly of multiple API calls


# Subprojects
- See chartsmith-app/ARCHITECTURE.md for the architecture principles for the front end.


## Workers
- The go code is where we put all workers. 
- Jobs for workers are enqueued and scheduled using postgres notify and a work_queue table.
- Status from the workers is communicated via Centrifugo messages to the client.