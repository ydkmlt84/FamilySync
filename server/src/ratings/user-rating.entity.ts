import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index(["ratingKey", "plexUserId"], { unique: true })
export class UserRating {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("text")
  ratingKey!: string;

  @Column("text", { default: "movie" })
  mediaType!: "movie" | "show" | "season" | "episode";

  @Column("text", { nullable: true })
  title?: string;

  @Column("text", { nullable: true })
  displayTitle?: string;

  @Column("text", { nullable: true })
  thumb?: string;

  @Column("text", { nullable: true })
  parentTitle?: string;

  @Column("text", { nullable: true })
  grandparentTitle?: string;

  @Column("text", { nullable: true })
  parentRatingKey?: string;

  @Column("text", { nullable: true })
  grandparentRatingKey?: string;

  @Column("integer", { nullable: true })
  year?: number;

  @Column("integer", { nullable: true })
  mediaIndex?: number;

  @Column("integer", { nullable: true })
  parentIndex?: number;

  @Column("integer", { nullable: true })
  tmdbId?: number;

  @Column("integer", { nullable: true })
  tvdbId?: number;

  @Column("text")
  plexUserId!: string;

  @Column("float", { nullable: true })
  rating!: number | null;

  @Column("text", { default: "rated" })
  syncStatus!: "rated" | "unrated" | "unavailable";

  @UpdateDateColumn()
  updatedAt!: Date;
}
