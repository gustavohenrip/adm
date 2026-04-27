package com.opendownloader.odm.persistence;

import java.time.Instant;

import com.opendownloader.odm.download.DownloadKind;
import com.opendownloader.odm.download.DownloadStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "downloads")
public class DownloadEntity {

    @Id
    @Column(length = 36, nullable = false)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DownloadKind kind;

    @Column(nullable = false, length = 512)
    private String name;

    @Column(length = 16)
    private String ext;

    @Column(length = 2048)
    private String url;

    @Column(length = 256)
    private String source;

    @Column(name = "size_bytes")
    private long sizeBytes;

    @Column(name = "downloaded_bytes")
    private long downloadedBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DownloadStatus status;

    @Column(length = 1024)
    private String folder;

    @Column(name = "filename", length = 512)
    private String filename;

    @Column(name = "accepts_ranges")
    private boolean acceptsRanges;

    @Column(name = "segments")
    private int segments;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @Column(name = "encrypted_credentials", length = 2048)
    private String encryptedCredentials;

    @Column(name = "mirrors", length = 4096)
    private String mirrors;

    @Column(name = "checksum_algo", length = 16)
    private String checksumAlgo;

    @Column(name = "checksum_expected", length = 256)
    private String checksumExpected;

    @Column(name = "checksum_actual", length = 256)
    private String checksumActual;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public DownloadKind getKind() { return kind; }
    public void setKind(DownloadKind kind) { this.kind = kind; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getExt() { return ext; }
    public void setExt(String ext) { this.ext = ext; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }
    public long getDownloadedBytes() { return downloadedBytes; }
    public void setDownloadedBytes(long downloadedBytes) { this.downloadedBytes = downloadedBytes; }
    public DownloadStatus getStatus() { return status; }
    public void setStatus(DownloadStatus status) { this.status = status; }
    public String getFolder() { return folder; }
    public void setFolder(String folder) { this.folder = folder; }
    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }
    public boolean isAcceptsRanges() { return acceptsRanges; }
    public void setAcceptsRanges(boolean acceptsRanges) { this.acceptsRanges = acceptsRanges; }
    public int getSegments() { return segments; }
    public void setSegments(int segments) { this.segments = segments; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getEncryptedCredentials() { return encryptedCredentials; }
    public void setEncryptedCredentials(String encryptedCredentials) { this.encryptedCredentials = encryptedCredentials; }
    public String getMirrors() { return mirrors; }
    public void setMirrors(String mirrors) { this.mirrors = mirrors; }
    public String getChecksumAlgo() { return checksumAlgo; }
    public void setChecksumAlgo(String checksumAlgo) { this.checksumAlgo = checksumAlgo; }
    public String getChecksumExpected() { return checksumExpected; }
    public void setChecksumExpected(String checksumExpected) { this.checksumExpected = checksumExpected; }
    public String getChecksumActual() { return checksumActual; }
    public void setChecksumActual(String checksumActual) { this.checksumActual = checksumActual; }
}
