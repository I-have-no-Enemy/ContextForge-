import { Prisma, ReviewItemType, ReviewStatus } from '@prisma/client';

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
