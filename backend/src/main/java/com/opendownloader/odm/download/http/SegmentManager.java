package com.opendownloader.odm.download.http;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

public final class SegmentManager {

    private final long totalSize;
    private final List<Segment> segments = new ArrayList<>();
    private final AtomicInteger idSeq = new AtomicInteger();
    private final long minSplitSize;

    public SegmentManager(long totalSize, int initialCount, long minSplitSize) {
        this.totalSize = totalSize;
        this.minSplitSize = Math.max(minSplitSize, 128L * 1024L);
        partition(Math.max(1, initialCount));
    }

    private void partition(int count) {
        long chunk = Math.max(1L, totalSize / count);
        long cursor = 0;
        for (int i = 0; i < count; i++) {
            long start = cursor;
            long end = (i == count - 1) ? (totalSize - 1) : Math.min(totalSize - 1, cursor + chunk - 1);
            segments.add(new Segment(idSeq.getAndIncrement(), start, end));
            cursor = end + 1;
            if (cursor >= totalSize) break;
        }
    }

    public synchronized List<Segment> snapshot() {
        return new ArrayList<>(segments);
    }

    public synchronized Segment largestActive() {
        Segment best = null;
        long bestRemaining = 0;
        for (Segment s : segments) {
            if (s.completed()) continue;
            long r = s.remaining();
            if (r > bestRemaining) {
                best = s;
                bestRemaining = r;
            }
        }
        return best;
    }

    public synchronized Segment stealFromLargest() {
        Segment largest = largestActive();
        if (largest == null) return null;
        long remaining = largest.remaining();
        if (remaining < minSplitSize * 2) return null;
        long half = remaining / 2;
        long newEndOfOld = largest.cursor() + half - 1;
        long newStart = newEndOfOld + 1;
        long newEnd = largest.end();
        largest.shrinkEnd(newEndOfOld);
        Segment fresh = new Segment(idSeq.getAndIncrement(), newStart, newEnd);
        segments.add(fresh);
        return fresh;
    }

    public synchronized boolean allCompleted() {
        for (Segment s : segments) {
            if (!s.completed()) return false;
        }
        return true;
    }
}
