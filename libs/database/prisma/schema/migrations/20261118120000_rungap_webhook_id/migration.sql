ALTER TABLE "athlete" ADD COLUMN "rungap_webhook_id" UUID;

CREATE UNIQUE INDEX "athlete_rungap_webhook_id_key" ON "athlete"("rungap_webhook_id");
