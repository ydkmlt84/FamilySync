import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class LinkedUser {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column("text")
  plexUserId!: string;

  @Column("text")
  plexUsername!: string;

  @Column("text", { nullable: true })
  plexThumb?: string;

  @Column("text")
  plexToken!: string;

  @Column("text", { nullable: true })
  plexAccountToken?: string;

  @Column("text", { nullable: true })
  plexServerIdentifier?: string;

  @Column("text", { nullable: true })
  plexServerName?: string;

  @Column("boolean", { default: true })
  enabled!: boolean;

  @Column("boolean", { default: false })
  isAdmin!: boolean;

  @Column("boolean", { default: false })
  isManaged!: boolean;

  @Column("text", { nullable: true })
  managedByPlexUserId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column("datetime", { nullable: true })
  lastSyncAt?: Date;
}
