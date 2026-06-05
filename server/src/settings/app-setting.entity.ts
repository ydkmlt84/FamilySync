import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class AppSetting {
  @PrimaryColumn("text")
  key!: string;

  @Column("text")
  value!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
