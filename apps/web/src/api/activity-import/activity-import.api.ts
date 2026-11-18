import client, { routes } from '@/utils/axios';

import {
  ImportedActivityDto,
  RemoveDuplicateActivitiesResponseDto,
  RunGapConnectionDto,
  SPORT_TYPE,
} from '@openathlete/shared';

export class ActivityImportAPI {
  static async getRunGapConnection() {
    const res = await client.get<RunGapConnectionDto>(
      routes.activityImport.runGapConnection,
    );
    return res.data;
  }

  static async setRunGapConnection(enabled: boolean) {
    if (enabled) {
      const res = await client.post<RunGapConnectionDto>(
        routes.activityImport.runGapConnection,
      );
      return res.data;
    }
    await client.delete(routes.activityImport.runGapConnection);
    return { connection: null } satisfies RunGapConnectionDto;
  }

  /** One FIT file of a recorded activity, saved for the signed-in athlete. */
  static async importFit(file: File, name: string) {
    const body = new FormData();
    body.append('file', file);
    body.append('name', name);
    const res = await client.post<ImportedActivityDto>(
      routes.activityImport.fit,
      body,
    );
    return res.data;
  }

  /**
   * One GPX track of a recorded activity. Without `sport`, the API uses the
   * sport the track declares.
   */
  static async importGpx(file: File, name: string, sport?: SPORT_TYPE) {
    const body = new FormData();
    body.append('file', file);
    body.append('name', name);
    if (sport) body.append('sport', sport);
    const res = await client.post<ImportedActivityDto>(
      routes.activityImport.gpx,
      body,
    );
    return res.data;
  }

  /**
   * One TCX activity. Without `sport`, the API uses the activity's own
   * (TCX only names running and biking).
   */
  static async importTcx(file: File, name: string, sport?: SPORT_TYPE) {
    const body = new FormData();
    body.append('file', file);
    body.append('name', name);
    if (sport) body.append('sport', sport);
    const res = await client.post<ImportedActivityDto>(
      routes.activityImport.tcx,
      body,
    );
    return res.data;
  }

  /**
   * Queues the removal of the activities saved twice from two sources. The
   * calendar refreshes when the removal is done.
   */
  static async removeDuplicates() {
    const res = await client.post<RemoveDuplicateActivitiesResponseDto>(
      routes.activityImport.removeDuplicates,
    );
    return res.data;
  }
}
