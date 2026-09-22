/**
 * Newline-delimited JSON, reassembled.
 *
 * A network chunk can split a line anywhere, including in the middle of a
 * string in the middle of an object, so the tail of each chunk is held back
 * until its newline arrives. Getting this wrong does not fail loudly: it drops
 * whichever events happened to straddle a boundary, which on a slow connection
 * means the citations arrive and the answer does not.
 */
export function createNdjsonParser<T>() {
  let buffer = '';

  return {
    /** Parse whatever complete lines this chunk finishes. */
    push(chunk: string): T[] {
      buffer += chunk;
      const events: T[] = [];

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (line.length === 0) continue;

        try {
          events.push(JSON.parse(line) as T);
        } catch {
          // A malformed line is one lost event, not a lost answer.
        }
      }

      return events;
    },

    /** The last line, if the stream ended without a trailing newline. */
    flush(): T[] {
      const line = buffer.trim();
      buffer = '';
      if (line.length === 0) return [];
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    },
  };
}
