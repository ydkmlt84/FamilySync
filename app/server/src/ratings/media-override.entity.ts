import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index(["ratingKey"], { unique: true })
export class MediaOverride {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("text")
  ratingKey!: string;

  @Column("boolean", { default: false })
  taggingExcluded!: boolean;

  @Column("text", { nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
