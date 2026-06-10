import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity()
export class UserSession {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column("text")
  tokenHash!: string;

  @Column("text")
  linkedUserId!: string;

  @Column("datetime")
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
