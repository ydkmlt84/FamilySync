import { Request } from "express";
import { LinkedUser } from "../users/linked-user.entity";

export type AuthenticatedRequest = Request & {
  user?: LinkedUser;
};
