/**
 * Lets only the newest request write its result. Each action calls begin()
 * when it starts; a response may apply only while isLatest(ticket) is true.
 */
export interface LatestRequestGate {
  begin: () => number;
  isLatest: (ticket: number) => boolean;
}

export function createLatestRequestGate(): LatestRequestGate {
  let latest = 0;
  return {
    begin: () => {
      latest += 1;
      return latest;
    },
    isLatest: (ticket) => ticket === latest,
  };
}
