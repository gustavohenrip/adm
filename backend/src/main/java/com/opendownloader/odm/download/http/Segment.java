package com.opendownloader.odm.download.http;

public final class Segment {
    private final int id;
    private final long start;
    private volatile long cursor;
    private volatile long end;
    private volatile boolean completed;

    public Segment(int id, long start, long end) {
        this.id = id;
        this.start = start;
        this.cursor = start;
        this.end = end;
    }

    public int id() { return id; }
    public long start() { return start; }
    public long cursor() { return cursor; }
    public long end() { return end; }
    public long remaining() { return Math.max(0L, end - cursor + 1); }
    public boolean completed() { return completed; }

    public synchronized void advance(long bytes) {
        cursor += bytes;
        if (cursor > end) {
            completed = true;
        }
    }

    public synchronized void markComplete() {
        cursor = end + 1;
        completed = true;
    }

    public synchronized void shrinkEnd(long newEnd) {
        this.end = newEnd;
        if (cursor > end) {
            completed = true;
        }
    }
}
