import { Prisma, ReviewItemType, ReviewStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';

/**
 * Adds `latest_review` to each row with ONE query for the whole page (no N+1).
 * Rows are matched by `idKey` (server_id / skill_id).
 */
export async function attachLatestReview<T extends Record<string, any>>(
  itemType: ReviewItemType,
  rows: T[],
  idKey: keyof T & string
) {
  const ids = rows.map((r) => r[idKey] as string);
  const reviews = ids.length
    ? await prisma.submissionReview.findMany({
        where: { item_type: itemType, item_id: { in: ids } },
        orderBy: { reviewed_at: 'desc' },
        select: { item_id: true, status: true, flagged_by_scan: true, review_notes: true, reviewed_at: true },
      })
    : [];

  const latest = new Map<string, (typeof reviews)[number]>();
  for (const r of reviews) {
    const prev = latest.get(r.item_id);
    if (!prev || r.reviewed_at > prev.reviewed_at) latest.set(r.item_id, r);
  }

  return rows.map((row) => {
    const review = latest.get(row[idKey]);
    return {
      ...row,
      id: row[idKey],
      latest_review: review
        ? { status: review.status, flagged_by_scan: review.flagged_by_scan, review_notes: review.review_notes, reviewed_at: review.reviewed_at }
        : null,
    };
  });
}

/**
 * Puts an item back in the admin queue. Reuses the open pending review when one
 * exists so repeated edits never stack duplicate queue entries (idempotent).
 */
export async function requeueForReview(
  tx: Prisma.TransactionClient,
  itemType: ReviewItemType,
  itemId: string,
  submitterId: string,
  flaggedByScan: boolean,
  notes: string
): Promise<void> {
  const pending = await tx.submissionReview.findFirst({
    where: { item_type: itemType, item_id: itemId, status: ReviewStatus.pending },
  });

  if (pending) {
    await tx.submissionReview.update({
      where: { review_id: pending.review_id },
      data: { flagged_by_scan: flaggedByScan, review_notes: notes, reviewed_at: new Date() },
    });
    return;
  }

  await tx.submissionReview.create({
    data: {
      item_type: itemType,
      item_id: itemId,
      // ponytail: schema requires reviewer_id; the submitter holds the slot until an admin decides
      reviewer_id: submitterId,
      status: ReviewStatus.pending,
      flagged_by_scan: flaggedByScan,
      review_notes: notes,
    },
  });
}
