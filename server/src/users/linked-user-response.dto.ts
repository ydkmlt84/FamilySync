import { LinkedUser } from "./linked-user.entity";

export class LinkedUserResponseDto {
  id!: string;
  plexUserId!: string;
  plexUsername!: string;
  plexThumb?: string;
  plexServerIdentifier?: string;
  plexServerName?: string;
  enabled!: boolean;
  isAdmin!: boolean;
  isManaged!: boolean;
  managedByPlexUserId?: string;
  createdAt!: Date;
  updatedAt!: Date;
  lastSyncAt?: Date;
}

export function toLinkedUserResponse(user: LinkedUser): LinkedUserResponseDto {
  return {
    id: user.id,
    plexUserId: user.plexUserId,
    plexUsername: user.plexUsername,
    plexThumb: user.plexThumb,
    plexServerIdentifier: user.plexServerIdentifier,
    plexServerName: user.plexServerName,
    enabled: user.enabled,
    isAdmin: user.isAdmin,
    isManaged: user.isManaged,
    managedByPlexUserId: user.managedByPlexUserId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSyncAt: user.lastSyncAt,
  };
}
