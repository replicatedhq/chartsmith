

.PHONY: postgres
postgres:
	docker run --name chartsmith-postgres \
	    -e POSTGRES_PASSWORD=password \
	    -d -p5433:5432 \
	    postgres:16



.PHONY: schema
schema:
	rm -rf ./db/generated-schema
	mkdir -p ./db/generated-schema/tables
	schemahero plan --driver postgres --uri $(CHARTSMITH_PG_URI) --spec-file ./db/schema/tables --spec-type table --out ./db/generated-schema/tables
	schemahero apply --driver postgres --uri $(CHARTSMITH_PG_URI) --ddl ./db/generated-schema/tables
