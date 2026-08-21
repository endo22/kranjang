import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { AlertsService } from "./alerts.service.js";

@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name);

  constructor(@Inject(AlertsService) private readonly alertsService: AlertsService) {}

  /** Setiap hari pukul 08:00 waktu Jakarta. */
  @Cron("0 8 * * *", { timeZone: "Asia/Jakarta", name: "daily-low-stock-alerts" })
  async handleDailyLowStockAlerts() {
    this.logger.log("Menjalankan cron alert stok menipis…");
    await this.alertsService.runScheduledLowStockAlerts();
  }
}
