import { ListingStatus } from '../apis/pantmig-api/models/ListingStatus';
import type { RecycleListing } from '../apis/pantmig-api/models/RecycleListing';

/**
 * Determine if a listing is in a final/non-active state.
 * Final when closed (status 5), completed (status 6), inactive, or has a completedAt timestamp.
 */
export function isFinalListing(l: RecycleListing): boolean {
  return (
    l.status === ListingStatus.NUMBER_5 ||
    l.status === ListingStatus.NUMBER_6 ||
    l.isActive === false ||
    !!l.completedAt
  );
}
