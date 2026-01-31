import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
) {
  const headerId = req.headers["x-request-id"];
  const requestId =
    (Array.isArray(headerId) ? headerId[0] : headerId) || randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  next();
}
