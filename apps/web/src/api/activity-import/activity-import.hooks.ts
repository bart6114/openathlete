import { eventKeys } from '@/api/event/event.keys';
import { trainingLoadKeys } from '@/api/training-load/training-load.keys';
import {
  MutationOptions,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  ImportedActivityDto,
  RemoveDuplicateActivitiesResponseDto,
  SPORT_TYPE,
} from '@openathlete/shared';

import { ActivityImportAPI } from './activity-import.api';

const runGapConnectionKey = ['activity-import', 'rungap-connection'];

export function useRunGapConnectionQuery() {
  return useQuery({
    queryKey: runGapConnectionKey,
    queryFn: ActivityImportAPI.getRunGapConnection,
  });
}

export function useSetRunGapConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ActivityImportAPI.setRunGapConnection,
    onSuccess: (result) =>
      queryClient.setQueryData(runGapConnectionKey, result),
  });
}

const refreshImported = (
  queryClient: QueryClient,
  result: ImportedActivityDto,
) =>
  Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: [eventKeys.getMyEvents] }),
    queryClient.invalidateQueries({
      queryKey: [eventKeys.getEventStream, result.eventId],
    }),
    queryClient.invalidateQueries({
      queryKey: [trainingLoadKeys.getWeeklyLoadSummary],
    }),
  ]);

export function useImportFitMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) =>
      ActivityImportAPI.importFit(file, name),
    onSuccess: (result) => refreshImported(queryClient, result),
  });
}

export function useImportGpxMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      name,
      sport,
    }: {
      file: File;
      name: string;
      sport?: SPORT_TYPE;
    }) => ActivityImportAPI.importGpx(file, name, sport),
    onSuccess: (result) => refreshImported(queryClient, result),
  });
}

export function useImportTcxMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      name,
      sport,
    }: {
      file: File;
      name: string;
      sport?: SPORT_TYPE;
    }) => ActivityImportAPI.importTcx(file, name, sport),
    onSuccess: (result) => refreshImported(queryClient, result),
  });
}

/**
 * The removal runs in the background: the calendar refreshes when the API
 * announces the deletions over its websocket.
 */
export function useRemoveDuplicateActivitiesMutation(
  opt?: MutationOptions<RemoveDuplicateActivitiesResponseDto, Error, void>,
) {
  return useMutation({
    ...opt,
    mutationFn: () => ActivityImportAPI.removeDuplicates(),
  });
}
