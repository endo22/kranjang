import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AlertsController } from "./alerts.controller.js";
import { AlertsScheduler } from "./alerts.scheduler.js";
import { AlertsService } from "./alerts.service.js";

const enableSchedule = process.env.NODE_ENV !== "test";

@Module({
  imports: enableSchedule ? [ScheduleModule.forRoot()] : [],
  controllers: [AlertsController],
  providers: enableSchedule ? [AlertsService, AlertsScheduler] : [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
