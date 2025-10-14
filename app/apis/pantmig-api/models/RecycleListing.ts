/* App-local augmentation type for listings used throughout the UI. */
import type { RecycleListingResponse } from './RecycleListingResponse';

type IsoDateLike = Date | string;

export interface RecycleListing extends RecycleListingResponse {
  // Extra fields that may be provided by backend or derived client-side
  appliedForRecyclementUserIdList?: string[];

  // Meeting point and lifecycle timestamps
  meetingLatitude?: number | null;
  meetingLongitude?: number | null;
  meetingSetAt?: IsoDateLike | null;
  pickupConfirmedAt?: IsoDateLike | null;
  completedAt?: IsoDateLike | null;

  // Display helpers
  location?: string | null;
}

export default RecycleListing;
