See the following files for details:

ARCHITECTURE.md: Our core design principles
chartsmith-app/ARCHITECTURE.md: Our design principles for the frontend

CONTRIBUTING.md: How to run and test this project
chartsmith-app/CONTRIBUTING.md: How to run and test the frontend

- `/chart.go:106:2: declared and not used: repoUrl
pkg/workspace/chart.go:169:41: cannot use conn (variable of type *pgxpool.Conn) as *pgxpool.Pool value in argument to updatePublishStatus
pkg/workspace/chart.go:178:40: cannot use conn (variable of type *pgxpool.Conn) as *pgxpool.Pool value in argument to updatePublishStatus
make: *** [build] Error 1`