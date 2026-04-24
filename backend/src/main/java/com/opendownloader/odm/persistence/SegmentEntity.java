package com.opendownloader.odm.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

@Entity
@Table(name = "segments", indexes = {
        @Index(name = "idx_segments_download", columnList = "download_id")
})
public class SegmentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long pk;

    @Column(name = "download_id", length = 36, nullable = false)
    private String downloadId;

    @Column(name = "segment_index", nullable = false)
    private int segmentIndex;

    @Column(name = "start_offset", nullable = false)
    private long startOffset;

    @Column(name = "end_offset", nullable = false)
    private long endOffset;

    @Column(name = "cursor", nullable = false)
    private long cursor;

    @Column(name = "completed", nullable = false)
    private boolean completed;

    public Long getPk() { return pk; }
    public void setPk(Long pk) { this.pk = pk; }
    public String getDownloadId() { return downloadId; }
    public void setDownloadId(String downloadId) { this.downloadId = downloadId; }
    public int getSegmentIndex() { return segmentIndex; }
    public void setSegmentIndex(int segmentIndex) { this.segmentIndex = segmentIndex; }
    public long getStartOffset() { return startOffset; }
    public void setStartOffset(long startOffset) { this.startOffset = startOffset; }
    public long getEndOffset() { return endOffset; }
    public void setEndOffset(long endOffset) { this.endOffset = endOffset; }
    public long getCursor() { return cursor; }
    public void setCursor(long cursor) { this.cursor = cursor; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
}
