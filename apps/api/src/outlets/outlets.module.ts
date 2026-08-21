import { Module } from "@nestjs/common";
import { OutletsController } from "./outlets.controller.js";
import { OutletsService } from "./outlets.service.js";

@Module({
  controllers: [OutletsController],
  providers: [OutletsService],
  exports: [OutletsService],
})
export class OutletsModule {}
