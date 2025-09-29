import { ListingStatus } from '../apis/pantmig-api/models/ListingStatus';
import type { RecycleListing } from '../apis/pantmig-api/models/RecycleListing';

export type StatusView = { label: string; color: string };

export function getListingStatusView(item: RecycleListing): StatusView {
  // Highest priority: an actually completed listing (has completedAt) should always show green "Afsluttet"
  if (item.completedAt) return { label: 'Afsluttet', color: '#065f46' };

  switch (item.status) {
    case ListingStatus.NUMBER_0:
      return { label: 'Oprettet', color: '#6b7280' };
    case ListingStatus.NUMBER_1:
      return { label: 'Aktiv', color: '#059669' };
    case ListingStatus.NUMBER_2:
      return { label: 'Accepteret', color: '#1d4ed8' };
    case ListingStatus.NUMBER_3:
      return { label: 'Afventer kvittering', color: '#b45309' };
    case ListingStatus.NUMBER_4:
      return { label: 'Kvittering indsendt', color: '#7c3aed' };
    case ListingStatus.NUMBER_5:
      // Closed without completion; treat as neutral/danger but not success
      return { label: 'Lukket', color: '#b91c1c' }; // slightly updated red tone
    case ListingStatus.NUMBER_6:
      return { label: 'Afsluttet', color: '#065f46' };
    default: {
      if (item.isActive === false) return { label: 'Lukket', color: '#b91c1c' };
      if (item.assignedRecyclerUserId) return { label: 'Accepteret', color: '#1d4ed8' };
      return { label: 'Aktiv', color: '#059669' };
    }
  }
}
