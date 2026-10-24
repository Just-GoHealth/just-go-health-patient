import { http } from "./http";
import type {
  CampusCard,
  CampusCardItem,
  CampusType,
  Page,
  PageParams,
  ProgrammeList,
  UUID,
} from "./types";

// Public catalogue reads for the onboarding pickers.

export function getCampusTypes() {
  return http.get<CampusType[]>("/campus-types");
}

export type CampusSearch = PageParams & {
  card?: CampusCard;
  type?: string;
  /** Matches names and nicknames. */
  q?: string;
};

/** Paged and alphabetical. */
export function searchCampuses(params: CampusSearch = {}) {
  return http.get<Page<CampusCardItem>>("/campuses", {
    query: {
      card: params.card,
      type: params.type,
      q: params.q,
      page: params.page,
      size: params.size,
    },
  });
}

/** `fromCatalogue: true` means the campus offers nothing yet (whole catalogue listed). */
export function getProgrammes(campusId: UUID, q?: string) {
  return http.get<ProgrammeList>(
    `/campuses/${encodeURIComponent(campusId)}/programmes`,
    { query: { q } },
  );
}
