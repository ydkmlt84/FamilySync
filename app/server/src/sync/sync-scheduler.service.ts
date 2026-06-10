import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { SyncService } from "./sync.service";

@Injectable()
export class SyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyncSchedulerService.name);
  private readonly ratingJobName = "familysync-rating-sync";
  private readonly tagJobName = "familysync-tag-sync";
  private readonly metadataJobName = "familysync-metadata-sync";

  constructor(
    @Inject(SchedulerRegistry)
    private readonly scheduler: SchedulerRegistry,
    @Inject(SyncService)
    private readonly sync: SyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const settings = await this.sync.getJobSettings();
    this.replaceCronJob(
      this.ratingJobName,
      this.sync.cronExpression(settings.ratingSync),
      () => this.sync.startFullSync("scheduled"),
    );
    this.replaceCronJob(
      this.tagJobName,
      this.sync.cronExpression(settings.tagSync),
      () => this.sync.startTagSync("scheduled"),
    );
    this.replaceCronJob(
      this.metadataJobName,
      this.sync.cronExpression(settings.metadataSync),
      () => this.sync.startMetadataSync("scheduled"),
    );
  }

  private replaceCronJob(
    name: string,
    expression: string | undefined,
    run: () => void,
  ): void {
    this.removeCronJob(name);

    if (!expression) {
      return;
    }

    const job = new CronJob(expression, run);
    this.scheduler.addCronJob(name, job);
    job.start();
    this.logger.log(`Scheduled ${name} with cron "${expression}".`);
  }

  private removeCronJob(name: string): void {
    try {
      const job = this.scheduler.getCronJob(name);
      job.stop();
      this.scheduler.deleteCronJob(name);
    } catch {
      return;
    }
  }
}
